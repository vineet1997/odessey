export interface ActiveCommunitySignal {
  id: string;
  canonical_url: string;
  public_summary: string;
  matched_venue_ids: string[];
  score_adjustment: number;
  applies_to_formats: string[];
  applies_after_local_time: string | null;
  applies_before_local_time: string | null;
  active_from: string | null;
  active_until: string | null;
}

interface SignalApiResponse { signals?: unknown[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseSignal(value: unknown): ActiveCommunitySignal | null {
  if (!isRecord(value) || value.status !== "approved") return null;
  if (typeof value.id !== "string" || typeof value.canonical_url !== "string" || typeof value.public_summary !== "string") return null;
  if (!Array.isArray(value.matched_venue_ids) || !value.matched_venue_ids.every((item) => typeof item === "string")) return null;
  if (!Array.isArray(value.applies_to_formats) || !value.applies_to_formats.every((item) => typeof item === "string")) return null;
  const adjustment = typeof value.score_adjustment === "number" && Number.isFinite(value.score_adjustment)
    ? Math.max(-30, Math.min(20, Math.round(value.score_adjustment)))
    : 0;
  return {
    id: value.id,
    canonical_url: value.canonical_url,
    public_summary: value.public_summary,
    matched_venue_ids: value.matched_venue_ids,
    score_adjustment: adjustment,
    applies_to_formats: value.applies_to_formats,
    applies_after_local_time: typeof value.applies_after_local_time === "string" ? value.applies_after_local_time : null,
    applies_before_local_time: typeof value.applies_before_local_time === "string" ? value.applies_before_local_time : null,
    active_from: typeof value.active_from === "string" ? value.active_from : null,
    active_until: typeof value.active_until === "string" ? value.active_until : null,
  };
}

/** Community intelligence is additive evidence, never a dependency: a failed
 * transparency request leaves the curated score unchanged. */
export async function loadActiveCommunitySignals(): Promise<ActiveCommunitySignal[]> {
  try {
    const response = await fetch("/api/community-data?activeOnly=1", { headers: { Accept: "application/json" } });
    if (!response.ok) return [];
    const payload = (await response.json()) as SignalApiResponse;
    return (payload.signals ?? []).map(parseSignal).filter((signal): signal is ActiveCommunitySignal => signal !== null);
  } catch {
    return [];
  }
}

function clockMinutes(value: string): number | null {
  const twentyFourHour = /^(\d{2}):(\d{2})/.exec(value);
  if (twentyFourHour) return Number(twentyFourHour[1]) * 60 + Number(twentyFourHour[2]);
  const twelveHour = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(value);
  if (!twelveHour) return null;
  let hour = Number(twelveHour[1]) % 12;
  if (twelveHour[3] === "PM") hour += 12;
  return hour * 60 + Number(twelveHour[2]);
}

export function signalApplies(signal: ActiveCommunitySignal, venueId: string, format: string, showDate: string, showtime: string): boolean {
  if (!signal.matched_venue_ids.includes(venueId)) return false;
  if (signal.applies_to_formats.length > 0 && !signal.applies_to_formats.includes(format)) return false;
  if (signal.active_from && showDate < signal.active_from) return false;
  if (signal.active_until && showDate > signal.active_until) return false;
  const showMinutes = clockMinutes(showtime);
  if (showMinutes === null) return false;
  const after = signal.applies_after_local_time ? clockMinutes(signal.applies_after_local_time) : null;
  const before = signal.applies_before_local_time ? clockMinutes(signal.applies_before_local_time) : null;
  if (after !== null && before !== null) {
    return after <= before
      ? showMinutes >= after && showMinutes <= before
      : showMinutes >= after || showMinutes <= before;
  }
  if (after !== null && showMinutes < after) return false;
  if (before !== null && showMinutes > before) return false;
  return true;
}

export function applicableCommunitySignals(signals: ActiveCommunitySignal[], venueId: string, format: string, showDate: string, showtime: string): ActiveCommunitySignal[] {
  return signals.filter((signal) => signalApplies(signal, venueId, format, showDate, showtime));
}

export function adjustedExperienceScore(baseScore: number, signals: ActiveCommunitySignal[], venueId: string, format: string, showDate: string, showtime: string): number {
  const adjustment = applicableCommunitySignals(signals, venueId, format, showDate, showtime)
    .reduce((sum, signal) => sum + signal.score_adjustment, 0);
  return Math.max(0, Math.min(100, baseScore + Math.max(-30, Math.min(20, adjustment))));
}
