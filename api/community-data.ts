// Public transparency feed plus a token-protected founder review endpoint.
// The browser never receives the Supabase service-role key.
export const config = { runtime: "edge" };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COMMUNITY_REVIEW_TOKEN = process.env.COMMUNITY_REVIEW_TOKEN;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCAL_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const IMPACTS = new Set(["positive", "negative", "mixed", "neutral"]);
const STATUSES = new Set(["pending", "approved", "dismissed"]);
const PUBLIC_COLUMNS = [
  "id",
  "canonical_url",
  "subreddit",
  "title",
  "excerpt",
  "published_at",
  "discovered_at",
  "last_seen_at",
  "matched_venue_ids",
  "signal_categories",
  "status",
  "public_summary",
  "public_impact",
  "score_adjustment",
  "applies_to_formats",
  "applies_after_local_time",
  "applies_before_local_time",
  "active_from",
  "active_until",
  "reviewed_at",
].join(",");

interface ReviewRequest {
  id: string;
  status: "pending" | "approved" | "dismissed";
  publicSummary?: string;
  publicImpact?: "positive" | "negative" | "mixed" | "neutral";
  reviewNotes?: string;
  scoreAdjustment?: number;
  appliesToFormats?: string[];
  appliesAfterLocalTime?: string;
  appliesBeforeLocalTime?: string;
  activeFrom?: string;
  activeUntil?: string;
}

function json(body: unknown, status = 200, cache = "no-store"): Response {
  return Response.json(body, { status, headers: { "Cache-Control": cache } });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseReviewRequest(value: unknown): ReviewRequest | null {
  if (!isRecord(value)) return null;
  const {
    id, status, publicSummary, publicImpact, reviewNotes, scoreAdjustment, appliesToFormats,
    appliesAfterLocalTime, appliesBeforeLocalTime, activeFrom, activeUntil,
  } = value;
  if (typeof id !== "string" || !UUID.test(id)) return null;
  if (typeof status !== "string" || !STATUSES.has(status)) return null;
  if (publicSummary !== undefined && (typeof publicSummary !== "string" || publicSummary.trim().length > 1200)) return null;
  if (publicImpact !== undefined && (typeof publicImpact !== "string" || !IMPACTS.has(publicImpact))) return null;
  if (reviewNotes !== undefined && (typeof reviewNotes !== "string" || reviewNotes.trim().length > 2000)) return null;
  if (scoreAdjustment !== undefined && (!Number.isInteger(scoreAdjustment) || (scoreAdjustment as number) < -30 || (scoreAdjustment as number) > 20)) return null;
  if (appliesToFormats !== undefined && (!Array.isArray(appliesToFormats) || appliesToFormats.length > 20 || !appliesToFormats.every((item) => typeof item === "string" && item.trim().length > 0 && item.length <= 80))) return null;
  if (appliesAfterLocalTime !== undefined && (typeof appliesAfterLocalTime !== "string" || !LOCAL_TIME.test(appliesAfterLocalTime))) return null;
  if (appliesBeforeLocalTime !== undefined && (typeof appliesBeforeLocalTime !== "string" || !LOCAL_TIME.test(appliesBeforeLocalTime))) return null;
  if (activeFrom !== undefined && (typeof activeFrom !== "string" || !ISO_DATE.test(activeFrom))) return null;
  if (activeUntil !== undefined && (typeof activeUntil !== "string" || !ISO_DATE.test(activeUntil))) return null;
  if (typeof activeFrom === "string" && typeof activeUntil === "string" && activeUntil < activeFrom) return null;
  if (status === "approved" && (typeof publicSummary !== "string" || publicSummary.trim().length === 0)) return null;
  return {
    id,
    status: status as ReviewRequest["status"],
    ...(typeof publicSummary === "string" ? { publicSummary: publicSummary.trim() } : {}),
    ...(typeof publicImpact === "string" ? { publicImpact: publicImpact as ReviewRequest["publicImpact"] } : {}),
    ...(typeof reviewNotes === "string" ? { reviewNotes: reviewNotes.trim() } : {}),
    ...(typeof scoreAdjustment === "number" ? { scoreAdjustment } : {}),
    ...(Array.isArray(appliesToFormats) ? { appliesToFormats: [...new Set(appliesToFormats.map((item) => item.trim()))] } : {}),
    ...(typeof appliesAfterLocalTime === "string" ? { appliesAfterLocalTime } : {}),
    ...(typeof appliesBeforeLocalTime === "string" ? { appliesBeforeLocalTime } : {}),
    ...(typeof activeFrom === "string" ? { activeFrom } : {}),
    ...(typeof activeUntil === "string" ? { activeUntil } : {}),
  };
}

function isReviewer(req: Request): boolean {
  if (!COMMUNITY_REVIEW_TOKEN) return false;
  return req.headers.get("authorization") === `Bearer ${COMMUNITY_REVIEW_TOKEN}`;
}

async function supabase(path: string, init: RequestInit): Promise<Response> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "Community data is not configured." }, 503);
  }
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function listSignals(req: Request): Promise<Response> {
  const reviewer = isReviewer(req);
  const url = new URL(req.url);
  const activeOnly = url.searchParams.get("activeOnly") === "1";
  const includeDismissed = reviewer && url.searchParams.get("includeDismissed") === "1";
  const statusFilter = activeOnly
    ? "eq.approved"
    : includeDismissed
      ? "in.(pending,approved,dismissed)"
      : "in.(pending,approved)";
  const query = new URLSearchParams({
    select: reviewer ? `${PUBLIC_COLUMNS},review_notes` : PUBLIC_COLUMNS,
    status: statusFilter,
    order: "published_at.desc.nullslast,discovered_at.desc",
    limit: "150",
  });
  const response = await supabase(`community_signals?${query.toString()}`, { method: "GET" });
  if (!response.ok) return json({ error: "Could not load community signals." }, 502);
  const signals = await response.json();
  return json(
    { signals, reviewer },
    200,
    reviewer ? "no-store" : "public, max-age=60, stale-while-revalidate=300"
  );
}

async function reviewSignal(req: Request): Promise<Response> {
  if (!isReviewer(req)) return json({ error: "Review access required." }, 401);
  let parsed: ReviewRequest | null = null;
  try {
    parsed = parseReviewRequest(await req.json());
  } catch {
    parsed = null;
  }
  if (!parsed) return json({ error: "Invalid review payload." }, 400);

  const row = {
    status: parsed.status,
    public_summary: parsed.status === "approved" ? parsed.publicSummary : null,
    public_impact: parsed.status === "approved" ? parsed.publicImpact ?? "neutral" : null,
    score_adjustment: parsed.status === "approved" ? parsed.scoreAdjustment ?? 0 : 0,
    applies_to_formats: parsed.status === "approved" ? parsed.appliesToFormats ?? [] : [],
    applies_after_local_time: parsed.status === "approved" ? parsed.appliesAfterLocalTime ?? null : null,
    applies_before_local_time: parsed.status === "approved" ? parsed.appliesBeforeLocalTime ?? null : null,
    active_from: parsed.status === "approved" ? parsed.activeFrom ?? null : null,
    active_until: parsed.status === "approved" ? parsed.activeUntil ?? null : null,
    review_notes: parsed.reviewNotes || null,
    reviewed_at: parsed.status === "pending" ? null : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const query = new URLSearchParams({ id: `eq.${parsed.id}`, select: PUBLIC_COLUMNS });
  const response = await supabase(`community_signals?${query.toString()}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  if (!response.ok) return json({ error: "Could not save this review." }, 502);
  const rows = (await response.json()) as unknown[];
  if (rows.length === 0) return json({ error: "Signal not found." }, 404);
  return json({ signal: rows[0] });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "GET") return listSignals(req);
  if (req.method === "PATCH") return reviewSignal(req);
  return json({ error: "Use GET or PATCH." }, 405);
}
