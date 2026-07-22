/**
 * Turns a completed Helm answer set into a real RecommendationResult —
 * the client-side counterpart to api/route.ts and the District scraper.
 * This is where "static app fed by a robot" meets "one genuinely live,
 * per-user call": venue/showtime data is baked into the build (static
 * JSON imports below), but travel time is fetched live per request.
 *
 * CANDIDATES ARE VENUE x FORMAT x SHOW, not just venue. Every reachable
 * show is scored as a complete plan; the engine never picks one show per
 * format before comparing the trade-offs. A venue with an IMAX flagship
 * screen and a ₹310 recliner show therefore produces distinct candidates
 * with distinct experience, price, timing, and feasibility inputs. Route
 * outbound calls are still deduplicated per venue; show-specific transit
 * checks are capped to the most competitive plans.
 *
 * JOURNEY-HOME MODEL:
 *
 * Every show is first scored with a conservative cab-home fallback. The
 * plans with the strongest possible live-transit score are then checked
 * against Google's schedule at film-end plus a realistic theatre-exit
 * buffer and rescored. A live route, a confirmed no-route response, and a
 * lookup failure remain distinct evidence states in the UI.
 *
 * HONEST SIMPLIFICATIONS STILL IN PLACE:
 *
 * 1. Cab fare is an UNCALIBRATED placeholder formula (BRIEF.md's planned
 *    hand-calibration against real fare apps hasn't happened yet) — see
 *    estimateCabFare().
 *
 * 2. Google does not always return a transit fare. When that happens the
 *    model uses a labelled ₹60 estimate rather than pretending it is live.
 *
 * 3. Ticket price always uses the chosen show's cheapest bookable seat
 *    class (priceRange.min from the scraper), regardless of intent — a
 *    richer version might prefer a premium seat for "The Full Epic."
 *    Future work.
 */

import venuesData from "../../data/venues-curated.json";
import showtimesData from "../../data/showtimes-live.json";
import { scoreVenue, INTENTS, type IntentId, type ScoreResult, type UserContext } from "../scoring/score";
import type { Origin, WhenChoice } from "../components/helm/types";
import type { RecommendationResult } from "../types/recommendation";

const FILM_RUNTIME_MINUTES = 172; // BRIEF.md — The Odyssey's runtime
const THEATRE_EXIT_BUFFER_MINUTES = 15;
const TRANSIT_FINALIST_LIMIT = 12;
const TRANSIT_FARE_FALLBACK_RUPEES = 60;

// Uncalibrated placeholder — see module doc comment #1.
const CAB_BASE_FARE_RUPEES = 60;
const CAB_PER_KM_RUPEES = 18;

// "Makeable tonight" gate — see module doc §Makeable filter.
const MAKEABLE_BASELINE_BUFFER_MINUTES = 40;
const MAKEABLE_ROUTE_BUFFER_MINUTES = 15;

// valueComparison only fires when the venue's other format is a genuinely
// different experience, not a rounding difference.
const VALUE_COMPARISON_MIN_GAP = 15;

interface CuratedVenue {
  id: string;
  name: string;
  locality: string;
  city: string;
  score: number;
  editorial_verdict: string;
  flagship_format: string;
  coords?: { lat: number; lng: number } | null;
  coords_verified?: { lat: number; lng: number };
}

/** One live showtime, as scraped. Exported so buildRecommendation.test.ts
 * can construct fixtures for the pure helpers below. */
export interface Show {
  date: string; // "2026-07-22"
  time: string; // "4:50 PM"
  format: string;
  availability: string | null;
  priceRange: { min: number; max: number } | null;
  seatsAvailable: number | null;
  seatsTotal: number | null;
  cheapestSeatClassLabel: string | null;
}

interface VenueShowtimes {
  venueId: string;
  districtUrl: string | null;
  showtimes: Show[];
  error?: string;
}

interface VenuesCuratedData {
  shortlist: CuratedVenue[];
  format_scores: Record<string, number>;
  format_score_default: number;
  format_warnings: Record<string, string>;
}

interface ShowtimesLiveData {
  _meta: { generatedAt: string; datesCovered: string[] };
  venues: Record<string, VenueShowtimes>;
}

interface RouteApiResponse {
  source: "live" | "estimated" | "unavailable";
  durationMinutes?: number;
  distanceKm?: number;
  reasonCode?: "not_configured" | "no_route" | "service_error";
  transit?: {
    departureTime: string;
    departureStop: string;
    lineName: string;
    lineColorHex?: string;
    vehicleType?: string;
    fareRupees?: number;
  };
}

interface ResolvedRoute {
  source: "live" | "estimated";
  durationMinutes: number;
  distanceKm: number;
}

type ReturnEvidence = "live" | "no-route" | "unverified";

interface ReturnJourney {
  evidence: ReturnEvidence;
  durationMinutes: number;
  costRupees: number;
  costIsEstimate: boolean;
  departureTime?: string;
  departureStop?: string;
  lineName?: string;
  lineColorHex?: string;
  vehicleType?: string;
}

/** One scored candidate (venue x format x show), shaped for the dossier/map
 * explorer — every field here is a real number the scoring engine actually
 * used, not a display-only summary invented separately. */
export interface DossierEntry {
  /** Stable within one recommendation; also prevents React key collisions
   * now that one venue+format can contribute several showtime plans. */
  planId: string;
  venueId: string;
  venueName: string;
  format: string;
  coords: { lat: number; lng: number };
  experienceScore: number;
  priceRupees: number;
  showtime: string;
  dateLabel: string;
  distanceKm: number;
  durationMinutes: number;
  totalCostRupees: number;
  totalScore: number;
  seatsAvailable: number | null;
  seatsTotal: number | null;
  availability: string | null;
  isWinner: boolean;
  isRunnerUp: boolean;
  returnEvidence: ReturnEvidence;
  /** Present for 4DX candidates — they're never eligible to win, but still
   * appear in the dossier carrying the reason why. */
  warning?: string;
}

export type BuildRecommendationResult =
  | { ok: true; result: RecommendationResult; dossier: DossierEntry[] }
  | { ok: false; reason: string };

function getVenueCoords(v: CuratedVenue): { lat: number; lng: number } | null {
  if (v.coords) return v.coords;
  if (v.coords_verified) return v.coords_verified;
  return null;
}

/** "4:50 PM" -> minutes since midnight. */
function parseTimeToMinutes(time12h: string): number {
  const [time, period] = time12h.split(" ");
  const [hStr, mStr] = time.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return h * 60 + m;
}

function minutesTo12h(totalMinutes: number): string {
  const wrapped = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h24 = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  let h = h24 % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, "0")} ${period}`;
}

function formatDateLabel(isoDate: string): string {
  // "2026-07-21" -> "TUE JUL 21" (en-US's default format inserts a comma
  // after the day-of-week name — stripped explicitly to match DESIGN.md's card copy)
  const d = new Date(`${isoDate}T00:00:00`);
  return d
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    .toUpperCase()
    .replace(",", "");
}

function formatFreshnessLabel(fetchedAtIso: string): string {
  const time = new Date(fetchedAtIso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  });
  return `AS OF ${time}`;
}

/** Uncalibrated placeholder — see module doc comment #3. */
function estimateCabFare(distanceKm: number): number {
  return Math.round((CAB_BASE_FARE_RUPEES + CAB_PER_KM_RUPEES * distanceKm) / 10) * 10;
}

/** The earliest realistic time a person can start the trip home. The date
 * rollover is handled by Date, so a late show on Friday can correctly ask
 * for a Saturday-after-midnight transit route. */
export function departureTimeForShow(show: Pick<Show, "date" | "time">): string {
  const midnightIst = new Date(`${show.date}T00:00:00+05:30`);
  const departureMinutes =
    parseTimeToMinutes(show.time) + FILM_RUNTIME_MINUTES + THEATRE_EXIT_BUFFER_MINUTES;
  return new Date(midnightIst.getTime() + departureMinutes * 60_000).toISOString();
}

function journeyKeyOf(candidate: Pick<FinalCandidate, "venue" | "show">): string {
  return `${candidate.venue.id}|${candidate.show.date}|${candidate.show.time}`;
}

function formatTransitTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

async function fetchRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<ResolvedRoute | null> {
  try {
    const res = await fetch("/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin, destination, mode: "DRIVE" }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as RouteApiResponse;
    if (
      (data.source !== "live" && data.source !== "estimated") ||
      typeof data.durationMinutes !== "number" ||
      typeof data.distanceKm !== "number"
    ) {
      return null;
    }
    return { source: data.source, durationMinutes: data.durationMinutes, distanceKm: data.distanceKm };
  } catch {
    return null; // network error — this venue just gets excluded, not guessed
  }
}

async function fetchTransitHome(
  venue: { lat: number; lng: number },
  origin: { lat: number; lng: number },
  departureTime: string,
  cabRoute: ResolvedRoute
): Promise<ReturnJourney> {
  const cabFallback: ReturnJourney = {
    evidence: "unverified",
    durationMinutes: cabRoute.durationMinutes,
    costRupees: estimateCabFare(cabRoute.distanceKm),
    costIsEstimate: true,
  };

  try {
    const res = await fetch("/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: venue,
        destination: origin,
        mode: "TRANSIT",
        departureTime,
      }),
    });
    if (!res.ok) return cabFallback;
    const data = (await res.json()) as RouteApiResponse;
    if (data.source === "unavailable") {
      return { ...cabFallback, evidence: data.reasonCode === "no_route" ? "no-route" : "unverified" };
    }
    if (
      data.source !== "live" ||
      typeof data.durationMinutes !== "number" ||
      !data.transit?.departureTime ||
      !data.transit.departureStop ||
      !data.transit.lineName
    ) {
      return cabFallback;
    }

    return {
      evidence: "live",
      durationMinutes: data.durationMinutes,
      costRupees: data.transit.fareRupees ?? TRANSIT_FARE_FALLBACK_RUPEES,
      costIsEstimate: data.transit.fareRupees === undefined,
      departureTime: data.transit.departureTime,
      departureStop: data.transit.departureStop,
      lineName: data.transit.lineName,
      lineColorHex: data.transit.lineColorHex,
      vehicleType: data.transit.vehicleType,
    };
  } catch {
    return cabFallback;
  }
}

// ---------------------------------------------------------------------------
// Pure helpers — no fetch, no Date.now() reads. Exported for
// buildRecommendation.test.ts.
// ---------------------------------------------------------------------------

/** "Now" read as IST wall-clock fields via UTC getters on a shifted Date —
 * host-timezone independent. Callers build `nowIst` once with
 * `new Date(Date.now() + 330 * 60 * 1000)` and pass it down; nothing below
 * this point reads the clock itself. */
export function isoDateOf(nowIst: Date): string {
  const y = nowIst.getUTCFullYear();
  const m = String(nowIst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(nowIst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDateOf(d);
}

function isWeekendIso(iso: string): boolean {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

/** Resolves a WhenChoice + "now" into the concrete IST dates to look
 * showtimes up for. Weekend picks whichever of `datesCovered` are Sat/Sun
 * and not already in the past. */
export function computeTargetDates(when: WhenChoice, nowIst: Date, datesCovered: string[]): string[] {
  const today = isoDateOf(nowIst);
  if (when === "tonight") return [today];
  if (when === "tomorrow") return [addDaysIso(today, 1)];
  return datesCovered.filter((d) => d >= today && isWeekendIso(d)).sort();
}

/** `format === venue's flagship format` uses the venue's own curated score;
 * anything else falls back to the shared per-format table, then the E-tier
 * default. This is the fix for the "recliner show scored like IMAX" bug. */
export function resolveExperienceScore(
  flagshipFormat: string,
  flagshipScore: number,
  format: string,
  formatScores: Record<string, number>,
  formatScoreDefault: number
): number {
  if (format === flagshipFormat) return flagshipScore;
  return formatScores[format] ?? formatScoreDefault;
}

/** Drops shows starting before `nowMinutesOfDay + bufferMinutes` — the
 * "can I actually still make it" baseline gate, applied to `tonight` only.
 * `shows` are assumed to already be same-day (tonight only ever targets
 * one date), so time-of-day comparison alone is correct. */
export function filterMakeableShows(shows: Show[], nowMinutesOfDay: number, bufferMinutes: number): Show[] {
  return shows.filter((s) => parseTimeToMinutes(s.time) >= nowMinutesOfDay + bufferMinutes);
}

/** 4DX candidates are never eligible to be winner or runner-up (the motion
 * seats fight this film's camerawork) — they still appear in the dossier,
 * carrying a warning instead. */
export function isFourDxFormat(format: string): boolean {
  return format.includes("4DX");
}

/** Returns every show that survives the exact route-aware makeability gate.
 * Non-tonight dates have no clock-based gate; for tonight, a show must start
 * after the live drive time plus a small arrival buffer. Keeping this helper
 * plural is intentional: no intent-specific preselection happens before the
 * complete plans reach scoreVenue(). */
export function viableShowsForRoute(
  shows: Show[],
  when: WhenChoice,
  nowMinutesOfDay: number,
  routeDurationMinutes: number
): Show[] {
  if (when !== "tonight") return shows;
  const cutoff = nowMinutesOfDay + routeDurationMinutes + MAKEABLE_ROUTE_BUFFER_MINUTES;
  return shows.filter((show) => parseTimeToMinutes(show.time) >= cutoff);
}

function compareShowsChronologically(a: Show, b: Show): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time);
}

// ---------------------------------------------------------------------------
// Candidate assembly
// ---------------------------------------------------------------------------

interface RawCandidate {
  venue: CuratedVenue;
  coords: { lat: number; lng: number };
  format: string;
  experienceScore: number;
  districtUrl: string | null;
  /** All matching shows on the target dates for this venue+format,
   * chronologically sorted. Kept around (not just the chosen show) so the
   * tonight route-recheck can advance to the next passing one. */
  shows: Show[];
}

interface RoutedCandidate extends RawCandidate {
  route: ResolvedRoute;
}

interface FinalCandidate extends Omit<RoutedCandidate, "shows"> {
  show: Show;
}

interface Scored {
  candidate: FinalCandidate;
  cabFare: number;
  returnJourney: ReturnJourney;
  showEndMinutes: number;
  score: ScoreResult;
}

function scoreCandidateWithReturn(
  candidate: FinalCandidate,
  returnJourney: ReturnJourney,
  intentWeights: (typeof INTENTS)[IntentId]
): Scored {
  const cabFare = estimateCabFare(candidate.route.distanceKm);
  const showEndMinutes = parseTimeToMinutes(candidate.show.time) + FILM_RUNTIME_MINUTES;
  const context: UserContext = {
    ticketPriceRupeesPerPerson: candidate.show.priceRange!.min,
    outboundTransportCostRupees: cabFare,
    returnTransportCostRupees: returnJourney.costRupees,
    outboundDurationMinutes: candidate.route.durationMinutes,
    returnDurationMinutes: returnJourney.durationMinutes,
    returnAvailable: returnJourney.evidence === "live",
  };
  const score = scoreVenue(
    { id: candidate.venue.id, name: candidate.venue.name, experienceScore: candidate.experienceScore },
    context,
    intentWeights
  );
  return { candidate, cabFare, returnJourney, showEndMinutes, score };
}

function buildJourneyLegs(scored: Scored) {
  const outbound = {
    lineLabel: "CAB",
    lineColorHex: "#2E6E73", // --sea — neutral "journey" color, not a fabricated metro line
    durationMinutes: scored.candidate.route.durationMinutes,
    costRupees: scored.cabFare,
    costIsEstimate: true,
  };

  const showEnd = minutesTo12h(scored.showEndMinutes);
  const returnJourney = scored.returnJourney;
  const isLive = returnJourney.evidence === "live";
  const isNoRoute = returnJourney.evidence === "no-route";
  const returnHeadline = isLive
    ? `Route home found: ${formatTransitTime(returnJourney.departureTime!)} from ${returnJourney.departureStop}.`
    : isNoRoute
      ? `No public-transport route found after the ${showEnd} finish.`
      : `Public transport after the ${showEnd} finish could not be verified.`;

  const returnLeg = {
    lineLabel: isLive ? returnJourney.lineName! : "CAB",
    lineColorHex: isLive ? returnJourney.lineColorHex ?? "#C9A227" : "#2E6E73",
    durationMinutes: returnJourney.durationMinutes,
    costRupees: returnJourney.costRupees,
    costIsEstimate: returnJourney.costIsEstimate,
    status: (isLive ? "good" : isNoRoute ? "stranded" : "unverified") as
      | "good"
      | "stranded"
      | "unverified",
    headline: returnHeadline,
    ...(isLive
      ? {
          evidenceLabel: `${returnJourney.lineName}${
            returnJourney.vehicleType ? ` · ${returnJourney.vehicleType.replaceAll("_", " ")}` : ""
          } · SHOW ENDS ~${showEnd}`,
        }
      : { cabFallbackLabel: `Cab back ≈ ₹${scored.cabFare}` }),
  };

  return { outbound, returnLeg };
}

function buildWhyLine(winner: Scored, runnerUp: Scored | undefined): string {
  if (!runnerUp) {
    return "The only venue with a matching showtime for this window right now.";
  }
  const costDiff = runnerUp.score.costPerPersonRupees - winner.score.costPerPersonRupees;
  const timeDiff = runnerUp.candidate.route.durationMinutes - winner.candidate.route.durationMinutes;

  if (Math.abs(costDiff) >= Math.abs(timeDiff) && Math.abs(costDiff) >= 50) {
    return costDiff > 0
      ? `Beats ${runnerUp.candidate.venue.name} by ₹${Math.round(costDiff)} for a comparable experience.`
      : `Costs ₹${Math.round(-costDiff)} more than ${runnerUp.candidate.venue.name}, but scored higher overall for this intent.`;
  }
  if (Math.abs(timeDiff) >= 5) {
    return timeDiff > 0
      ? `About ${Math.round(timeDiff)} min closer than ${runnerUp.candidate.venue.name}.`
      : `A bit further than ${runnerUp.candidate.venue.name}, but scored higher overall for this intent.`;
  }
  return `Edged out ${runnerUp.candidate.venue.name} on balance for this intent.`;
}

function seatsLineOf(show: Show): string | undefined {
  if (show.seatsAvailable == null || show.seatsTotal == null) return undefined;
  const base = `${show.seatsAvailable} OF ${show.seatsTotal} SEATS LEFT`;
  return show.availability ? `${base} · ${show.availability.toUpperCase()}` : base;
}

function whenLabelOf(when: WhenChoice): string {
  if (when === "tonight") return "tonight";
  if (when === "tomorrow") return "tomorrow";
  return "this weekend";
}

export async function buildRecommendation(
  origin: Origin,
  when: WhenChoice,
  intentId: IntentId
): Promise<BuildRecommendationResult> {
  const { shortlist: venues, format_scores: formatScores, format_score_default: formatScoreDefault, format_warnings: formatWarnings } =
    venuesData as unknown as VenuesCuratedData;
  const { venues: showtimesByVenue, _meta: meta } = showtimesData as unknown as ShowtimesLiveData;

  const nowIst = new Date(Date.now() + 330 * 60 * 1000);
  const targetDates = computeTargetDates(when, nowIst, meta.datesCovered);

  if (when === "weekend" && targetDates.length === 0) {
    return {
      ok: false,
      reason: "District hasn't published this weekend's schedule yet — try Tonight or Tomorrow.",
    };
  }

  // --- Assemble venue x format candidates from live showtimes on the target dates ---
  const rawCandidates: RawCandidate[] = [];
  // provenance: every showtime on the target dates, across every venue,
  // counted before any selection/filtering — the dossier's honesty number.
  let showsConsideredTotal = 0;
  for (const venue of venues) {
    const coords = getVenueCoords(venue);
    if (!coords) continue; // no verified coordinates yet — excluded, not guessed

    const venueShowtimes = showtimesByVenue[venue.id];
    if (!venueShowtimes || venueShowtimes.error || venueShowtimes.showtimes.length === 0) continue;

    const onTargetDates = venueShowtimes.showtimes.filter(
      (s) => targetDates.includes(s.date) && s.priceRange !== null
    );
    showsConsideredTotal += onTargetDates.length;
    if (onTargetDates.length === 0) continue;

    const byFormat = new Map<string, Show[]>();
    for (const s of onTargetDates) {
      const list = byFormat.get(s.format);
      if (list) list.push(s);
      else byFormat.set(s.format, [s]);
    }

    for (const [format, shows] of byFormat) {
      shows.sort(compareShowsChronologically);
      const experienceScore = resolveExperienceScore(
        venue.flagship_format,
        venue.score,
        format,
        formatScores,
        formatScoreDefault
      );
      rawCandidates.push({
        venue,
        coords,
        format,
        experienceScore,
        districtUrl: venueShowtimes.districtUrl,
        shows,
      });
    }
  }

  // --- Makeable filter (tonight only): drop shows that can't be reached at all ---
  const nowMinutesOfDay = nowIst.getUTCHours() * 60 + nowIst.getUTCMinutes();
  const candidates =
    when === "tonight"
      ? rawCandidates
          .map((c) => ({
            ...c,
            shows: filterMakeableShows(c.shows, nowMinutesOfDay, MAKEABLE_BASELINE_BUFFER_MINUTES),
          }))
          .filter((c) => c.shows.length > 0)
      : rawCandidates;

  if (candidates.length === 0) {
    return {
      ok: false,
      reason: `No showtimes found in our data for ${whenLabelOf(when)}. Try a different window.`,
    };
  }

  // --- Live routes, fetched once per unique venue (not per candidate) ---
  const uniqueVenueIds = [...new Set(candidates.map((c) => c.venue.id))];
  const routeResults = await Promise.all(
    uniqueVenueIds.map((id) => fetchRoute(origin, candidates.find((c) => c.venue.id === id)!.coords))
  );
  const routeByVenue = new Map<string, ResolvedRoute | null>();
  uniqueVenueIds.forEach((id, i) => routeByVenue.set(id, routeResults[i]));

  // --- Finalize: attach the live route, then expand every venue+format into
  //     every show that survives the exact route-aware makeability gate. ---
  const finalCandidates: FinalCandidate[] = [];
  for (const c of candidates) {
    const route = routeByVenue.get(c.venue.id) ?? null;
    if (!route) continue; // this venue's live route call failed — skip, don't guess
    const viableShows = viableShowsForRoute(c.shows, when, nowMinutesOfDay, route.durationMinutes);
    for (const show of viableShows) {
      finalCandidates.push({
        venue: c.venue,
        coords: c.coords,
        format: c.format,
        experienceScore: c.experienceScore,
        districtUrl: c.districtUrl,
        show,
        route,
      });
    }
  }

  if (finalCandidates.length === 0) {
    return { ok: false, reason: "Couldn't reach live travel times for any matching venue just now. Try again." };
  }

  // --- Score every viable show plan with a conservative cab-home fallback.
  //     Then spend live transit calls only on the plans with the strongest
  //     possible score if public transport is available. No show is removed
  //     before scoring, and the bounded shortlist is based on score potential
  //     rather than one preselected show per venue/format. ---
  const intentWeights = INTENTS[intentId];
  const fallbackScored = finalCandidates.map((candidate) => {
    const cabFare = estimateCabFare(candidate.route.distanceKm);
    return scoreCandidateWithReturn(
      candidate,
      {
        evidence: "unverified",
        durationMinutes: candidate.route.durationMinutes,
        costRupees: cabFare,
        costIsEstimate: true,
      },
      intentWeights
    );
  });

  const finalistPotential = new Map<string, { candidate: FinalCandidate; optimisticScore: number }>();
  for (const fallback of fallbackScored) {
    if (isFourDxFormat(fallback.candidate.format)) continue;
    const optimistic = scoreCandidateWithReturn(
      fallback.candidate,
      {
        evidence: "live",
        durationMinutes: 1,
        costRupees: 0,
        costIsEstimate: false,
      },
      intentWeights
    );
    const key = journeyKeyOf(fallback.candidate);
    const prior = finalistPotential.get(key);
    if (!prior || optimistic.score.totalScore > prior.optimisticScore) {
      finalistPotential.set(key, {
        candidate: fallback.candidate,
        optimisticScore: optimistic.score.totalScore,
      });
    }
  }

  const transitFinalists = [...finalistPotential.entries()]
    .sort((a, b) => b[1].optimisticScore - a[1].optimisticScore)
    .slice(0, TRANSIT_FINALIST_LIMIT);
  const transitResults = await Promise.all(
    transitFinalists.map(([, { candidate }]) =>
      fetchTransitHome(
        candidate.coords,
        origin,
        departureTimeForShow(candidate.show),
        candidate.route
      )
    )
  );
  const transitByJourney = new Map<string, ReturnJourney>();
  transitFinalists.forEach(([key], index) => transitByJourney.set(key, transitResults[index]));

  const scored: Scored[] = fallbackScored.map((fallback) => {
    const transit = transitByJourney.get(journeyKeyOf(fallback.candidate));
    return transit
      ? scoreCandidateWithReturn(fallback.candidate, transit, intentWeights)
      : fallback;
  });

  // --- 4DX is never eligible to win or runner-up ---
  const eligible = scored.filter((s) => !isFourDxFormat(s.candidate.format));
  if (eligible.length === 0) {
    return { ok: false, reason: "Only 4DX showtimes turned up for this window — try a different one." };
  }
  eligible.sort((a, b) => b.score.totalScore - a.score.totalScore);

  const winner = eligible[0];
  const runnerUp = eligible.find((s) => s.candidate.venue.id !== winner.candidate.venue.id);

  // --- valueComparison: Worth Every Rupee only, same venue, meaningfully different format ---
  let valueComparison: RecommendationResult["valueComparison"];
  if (intentId === "worth-every-rupee") {
    const sameVenueOthers = eligible.filter(
      (s) =>
        s.candidate.venue.id === winner.candidate.venue.id &&
        s.candidate.format !== winner.candidate.format &&
        !isFourDxFormat(s.candidate.format)
    );
    if (sameVenueOthers.length > 0) {
      const bestOther = sameVenueOthers.reduce((best, s) =>
        s.score.totalScore > best.score.totalScore ? s : best
      );
      const gap = Math.abs(winner.candidate.experienceScore - bestOther.candidate.experienceScore);
      if (gap >= VALUE_COMPARISON_MIN_GAP) {
        const winnerEntry = {
          format: winner.candidate.format,
          priceLabel: `₹${winner.candidate.show.priceRange!.min.toLocaleString("en-IN")}`,
          experienceScore: winner.candidate.experienceScore,
          showtime: winner.candidate.show.time,
        };
        const otherEntry = {
          format: bestOther.candidate.format,
          priceLabel: `₹${bestOther.candidate.show.priceRange!.min.toLocaleString("en-IN")}`,
          experienceScore: bestOther.candidate.experienceScore,
          showtime: bestOther.candidate.show.time,
        };
        const [premium, budget] =
          winnerEntry.experienceScore >= otherEntry.experienceScore
            ? [winnerEntry, otherEntry]
            : [otherEntry, winnerEntry];
        valueComparison = {
          premium,
          budget,
          priceDiffRupees: Math.abs(
            winner.candidate.show.priceRange!.min - bestOther.candidate.show.priceRange!.min
          ),
        };
      }
    }
  }

  const { outbound, returnLeg } = buildJourneyLegs(winner);

  // provenance: unique venues that made it into `scored` (i.e. produced at
  // least one scored candidate), not just the ones that survived to `eligible`.
  const venuesChecked = new Set(scored.map((s) => s.candidate.venue.id)).size;
  const routeSource = scored.every((s) => s.candidate.route.source === "live") ? "live" : "estimated";

  const result: RecommendationResult = {
    intentLabel: intentWeights.label.toUpperCase(),
    freshnessLabel: formatFreshnessLabel(meta.generatedAt),
    venueName: winner.candidate.venue.name,
    formatChip: winner.candidate.format,
    verdict: winner.candidate.venue.editorial_verdict,
    showtime: winner.candidate.show.time,
    dateLabel: formatDateLabel(winner.candidate.show.date),
    seatClass: winner.candidate.show.cheapestSeatClassLabel ?? "SEATS",
    priceLabel: `₹${winner.candidate.show.priceRange!.min.toLocaleString("en-IN")}`,
    journey: {
      outbound,
      return: returnLeg,
      totalCostRupees: winner.score.totalCostRupees,
    },
    whyLine: buildWhyLine(winner, runnerUp),
    runnerUp: runnerUp
      ? {
          venueName: runnerUp.candidate.venue.name,
          locality: runnerUp.candidate.venue.locality,
          formatChip: runnerUp.candidate.format,
          priceLabel: `₹${runnerUp.candidate.show.priceRange!.min.toLocaleString("en-IN")}`,
          showtime: runnerUp.candidate.show.time,
          score: runnerUp.score,
        }
      : undefined,
    score: winner.score,
    // Fallback covers the type's null possibility (shouldn't happen for the 15
    // curated venues in practice) — a generic search beats a dead button.
    districtUrl: winner.candidate.districtUrl ?? "https://www.district.in/movies/the-odyssey-movie-tickets-in-delhi-ncr-MV187151",
    valueComparison,
    seatsLine: seatsLineOf(winner.candidate.show),
    directionsUrl: `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${winner.candidate.coords.lat},${winner.candidate.coords.lng}`,
    provenance: {
      venuesChecked,
      showsConsidered: showsConsideredTotal,
      plansScored: scored.length,
      routeSource,
      transitPlansChecked: transitFinalists.length,
      returnEvidence: winner.returnJourney.evidence,
    },
  };

  const dossier: DossierEntry[] = scored
    .map((s, sourceIndex) => ({
      planId: `${s.candidate.venue.id}|${s.candidate.format}|${s.candidate.show.date}|${s.candidate.show.time}|${sourceIndex}`,
      venueId: s.candidate.venue.id,
      venueName: s.candidate.venue.name,
      format: s.candidate.format,
      coords: s.candidate.coords,
      experienceScore: s.candidate.experienceScore,
      priceRupees: s.candidate.show.priceRange!.min,
      showtime: s.candidate.show.time,
      dateLabel: formatDateLabel(s.candidate.show.date),
      distanceKm: s.candidate.route.distanceKm,
      durationMinutes: s.candidate.route.durationMinutes,
      totalCostRupees: s.score.totalCostRupees,
      totalScore: s.score.totalScore,
      seatsAvailable: s.candidate.show.seatsAvailable,
      seatsTotal: s.candidate.show.seatsTotal,
      availability: s.candidate.show.availability,
      isWinner: s === winner,
      isRunnerUp: s === runnerUp,
      returnEvidence: s.returnJourney.evidence,
      warning: isFourDxFormat(s.candidate.format) ? formatWarnings["4DX-2D"] : undefined,
    }))
    .sort((a, b) => b.totalScore - a.totalScore);

  return { ok: true, result, dossier };
}
