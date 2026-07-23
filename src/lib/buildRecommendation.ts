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
import { buildRecommendationNarrative, buildValueComparison, type NarrativePlan } from "./recommendationNarrative";
import { getScreenProof } from "./formatProfiles";
import type { Origin, WhenChoice } from "../components/helm/types";
import type {
  CounterfactualAlternative,
  EveningMoment,
  EveningTimeline,
  RecommendationEvidence,
  RecommendationResult,
  ReturnFallbackReason,
  ReturnEvidenceStatus,
} from "../types/recommendation";

const FILM_RUNTIME_MINUTES = 172; // BRIEF.md — The Odyssey's runtime
const THEATRE_EXIT_BUFFER_MINUTES = 15;
const TRANSIT_FINALIST_LIMIT = 12;
const TRANSIT_FARE_FALLBACK_RUPEES = 60;
export const MAX_METRO_DEPARTURE_DELAY_MINUTES = 45;

// Uncalibrated placeholder — see module doc comment #1.
const CAB_BASE_FARE_RUPEES = 60;
const CAB_PER_KM_RUPEES = 18;

// "Makeable tonight" gate — see module doc §Makeable filter.
const MAKEABLE_BASELINE_BUFFER_MINUTES = 40;
const MAKEABLE_ROUTE_BUFFER_MINUTES = 15;

// Retained solely as a candidate gate; the narrative module owns all language
// about a format comparison.
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
  reasonCode?: "not_configured" | "no_route" | "no_metro_route" | "service_error";
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

type ReturnEvidence = ReturnEvidenceStatus;

interface ReturnJourney extends TimelineReturnJourney {
  evidence: ReturnEvidence;
  costRupees: number;
  costIsEstimate: boolean;
  departureStop?: string;
  lineName?: string;
  lineColorHex?: string;
  vehicleType?: string;
  fallbackReason?: ReturnFallbackReason;
  cabEstimateAvailable: boolean;
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
interface CabEstimate {
  amountRupees: number;
  available: boolean;
}

/** The price formula is an approximation. This availability guard prevents a
 * malformed route from turning into a blank or invented cab price. */
function estimateCabFare(distanceKm: number, context: string): CabEstimate {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    console.error("[ithaka mobility] Cab estimate unavailable: invalid route distance", { context, distanceKm });
    return { amountRupees: 0, available: false };
  }
  return {
    amountRupees: Math.round((CAB_BASE_FARE_RUPEES + CAB_PER_KM_RUPEES * distanceKm) / 10) * 10,
    available: true,
  };
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

/** A returned route can be technically valid but start after morning service
 * resumes. A metro departure must be part of the same night to be usable. */
export function isTimelyMetroDeparture(theatreExitTime: string, metroDepartureTime: string): boolean {
  const theatreExitMs = Date.parse(theatreExitTime);
  const metroDepartureMs = Date.parse(metroDepartureTime);
  if (!Number.isFinite(theatreExitMs) || !Number.isFinite(metroDepartureMs)) return false;
  const waitMinutes = (metroDepartureMs - theatreExitMs) / 60_000;
  return waitMinutes >= -1 && waitMinutes <= MAX_METRO_DEPARTURE_DELAY_MINUTES;
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
  const cabEstimate = estimateCabFare(cabRoute.distanceKm, "return-home fallback");
  const cabFallbackFor = (evidence: ReturnEvidence, fallbackReason: ReturnFallbackReason): ReturnJourney => ({
    evidence,
    durationMinutes: cabRoute.durationMinutes,
    costRupees: cabEstimate.amountRupees,
    costIsEstimate: true,
    cabEstimateAvailable: cabEstimate.available,
    fallbackReason,
  });
  const cabFallback: ReturnJourney = {
    ...cabFallbackFor("unverified", "lookup-unavailable"),
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
      return data.reasonCode === "no_route" || data.reasonCode === "no_metro_route"
        ? cabFallbackFor("no-route", "no-metro-route")
        : cabFallback;
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
    if (data.transit.vehicleType !== "SUBWAY") {
      console.error("[ithaka mobility] Rejected non-metro route returned by the route API", {
        vehicleType: data.transit.vehicleType,
      });
      return cabFallbackFor("no-route", "no-metro-route");
    }
    if (!isTimelyMetroDeparture(departureTime, data.transit.departureTime)) {
      console.info("[ithaka mobility] Rejected metro route after excessive wait", {
        theatreExit: departureTime,
        metroDeparture: data.transit.departureTime,
        maxWaitMinutes: MAX_METRO_DEPARTURE_DELAY_MINUTES,
      });
      return cabFallbackFor("no-route", "metro-too-late");
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
      cabEstimateAvailable: cabEstimate.available,
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

/** Minimal public shape needed to derive the timeline. Keeping it separate
 * from the routing response makes the itinerary testable without fetch. */
export interface TimelineReturnJourney {
  evidence: ReturnEvidenceStatus;
  durationMinutes: number;
  departureTime?: string;
}

function showStartTimeForShow(show: Pick<Show, "date" | "time">): Date {
  const midnightIst = new Date(`${show.date}T00:00:00+05:30`);
  return new Date(midnightIst.getTime() + parseTimeToMinutes(show.time) * 60_000);
}

function dayOffsetFromShow(moment: Date, showStart: Date): number {
  // Shift both instants into IST before taking the calendar-day bucket. This
  // is intentionally not duration/24h: a midnight crossing is what matters
  // to a person scanning the itinerary.
  const istOffsetMs = 330 * 60 * 1000;
  return (
    Math.floor((moment.getTime() + istOffsetMs) / (24 * 60 * 60 * 1000)) -
    Math.floor((showStart.getTime() + istOffsetMs) / (24 * 60 * 60 * 1000))
  );
}

function eveningMoment(label: string, moment: Date, showStart: Date): EveningMoment {
  return {
    label,
    time: formatTransitTime(moment.toISOString()),
    isoTime: moment.toISOString(),
    dayOffset: dayOffsetFromShow(moment, showStart),
  };
}

/**
 * Builds the whole night around a specific screening. The pre-film arrival
 * allowance matches the exact 15-minute buffer used by tonight's makeability
 * gate; it is not decorative padding. Scheduled public transport is the only
 * condition under which an exact return departure/home-arrival is shown.
 */
export function buildEveningTimeline(
  show: Pick<Show, "date" | "time">,
  outboundDurationMinutes: number,
  returnJourney: TimelineReturnJourney
): EveningTimeline {
  const showStart = showStartTimeForShow(show);
  const arriveAtTheatre = new Date(showStart.getTime() - MAKEABLE_ROUTE_BUFFER_MINUTES * 60_000);
  const leaveHome = new Date(arriveAtTheatre.getTime() - outboundDurationMinutes * 60_000);
  const filmEnds = new Date(showStart.getTime() + FILM_RUNTIME_MINUTES * 60_000);
  const theatreExit = new Date(filmEnds.getTime() + THEATRE_EXIT_BUFFER_MINUTES * 60_000);
  const scheduledDeparture =
    returnJourney.evidence === "live" && returnJourney.departureTime
      ? new Date(returnJourney.departureTime)
      : undefined;
  const homeArrival = scheduledDeparture
    ? new Date(scheduledDeparture.getTime() + returnJourney.durationMinutes * 60_000)
    : undefined;

  return {
    timezone: "Asia/Kolkata",
    theatreExitBufferMinutes: THEATRE_EXIT_BUFFER_MINUTES,
    leaveHome: eveningMoment("LEAVE HOME", leaveHome, showStart),
    arriveAtTheatre: eveningMoment("AT THEATRE", arriveAtTheatre, showStart),
    filmStarts: eveningMoment("FILM STARTS", showStart, showStart),
    filmEnds: eveningMoment("FILM ENDS", filmEnds, showStart),
    theatreExit: eveningMoment("THEATRE EXIT", theatreExit, showStart),
    ...(scheduledDeparture
      ? { returnDeparture: eveningMoment("RETURN DEPARTS", scheduledDeparture, showStart) }
      : {}),
    ...(homeArrival ? { homeArrival: eveningMoment("HOME", homeArrival, showStart) } : {}),
  };
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

function narrativePlanOf(scored: Scored): NarrativePlan & { showtime: string } {
  return {
    venueId: scored.candidate.venue.id,
    venueName: scored.candidate.venue.name,
    format: scored.candidate.format,
    experienceScore: scored.candidate.experienceScore,
    totalCostRupees: scored.score.totalCostRupees,
    outboundDurationMinutes: scored.candidate.route.durationMinutes,
    returnEvidence: scored.returnJourney.evidence,
    score: scored.score,
    showtime: scored.candidate.show.time,
  };
}

function scoreCandidateWithReturn(
  candidate: FinalCandidate,
  returnJourney: ReturnJourney,
  intentWeights: (typeof INTENTS)[IntentId]
): Scored {
  const cabFare = estimateCabFare(candidate.route.distanceKm, "outbound scoring").amountRupees;
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
    ? `Metro home: ${formatTransitTime(returnJourney.departureTime!)} from ${returnJourney.departureStop}.`
    : isNoRoute
      ? returnJourney.fallbackReason === "metro-too-late"
        ? `Metro does not run soon enough after the ${showEnd} finish.`
        : `No metro route after the ${showEnd} finish.`
      : `Metro after the ${showEnd} finish could not be verified.`;

  const returnLeg = {
    lineLabel: isLive ? returnJourney.lineName! : "CAB",
    lineColorHex: isLive ? returnJourney.lineColorHex ?? "#C9A227" : "#2E6E73",
    durationMinutes: returnJourney.durationMinutes,
    costRupees: returnJourney.costRupees,
    costIsEstimate: returnJourney.costIsEstimate,
    cabEstimateAvailable: returnJourney.cabEstimateAvailable,
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
          departureTime: returnJourney.departureTime,
          departureStop: returnJourney.departureStop,
          vehicleType: returnJourney.vehicleType,
        }
      : {
          cabFallbackLabel: returnJourney.cabEstimateAvailable
            ? `Cab back ≈ ₹${returnJourney.costRupees}`
            : "Cab price unavailable — check a ride app before leaving.",
          fallbackReason: returnJourney.fallbackReason,
        }),
  };

  return { outbound, returnLeg };
}

function seatsLineOf(show: Show): string | undefined {
  if (show.seatsAvailable == null || show.seatsTotal == null) return undefined;
  const base = `${show.seatsAvailable} OF ${show.seatsTotal} SEATS LEFT`;
  return show.availability ? `${base} · ${show.availability.toUpperCase()}` : base;
}

function projectedHomeArrival(scored: Scored): Date {
  // A live transit plan is a schedule-backed arrival. For fallback cases this
  // is deliberately only a projection: theatre exit plus the cab route
  // duration used by the score, never a promise of an actual cab ETA.
  const returnDeparture =
    scored.returnJourney.evidence === "live" && scored.returnJourney.departureTime
      ? new Date(scored.returnJourney.departureTime)
      : new Date(departureTimeForShow(scored.candidate.show));
  return new Date(returnDeparture.getTime() + scored.returnJourney.durationMinutes * 60_000);
}

function stablePlanTieBreak(a: Scored, b: Scored): number {
  const chronological = compareShowsChronologically(a.candidate.show, b.candidate.show);
  if (chronological !== 0) return chronological;
  return a.candidate.venue.name.localeCompare(b.candidate.venue.name);
}

function chooseCounterfactual(scored: Scored[], id: CounterfactualAlternative["id"]): Scored {
  return [...scored].sort((a, b) => {
    if (id === "picture-first") {
      const experienceDifference = b.candidate.experienceScore - a.candidate.experienceScore;
      if (experienceDifference !== 0) return experienceDifference;
      const scoreDifference = b.score.totalScore - a.score.totalScore;
      return scoreDifference !== 0 ? scoreDifference : stablePlanTieBreak(a, b);
    }
    if (id === "price-first") {
      const costDifference = a.score.costPerPersonRupees - b.score.costPerPersonRupees;
      if (costDifference !== 0) return costDifference;
      const experienceDifference = b.candidate.experienceScore - a.candidate.experienceScore;
      return experienceDifference !== 0 ? experienceDifference : stablePlanTieBreak(a, b);
    }

    const arrivalDifference = projectedHomeArrival(a).getTime() - projectedHomeArrival(b).getTime();
    if (arrivalDifference !== 0) return arrivalDifference;
    // Prefer evidence when two projected arrivals are the same minute.
    const evidenceRank: Record<ReturnEvidence, number> = { live: 0, unverified: 1, "no-route": 2 };
    const evidenceDifference = evidenceRank[a.returnJourney.evidence] - evidenceRank[b.returnJourney.evidence];
    return evidenceDifference !== 0 ? evidenceDifference : stablePlanTieBreak(a, b);
  })[0];
}

function counterfactualOf(
  selected: Scored,
  winner: Scored,
  id: CounterfactualAlternative["id"]
): CounterfactualAlternative {
  const projectedArrival = projectedHomeArrival(selected);
  const copy =
    id === "picture-first"
      ? {
          label: "IF PICTURE CAME FIRST",
          question: "What if the screen mattered more than every other trade-off?",
          metric: { label: "SCREEN SCORE", value: `${selected.candidate.experienceScore}/100` },
        }
      : id === "price-first"
        ? {
            label: "IF PRICE CAME FIRST",
            question: "What if the lowest complete-night cost was the only priority?",
            metric: {
              label: "TOTAL",
              value: `₹${selected.score.costPerPersonRupees.toLocaleString("en-IN")}`,
            },
          }
        : {
            label: "IF HOME EARLIEST MATTERED",
            question: "What if getting home earliest was the deciding factor?",
            metric: {
              label: selected.returnJourney.evidence === "live" ? "HOME BY" : "EST. HOME BY",
              value: formatTransitTime(projectedArrival.toISOString()),
            },
          };

  return {
    id,
    ...copy,
    venueName: selected.candidate.venue.name,
    locality: selected.candidate.venue.locality,
    formatChip: selected.candidate.format,
    showtime: selected.candidate.show.time,
    dateLabel: formatDateLabel(selected.candidate.show.date),
    priceLabel: `₹${selected.candidate.show.priceRange!.min.toLocaleString("en-IN")}`,
    totalCostRupees: selected.score.totalCostRupees,
    returnEvidence: selected.returnJourney.evidence,
    isCurrentRecommendation: selected === winner,
  };
}

function buildCounterfactuals(eligible: Scored[], winner: Scored): CounterfactualAlternative[] {
  return (["picture-first", "price-first", "earliest-home"] as const).map((id) =>
    counterfactualOf(chooseCounterfactual(eligible, id), winner, id)
  );
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
    const cabFare = estimateCabFare(candidate.route.distanceKm, "fallback scoring").amountRupees;
    return scoreCandidateWithReturn(
      candidate,
      {
        evidence: "unverified",
        durationMinutes: candidate.route.durationMinutes,
        costRupees: cabFare,
        costIsEstimate: true,
        cabEstimateAvailable: cabFare > 0,
        fallbackReason: "lookup-unavailable",
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
        cabEstimateAvailable: true,
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
        valueComparison = buildValueComparison(narrativePlanOf(winner), narrativePlanOf(bestOther));
      }
    }
  }

  const { outbound, returnLeg } = buildJourneyLegs(winner);

  // provenance: unique venues that made it into `scored` (i.e. produced at
  // least one scored candidate), not just the ones that survived to `eligible`.
  const venuesChecked = new Set(scored.map((s) => s.candidate.venue.id)).size;
  const routeSource = scored.every((s) => s.candidate.route.source === "live") ? "live" : "estimated";
  const freshnessLabel = formatFreshnessLabel(meta.generatedAt);
  const selectedPlanChecked = transitByJourney.has(journeyKeyOf(winner.candidate));
  const evening = buildEveningTimeline(
    winner.candidate.show,
    winner.candidate.route.durationMinutes,
    winner.returnJourney
  );
  const evidence: RecommendationEvidence = {
    showtimes: {
      source: "district",
      refreshedAtLabel: freshnessLabel,
      targetDates,
    },
    outbound: {
      mode: "drive",
      source: winner.candidate.route.source,
      durationMinutes: winner.candidate.route.durationMinutes,
      checkedAtLabel: formatTransitTime(new Date().toISOString()),
    },
    return: {
      mode: winner.returnJourney.evidence === "live" ? "transit" : "cab-fallback",
      status: winner.returnJourney.evidence,
      selectedPlanChecked,
      departureBasis: "film-end + 15 min theatre exit",
      ...(winner.returnJourney.evidence === "live" && winner.returnJourney.departureTime
        ? { scheduledForLabel: formatTransitTime(winner.returnJourney.departureTime) }
        : {}),
    },
  };
  const narrative = buildRecommendationNarrative(
    narrativePlanOf(winner),
    runnerUp ? narrativePlanOf(runnerUp) : undefined,
    intentWeights,
    new Set(eligible.map((candidate) => candidate.candidate.venue.id)).size
  );

  const result: RecommendationResult = {
    intentLabel: intentWeights.label.toUpperCase(),
    freshnessLabel,
    venueName: winner.candidate.venue.name,
    formatChip: winner.candidate.format,
    verdict: narrative.selectedFormat.judgment,
    showtime: winner.candidate.show.time,
    dateLabel: formatDateLabel(winner.candidate.show.date),
    seatClass: winner.candidate.show.cheapestSeatClassLabel ?? "SEATS",
    priceLabel: `₹${winner.candidate.show.priceRange!.min.toLocaleString("en-IN")}`,
    journey: {
      outbound,
      return: returnLeg,
      totalCostRupees: winner.score.totalCostRupees,
    },
    evening,
    evidence,
    narrative,
    whyLine: `${narrative.outcome.lead} ${narrative.outcome.receipt}`,
    runnerUp: runnerUp
      ? {
          venueName: runnerUp.candidate.venue.name,
          locality: runnerUp.candidate.venue.locality,
          formatChip: runnerUp.candidate.format,
          priceLabel: `₹${runnerUp.candidate.show.priceRange!.min.toLocaleString("en-IN")}`,
          showtime: runnerUp.candidate.show.time,
          score: runnerUp.score,
          screenScore: runnerUp.candidate.experienceScore,
          totalCostRupees: runnerUp.score.totalCostRupees,
          returnEvidence: runnerUp.returnJourney.evidence,
        }
      : undefined,
    score: winner.score,
    screenScore: winner.candidate.experienceScore,
    screenProof: getScreenProof(winner.candidate.venue.id, winner.candidate.format),
    counterfactuals: buildCounterfactuals(eligible, winner),
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
