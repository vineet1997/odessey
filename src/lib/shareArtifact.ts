import type { Origin } from "../components/helm/types";
import type { RecommendationResult, ReturnEvidenceStatus } from "../types/recommendation";

/** The public, deliberately non-identifying data contract for a shared brief.
 * This file is the privacy boundary: neither a locality label, coordinates,
 * directions URL, nor route query is allowed to cross it. */
export interface ShareArtifactModel {
  publicUrl: string;
  filename: string;
  caption: string;
  header: string;
  region: string;
  date: string;
  intent: string;
  venueName: string;
  format: string;
  showtime: string;
  seatClass: string;
  price: string;
  returnStatus: ReturnEvidenceStatus;
  returnHeadline: string;
  timeline: Array<{ label: string; time: string }>;
  decisionLead: string;
  comparisonReceipt: string;
  screenScore: number;
  provenance: string;
}

const FALLBACK_REGION = "DELHI NCR";

function safeRegion(origin: Origin): string {
  const value = origin.region?.trim();
  // A region is coarse only when it is a simple named geography, not an
  // address, locality string or a coordinate pair.
  if (value && value.length <= 28 && /^[A-Za-z][A-Za-z .-]*$/.test(value)) return value.toUpperCase();
  return FALLBACK_REGION;
}

/** Strip every path/query/hash from public-site configuration. The QR must
 * invite a new person to Ithaka, never recreate the sharer's route. */
export function normalizedPublicUrl(configured?: string, runtimeOrigin?: string): string {
  const fallback = runtimeOrigin || "https://odessey-topaz.vercel.app";
  try {
    const url = new URL(configured || fallback, fallback);
    return `${url.protocol}//${url.host}/`;
  } catch {
    return "https://odessey-topaz.vercel.app/";
  }
}

function returnHeadline(status: ReturnEvidenceStatus, result: RecommendationResult): string {
  if (status === "live") return "THE WAY HOME IS SCHEDULED.";
  if (status === "no-route") return result.journey.return.cabFallbackLabel
    ? "TRANSIT ENDS HERE. A CAB COMPLETES THE NIGHT."
    : "TRANSIT ENDS HERE. PLAN THE CAB HOME.";
  return "THE RETURN NEEDS A FINAL CHECK.";
}

function timelineOf(result: RecommendationResult): Array<{ label: string; time: string }> {
  const evening = result.evening;
  return [
    { label: "LEAVE", time: evening.leaveHome.time },
    { label: "ARRIVE", time: evening.arriveAtTheatre.time },
    { label: "FILM", time: evening.filmStarts.time },
    { label: "ENDS", time: evening.filmEnds.time },
    ...(result.evidence.return.status === "live" && evening.homeArrival
      ? [{ label: "HOME", time: evening.homeArrival.time }]
      : [{ label: "EXIT", time: evening.theatreExit.time }]),
  ];
}

function compactReceipt(result: RecommendationResult): string {
  const rival = result.runnerUp;
  if (!rival) return `SCREEN ${result.screenScore}/100 · ₹${result.journey.totalCostRupees.toLocaleString("en-IN")} DOOR TO DOOR.`;
  return `SCREEN ${result.screenScore}/100 VS ${rival.screenScore}/100 · ₹${result.journey.totalCostRupees.toLocaleString("en-IN")} VS ₹${rival.totalCostRupees.toLocaleString("en-IN")} DOOR TO DOOR.`;
}

function filenameFor(venueName: string): string {
  const slug = venueName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 56) || "answer";
  return `ithaka-night-brief-${slug}.png`;
}

export function buildShareArtifactModel(result: RecommendationResult, origin: Origin): ShareArtifactModel {
  const publicUrl = normalizedPublicUrl(import.meta.env.VITE_PUBLIC_SITE_URL, typeof window === "undefined" ? undefined : window.location.origin);
  const returnStatus = result.evidence.return.status;
  const provenance = `${result.provenance.venuesChecked} VENUES / ${result.provenance.showsConsidered} SHOWS / ${result.provenance.plansScored} VIABLE PLANS`;
  const region = safeRegion(origin);
  const caption = [
    `Tonight's answer: ${result.venueName} · ${result.formatChip} · ${result.showtime}.`,
    result.narrative.outcome.lead,
    `${provenance}. ONE ANSWER.`,
    publicUrl,
  ].join("\n");

  return {
    publicUrl,
    filename: filenameFor(result.venueName),
    caption,
    header: "ITHAKA / PERSONAL NIGHT BRIEF",
    region,
    date: result.dateLabel,
    intent: result.intentLabel,
    venueName: result.venueName,
    format: result.formatChip,
    showtime: result.showtime,
    seatClass: result.seatClass,
    price: result.priceLabel,
    returnStatus,
    returnHeadline: returnHeadline(returnStatus, result),
    timeline: timelineOf(result),
    decisionLead: result.narrative.outcome.lead,
    comparisonReceipt: compactReceipt(result),
    screenScore: result.screenScore,
    provenance,
  };
}
