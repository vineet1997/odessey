/**
 * Format knowledge is deliberately an exact-label table. A District label is
 * evidence only for what it says; this module must never infer a projector,
 * screen size, or seating type from a substring match.
 */

export type FormatFamily = "imax" | "large-format" | "premium-seating" | "standard" | "motion";
export type FormatEmphasis = "picture" | "comfort" | "balanced" | "motion" | "unknown";

export interface FormatProfile {
  family: FormatFamily;
  emphasis: FormatEmphasis;
  /** A claim supported by the exact District format label, not a venue rumour. */
  safeDescription: string;
  /** A useful limit on what the label proves. */
  caveat?: string;
}

/** Every label presently emitted by data/showtimes-live.json has an entry. */
export const FORMAT_PROFILES: Record<string, FormatProfile> = {
  "2D": { family: "standard", emphasis: "unknown", safeDescription: "Listed as a standard 2D presentation." },
  "4DX-2D": { family: "motion", emphasis: "motion", safeDescription: "Listed as a 4DX motion-seat presentation." },
  "4K DOLBY 2D": { family: "large-format", emphasis: "picture", safeDescription: "Listed as a 4K Dolby presentation." },
  "AMOR BY DEVGN CINEX 2D": { family: "large-format", emphasis: "balanced", safeDescription: "Listed as an AMOR by Devgn Cinex presentation." },
  "BIGPIX 2D": { family: "large-format", emphasis: "picture", safeDescription: "Listed as a BigPix presentation." },
  "DIRECTOR'S CUT 2D": { family: "premium-seating", emphasis: "comfort", safeDescription: "Listed as a Director's Cut presentation." },
  "EMINENCE CUT RECLINER 2D": { family: "premium-seating", emphasis: "comfort", safeDescription: "Listed as an Eminence Cut recliner presentation." },
  "GOLD 2D": { family: "premium-seating", emphasis: "comfort", safeDescription: "Listed as a GOLD seating presentation." },
  "IMAX 2D": {
    family: "imax",
    emphasis: "picture",
    safeDescription: "Listed as an IMAX 2D presentation.",
    caveat: "The IMAX label alone does not establish laser projection.",
  },
  "IMAX 2D (Laser)": { family: "imax", emphasis: "picture", safeDescription: "Listed as an IMAX 2D (Laser) presentation." },
  "INSIGNIA 2D": { family: "premium-seating", emphasis: "comfort", safeDescription: "Listed as an Insignia presentation." },
  "LASER 2D": { family: "large-format", emphasis: "picture", safeDescription: "Listed as a laser 2D presentation." },
  "LASER DOLBY 2D": { family: "large-format", emphasis: "picture", safeDescription: "Listed as a laser Dolby presentation." },
  "LASER DOLBY ATMOS 2D": { family: "large-format", emphasis: "picture", safeDescription: "Listed as a laser Dolby Atmos presentation." },
  "LUXE 2D": { family: "premium-seating", emphasis: "comfort", safeDescription: "Listed as a LUXE seating presentation." },
  "ONYX 2D": { family: "large-format", emphasis: "picture", safeDescription: "Listed as an ONYX presentation." },
  "PXL 2D": { family: "large-format", emphasis: "picture", safeDescription: "Listed as a PXL presentation." },
  "RECLINER LASER ATMOS 2D": { family: "premium-seating", emphasis: "comfort", safeDescription: "Listed as a recliner laser Atmos presentation." },
  "RECLINERS 2D": { family: "premium-seating", emphasis: "comfort", safeDescription: "Listed as a recliner seating presentation." },
};

export interface VenueFormatEditorial {
  /** A venue-specific judgement, strictly keyed to one exact format label. */
  judgment: string;
  /** A factual qualification that must travel with the judgement. */
  caveat?: string;
}

/**
 * These replace generic venue verdicts at render time. In particular, no
 * flagship IMAX claim can accidentally describe a recliner or GOLD show from
 * the same building. Claims are scoped to the maintained NCR shortlist.
 */
export const VENUE_FORMAT_EDITORIALS: Record<string, VenueFormatEditorial> = {
  "priya-vasant-vihar|IMAX 2D": {
    judgment: "Directly confirmed laser IMAX in our NCR shortlist.",
    caveat: "The confirmation is venue-specific, not an inference from the IMAX label.",
  },
  "priya-vasant-vihar|IMAX 2D (Laser)": {
    judgment: "Directly confirmed laser IMAX in our NCR shortlist.",
    caveat: "The confirmation is venue-specific, not an inference from the IMAX label.",
  },
  "select-citywalk-saket|IMAX 2D": {
    judgment: "High-rated IMAX in our NCR shortlist.",
    caveat: "Laser status is unverified.",
  },
  "mall-of-india-noida|IMAX 2D": {
    judgment: "Our listed Noida IMAX option.",
    caveat: "Laser status is unverified.",
  },
  "vegas-dwarka|IMAX 2D": { judgment: "Our listed West Delhi IMAX option." },
  "ambience-gurugram-kotak-imax|IMAX 2D": {
    judgment: "Our listed Gurugram IMAX option.",
    caveat: "Laser status needs verification.",
  },
  "inox-paras-nehru-place|IMAX 2D": {
    judgment: "Our listed Nehru Place IMAX option.",
    caveat: "Laser status is unverified.",
  },
  "inox-vishal-mall-rajouri|IMAX 2D": {
    judgment: "Our listed Rajouri Garden IMAX option.",
    caveat: "Current screen specification is unverified.",
  },
  "inox-insignia-epicuria|INSIGNIA 2D": { judgment: "Our listed Insignia presentation in Epicuria." },
  "cinepolis-dlf-avenue-saket|ONYX 2D": { judgment: "Our listed ONYX presentation in Saket." },
  "devgn-cinex-elan-epic|LASER DOLBY ATMOS 2D": { judgment: "Our listed laser Dolby Atmos presentation in Gurugram." },
  "wave-cinemas-gurugram|RECLINER LASER ATMOS 2D": { judgment: "Our listed recliner laser Atmos presentation in Gurugram." },
  "directors-cut-mall-of-india-noida|DIRECTOR'S CUT 2D": { judgment: "Our listed Director's Cut presentation in Noida." },
  "pvr-cinemagic-pitampura|LUXE 2D": { judgment: "Our listed LUXE seating presentation in Pitampura." },
  "new-us-cinemas-ghaziabad|4K DOLBY 2D": { judgment: "Our listed 4K Dolby presentation in Ghaziabad." },
};

export function getFormatProfile(format: string): FormatProfile | undefined {
  return FORMAT_PROFILES[format];
}

export function getVenueFormatEditorial(venueId: string, format: string): VenueFormatEditorial | undefined {
  return VENUE_FORMAT_EDITORIALS[`${venueId}|${format}`];
}

/** Data-level guard for tests and future scraper labels. */
export function formatProfileIntegrityIssues(labels: readonly string[]): string[] {
  return labels.filter((label) => !FORMAT_PROFILES[label]).map((label) => `Missing exact profile: ${label}`);
}
