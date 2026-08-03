export type EventName =
  | "app_opened"
  | "prologue_completed"
  | "search_submitted"
  | "recommendation_ready"
  | "intent_changed"
  | "plan_refined"
  | "directions_opened"
  | "booking_opened"
  | "share_opened"
  | "share_completed"
  | "feedback_started"
  | "feedback_submitted";

export type EventProperties = Record<string, string | number | boolean>;
export type FeedbackSentiment = "helpful" | "almost" | "missed";

const VISITOR_KEY = "ithaka_visitor_id";
const VISIT_KEY = "ithaka_visit_id";
const REFERRAL_KEY = "ithaka_referral_code";
const REFERRAL_CODE = /^[a-z0-9][a-z0-9_-]{1,63}$/;

function idFor(key: string, storage: Storage): string {
  const existing = storage.getItem(key);
  if (existing) return existing;
  const next = crypto.randomUUID();
  storage.setItem(key, next);
  return next;
}

function referralCode(): string | undefined {
  const incoming = new URLSearchParams(window.location.search).get("ref")?.trim().toLowerCase();
  if (incoming && REFERRAL_CODE.test(incoming)) sessionStorage.setItem(REFERRAL_KEY, incoming);
  const stored = sessionStorage.getItem(REFERRAL_KEY);
  return stored && REFERRAL_CODE.test(stored) ? stored : undefined;
}

function payload(eventName: EventName, properties: EventProperties = {}) {
  return {
    eventName,
    visitorId: idFor(VISITOR_KEY, localStorage),
    visitId: idFor(VISIT_KEY, sessionStorage),
    ...(referralCode() ? { referralCode: referralCode() } : {}),
    properties,
  };
}

/** Best-effort only: analytics should never slow or break the recommendation. */
export function trackEvent(eventName: EventName, properties: EventProperties = {}): void {
  void fetch("/api/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload(eventName, properties)),
    keepalive: true,
  }).catch(() => undefined);
}

export async function submitFeedback(
  sentiment: FeedbackSentiment,
  message: string,
  context: EventProperties
): Promise<void> {
  const data = payload("feedback_submitted", { sentiment });
  const response = await fetch("/api/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...data,
      feedback: { sentiment, ...(message.trim() ? { message: message.trim() } : {}), context },
    }),
    keepalive: true,
  });
  if (!response.ok) throw new Error(`Feedback request failed with status ${response.status}.`);
}
