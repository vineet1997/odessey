import type { Origin } from "../components/helm/types";
import type { RecommendationResult } from "../types/recommendation";

/** The public contract for a Screening Declaration. Keeping it narrow is a
 * privacy boundary: no origin label, coordinates, route, price or research
 * receipt may cross from a recommendation into an image or share caption. */
export interface ShareArtifactModel {
  publicUrl: string;
  filename: string;
  caption: string;
  region: string;
  date: string;
  venueName: string;
  format: string;
  showtime: string;
}

const FALLBACK_REGION = "DELHI NCR";

function safeRegion(origin: Origin): string {
  const value = origin.region?.trim();
  if (value && value.length <= 28 && /^[A-Za-z][A-Za-z .-]*$/.test(value)) return value.toUpperCase();
  return FALLBACK_REGION;
}

/** Always provide a clean public homepage, never an active result/route. */
export function normalizedPublicUrl(configured?: string, runtimeOrigin?: string): string {
  const fallback = runtimeOrigin || "https://odessey-topaz.vercel.app";
  try {
    const url = new URL(configured || fallback, fallback);
    return `${url.protocol}//${url.host}/`;
  } catch {
    return "https://odessey-topaz.vercel.app/";
  }
}

function filenameFor(venueName: string): string {
  const slug = venueName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 56) || "screening";
  return `ithaka-odyssey-plan-${slug}.png`;
}

export function buildShareArtifactModel(result: RecommendationResult, origin: Origin): ShareArtifactModel {
  const publicUrl = normalizedPublicUrl(import.meta.env.VITE_PUBLIC_SITE_URL, typeof window === "undefined" ? undefined : window.location.origin);
  const date = result.dateLabel;
  const format = result.formatChip;
  const venueName = result.venueName;
  const showtime = result.showtime;
  return {
    publicUrl,
    filename: filenameFor(venueName),
    caption: `The Odyssey. ${format} at ${venueName}, ${date} · ${showtime}.\n\nWho’s in?\n\nI found my screening with Ithaka:\n${publicUrl}`,
    region: safeRegion(origin),
    date,
    venueName,
    format,
    showtime,
  };
}
