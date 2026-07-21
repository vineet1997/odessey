/**
 * Turns a completed Helm answer set into a real RecommendationResult —
 * the client-side counterpart to api/route.ts and the District scraper.
 * This is where "static app fed by a robot" meets "one genuinely live,
 * per-user call": venue/showtime data is baked into the build (static
 * JSON imports below), but travel time is fetched live per request.
 *
 * HONEST SIMPLIFICATIONS IN THIS PASS (all deliberate, all documented —
 * see BRIEF.md for what's still queued):
 *
 * 1. GTFS/last-train data doesn't exist yet (explicitly deferred). The
 *    "is there a way home" signal is a rough, CITYWIDE placeholder — if
 *    the film's end time falls after ~11:15pm, we flag a possible-stranding
 *    warning with generic wording ("public transport may already be
 *    closed"), never a fabricated specific train/station. Once GTFS
 *    lands, LAST_TRANSPORT_CUTOFF_MINUTES becomes a real per-station
 *    lookup instead of one citywide number.
 *
 * 2. Only DRIVE-mode routing is used (via api/route.ts), framed as a
 *    generic "cab" leg — not a real metro line, since matching a journey
 *    to an actual DMRC line/station also needs GTFS. journey.lineLabel is
 *    therefore "CAB", not a fake line name.
 *
 * 3. Cab fare is an UNCALIBRATED placeholder formula (BRIEF.md's planned
 *    hand-calibration against real fare apps hasn't happened yet) — see
 *    estimateCabFare().
 *
 * 4. The `day` (weekday/weekend) Helm answer isn't used yet: District's
 *    scraper only captures "whatever's showing next," not a queryable
 *    future date, so there's no per-day-of-week data to filter by today.
 *    Only `timeBand` actually changes the result right now. Documented
 *    here rather than silently ignored.
 *
 * 5. Ticket price always uses the CHEAPEST bookable seat class
 *    (priceRange.min from the scraper), regardless of intent — a richer
 *    version might prefer a premium seat for "The Full Epic." Future work.
 */

import venuesData from "../../data/venues-curated.json";
import showtimesData from "../../data/showtimes-live.json";
import { scoreVenue, INTENTS, type IntentId, type ScoreResult, type UserContext } from "../scoring/score";
import type { Locality } from "../fixtures/localities";
import type { TimeBand } from "../components/helm/types";
import type { RecommendationResult } from "../types/recommendation";

const FILM_RUNTIME_MINUTES = 172; // BRIEF.md — The Odyssey's runtime
// Rough, CITYWIDE placeholder for "does public transport still run" — see
// module doc comment #1. BRIEF.md's own research found last trains cluster
// around 11:20-11:50pm; 11:15pm is a deliberately conservative cutoff.
const LAST_TRANSPORT_CUTOFF_MINUTES = 23 * 60 + 15;

// Uncalibrated placeholder — see module doc comment #3.
const CAB_BASE_FARE_RUPEES = 60;
const CAB_PER_KM_RUPEES = 18;

interface CuratedVenue {
  id: string;
  name: string;
  locality: string;
  city: string;
  score: number;
  editorial_verdict: string;
  coords?: { lat: number; lng: number } | null;
  coords_verified?: { lat: number; lng: number };
}

interface ShowtimeEntry {
  date: string;
  time: string; // "4:50 PM"
  format: string;
  availability: string | null;
  priceRange: { min: number; max: number } | null;
  cheapestSeatClassLabel: string | null;
}

interface VenueShowtimes {
  venueId: string;
  districtUrl: string | null;
  showtimes: ShowtimeEntry[];
  error?: string;
}

interface RouteApiResponse {
  source: "live" | "estimated" | "unavailable";
  durationMinutes?: number;
  distanceKm?: number;
}

export type BuildRecommendationResult =
  | { ok: true; result: RecommendationResult }
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

function timeBandOf(minutes: number): TimeBand {
  if (minutes < 16 * 60) return "matinee";
  if (minutes < 21 * 60) return "evening";
  return "night";
}

function formatDateLabel(isoDate: string): string {
  // "2026-07-21" -> "TUE JUL 21" (en-US's default format inserts a comma
  // after the weekday — stripped explicitly to match DESIGN.md's card copy)
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

async function fetchRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<{ durationMinutes: number; distanceKm: number } | null> {
  try {
    const res = await fetch("/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin, destination, mode: "DRIVE" }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as RouteApiResponse;
    if (typeof data.durationMinutes !== "number" || typeof data.distanceKm !== "number") return null;
    return { durationMinutes: data.durationMinutes, distanceKm: data.distanceKm };
  } catch {
    return null; // network error — this venue just gets excluded, not guessed
  }
}

interface Candidate {
  venue: CuratedVenue;
  coords: { lat: number; lng: number };
  showtime: ShowtimeEntry;
  fetchedAt: string;
  districtUrl: string | null;
}

interface Scored {
  candidate: Candidate;
  route: { durationMinutes: number; distanceKm: number };
  cabFare: number;
  returnAvailable: boolean;
  showEndMinutes: number;
  score: ScoreResult;
}

function buildJourneyLegs(scored: Scored) {
  const outbound = {
    lineLabel: "CAB",
    lineColorHex: "#2E6E73", // --sea — neutral "journey" color, not a fabricated metro line
    durationMinutes: scored.route.durationMinutes,
    costRupees: scored.cabFare,
  };

  const returnHeadline = scored.returnAvailable
    ? `Show ends around ${minutesTo12h(scored.showEndMinutes)} — public transport should still be running.`
    : `Show ends around ${minutesTo12h(scored.showEndMinutes)} — public transport may already be closed for the night.`;

  const returnLeg = {
    ...outbound,
    status: (scored.returnAvailable ? "good" : "stranded") as "good" | "stranded",
    headline: returnHeadline,
    ...(scored.returnAvailable ? {} : { cabFallbackLabel: `Cab back ≈ ₹${scored.cabFare}` }),
  };

  return { outbound, returnLeg };
}

function buildWhyLine(winner: Scored, runnerUp: Scored | undefined): string {
  if (!runnerUp) {
    return "The only venue with a matching showtime for this time band right now.";
  }
  const costDiff = runnerUp.score.costPerPersonRupees - winner.score.costPerPersonRupees;
  const timeDiff = runnerUp.route.durationMinutes - winner.route.durationMinutes;

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

export async function buildRecommendation(
  locality: Locality,
  timeBand: TimeBand,
  intentId: IntentId
): Promise<BuildRecommendationResult> {
  const venues = (venuesData as { shortlist: CuratedVenue[] }).shortlist;
  const showtimesByVenue = (showtimesData as { venues: Record<string, VenueShowtimes> }).venues;

  const candidates: Candidate[] = [];
  for (const venue of venues) {
    const coords = getVenueCoords(venue);
    if (!coords) continue; // no verified coordinates yet — excluded, not guessed (see venues-curated.json)

    const venueShowtimes = showtimesByVenue[venue.id];
    if (!venueShowtimes || venueShowtimes.error || venueShowtimes.showtimes.length === 0) continue;

    const matching = venueShowtimes.showtimes
      .filter((s) => s.priceRange && timeBandOf(parseTimeToMinutes(s.time)) === timeBand)
      .sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));

    if (matching.length === 0) continue;
    candidates.push({
      venue,
      coords,
      showtime: matching[0],
      fetchedAt: (showtimesData as { _meta: { generatedAt: string } })._meta.generatedAt,
      districtUrl: venueShowtimes.districtUrl,
    });
  }

  if (candidates.length === 0) {
    return {
      ok: false,
      reason: `No showtimes found in our data for the ${timeBand} time band right now. Try a different time band.`,
    };
  }

  const routes = await Promise.all(candidates.map((c) => fetchRoute(locality, c.coords)));

  const intentWeights = INTENTS[intentId];
  const scored: Scored[] = [];

  candidates.forEach((candidate, i) => {
    const route = routes[i];
    if (!route) return; // this venue's live route call failed — skip, don't guess

    const cabFare = estimateCabFare(route.distanceKm);
    const showStartMinutes = parseTimeToMinutes(candidate.showtime.time);
    const showEndMinutes = showStartMinutes + FILM_RUNTIME_MINUTES;
    const returnAvailable = showEndMinutes <= LAST_TRANSPORT_CUTOFF_MINUTES;

    const context: UserContext = {
      ticketPriceRupeesPerPerson: candidate.showtime.priceRange!.min,
      outboundTransportCostRupees: cabFare,
      returnTransportCostRupees: cabFare,
      outboundDurationMinutes: route.durationMinutes,
      returnDurationMinutes: route.durationMinutes,
      returnAvailable,
    };

    const score = scoreVenue(
      { id: candidate.venue.id, name: candidate.venue.name, experienceScore: candidate.venue.score },
      context,
      intentWeights
    );

    scored.push({ candidate, route, cabFare, returnAvailable, showEndMinutes, score });
  });

  if (scored.length === 0) {
    return { ok: false, reason: "Couldn't reach live travel times for any matching venue just now. Try again." };
  }

  scored.sort((a, b) => b.score.totalScore - a.score.totalScore);
  const winner = scored[0];
  const runnerUp = scored[1] as Scored | undefined;

  const { outbound, returnLeg } = buildJourneyLegs(winner);

  const result: RecommendationResult = {
    intentLabel: intentWeights.label.toUpperCase(),
    freshnessLabel: formatFreshnessLabel(winner.candidate.fetchedAt),
    venueName: winner.candidate.venue.name,
    formatChip: winner.candidate.showtime.format,
    verdict: winner.candidate.venue.editorial_verdict,
    showtime: winner.candidate.showtime.time,
    dateLabel: formatDateLabel(winner.candidate.showtime.date),
    seatClass: winner.candidate.showtime.cheapestSeatClassLabel ?? "SEATS",
    priceLabel: `₹${winner.candidate.showtime.priceRange!.min.toLocaleString("en-IN")}`,
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
          formatChip: runnerUp.candidate.showtime.format,
          priceLabel: `₹${runnerUp.candidate.showtime.priceRange!.min.toLocaleString("en-IN")}`,
          showtime: runnerUp.candidate.showtime.time,
          score: runnerUp.score,
        }
      : undefined,
    score: winner.score,
    // Fallback covers the type's null possibility (shouldn't happen for the 15
    // curated venues in practice) — a generic search beats a dead button.
    districtUrl: winner.candidate.districtUrl ?? "https://www.district.in/movies/the-odyssey-movie-tickets-in-delhi-ncr-MV187151",
  };

  return { ok: true, result };
}
