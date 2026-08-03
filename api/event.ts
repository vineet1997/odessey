// Ithaka's small, server-only measurement endpoint. The browser never talks
// to Supabase directly, so its service-role key stays on Vercel.
export const config = { runtime: "edge" };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const EVENT_NAMES = new Set([
  "app_opened",
  "prologue_completed",
  "search_submitted",
  "recommendation_ready",
  "intent_changed",
  "plan_refined",
  "directions_opened",
  "booking_opened",
  "share_opened",
  "share_completed",
  "feedback_started",
  "feedback_submitted",
]);

const FEEDBACK_SENTIMENTS = new Set(["helpful", "almost", "missed"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REFERRAL_CODE = /^[a-z0-9][a-z0-9_-]{1,63}$/;
const MAX_BODY_BYTES = 8_000;

type EventName = typeof EVENT_NAMES extends Set<infer T> ? T : never;

interface EventRequest {
  eventName: EventName;
  visitorId: string;
  visitId: string;
  referralCode?: string;
  properties?: Record<string, string | number | boolean>;
  feedback?: {
    sentiment: "helpful" | "almost" | "missed";
    message?: string;
    context?: Record<string, string | number | boolean>;
  };
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeProperties(value: unknown): Record<string, string | number | boolean> | null {
  if (value === undefined) return {};
  if (!isRecord(value)) return null;
  const safe: Record<string, string | number | boolean> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(key)) return null;
    if (typeof item === "string") {
      if (item.length > 160) return null;
      safe[key] = item;
    } else if (typeof item === "number" && Number.isFinite(item)) {
      safe[key] = item;
    } else if (typeof item === "boolean") {
      safe[key] = item;
    } else {
      return null;
    }
  }
  return safe;
}

function parseRequest(value: unknown): EventRequest | null {
  if (!isRecord(value)) return null;
  const { eventName, visitorId, visitId, referralCode, properties, feedback } = value;
  if (typeof eventName !== "string" || !EVENT_NAMES.has(eventName)) return null;
  if (typeof visitorId !== "string" || !UUID.test(visitorId)) return null;
  if (typeof visitId !== "string" || !UUID.test(visitId)) return null;
  if (referralCode !== undefined && (typeof referralCode !== "string" || !REFERRAL_CODE.test(referralCode))) return null;
  const safeEventProperties = safeProperties(properties);
  if (!safeEventProperties) return null;

  if (feedback === undefined) {
    return { eventName, visitorId, visitId, ...(referralCode ? { referralCode } : {}), properties: safeEventProperties };
  }
  if (eventName !== "feedback_submitted" || !isRecord(feedback) || !FEEDBACK_SENTIMENTS.has(feedback.sentiment as string)) return null;
  const message = feedback.message;
  if (message !== undefined && (typeof message !== "string" || message.length > 1200)) return null;
  const context = safeProperties(feedback.context);
  if (!context) return null;
  return {
    eventName,
    visitorId,
    visitId,
    ...(referralCode ? { referralCode } : {}),
    properties: safeEventProperties,
    feedback: { sentiment: feedback.sentiment as "helpful" | "almost" | "missed", ...(message?.trim() ? { message: message.trim() } : {}), context },
  };
}

async function insert(table: "product_events" | "feedback", row: Record<string, unknown>): Promise<Response> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "Measurement is not configured." }, 503);
  }
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });
  return response;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  const length = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) return json({ error: "Payload too large." }, 413);

  let parsed: EventRequest | null = null;
  try {
    parsed = parseRequest(await req.json());
  } catch {
    parsed = null;
  }
  if (!parsed) return json({ error: "Invalid event payload." }, 400);

  const eventResponse = await insert("product_events", {
    visitor_id: parsed.visitorId,
    visit_id: parsed.visitId,
    event_name: parsed.eventName,
    referral_code: parsed.referralCode ?? null,
    properties: parsed.properties ?? {},
  });
  if (!eventResponse.ok) return json({ error: "Could not record event." }, 502);

  if (parsed.feedback) {
    const feedbackResponse = await insert("feedback", {
      visitor_id: parsed.visitorId,
      visit_id: parsed.visitId,
      referral_code: parsed.referralCode ?? null,
      sentiment: parsed.feedback.sentiment,
      message: parsed.feedback.message ?? null,
      context: parsed.feedback.context ?? {},
    });
    if (!feedbackResponse.ok) return json({ error: "Could not save feedback." }, 502);
  }

  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
