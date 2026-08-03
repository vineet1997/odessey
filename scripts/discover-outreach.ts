/**
 * Launch-stage distribution collector.
 *
 * It finds three kinds of public web leads for Ithaka/Odessey:
 *   - conversations: people actively deciding where to watch
 *   - creators: local, cinema-relevant voices who can assess the app
 *   - communities: Delhi-NCR groups that organise film outings
 *
 * This deliberately stops before outreach. The output is a reviewed queue,
 * not an automated-DM tool: a culturally specific launch needs a human,
 * useful response to every target.
 *
 * Usage:
 *   EXA_API_KEY=... npm run discover:outreach
 *   EXA_API_KEY=... npm run discover:outreach -- --preset conversations --limit 12
 *   EXA_API_KEY=... npm run discover:outreach -- --out data/distribution/launch.json
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const EXA_SEARCH_URL = "https://api.exa.ai/search";
const DEFAULT_OUTPUT = "data/distribution/targets.json";
const DEFAULT_LIMIT = 8;

type TargetType = "conversation" | "creator" | "community";

interface DiscoveryQuery {
  targetType: TargetType;
  query: string;
  includeDomains?: string[];
}

interface ExaResult {
  title?: string;
  url?: string;
  publishedDate?: string;
  author?: string;
  highlights?: string[];
  summary?: string;
  text?: string;
}

interface Target {
  id: string;
  targetType: TargetType;
  title: string;
  url: string;
  author?: string;
  publishedDate?: string;
  discoveredAt: string;
  source: "exa";
  queries: string[];
  excerpt?: string;
  priorityScore: number;
  priorityReasons: string[];
  status: "new" | "reviewed" | "contacted" | "replied" | "activated" | "archived";
  notes: string;
}

interface TargetFile {
  schemaVersion: 1;
  updatedAt: string;
  targets: Target[];
}

const PRESETS: Record<string, DiscoveryQuery[]> = {
  conversations: [
    {
      targetType: "conversation",
      query: "where should I watch The Odyssey Delhi NCR IMAX",
      includeDomains: ["reddit.com", "quora.com"],
    },
    {
      targetType: "conversation",
      query: "The Odyssey best cinema Delhi Gurgaon Noida",
      includeDomains: ["reddit.com", "quora.com"],
    },
    {
      targetType: "conversation",
      query: "The Odyssey Priya IMAX worth it Delhi",
      includeDomains: ["reddit.com", "quora.com"],
    },
    {
      targetType: "conversation",
      query: "The Odyssey ticket price versus screen Delhi NCR",
      includeDomains: ["reddit.com", "quora.com"],
    },
  ],
  creators: [
    { targetType: "creator", query: "Delhi NCR cinema reviewer Instagram YouTube The Odyssey" },
    { targetType: "creator", query: "Delhi movie reviewer IMAX projection enthusiast Instagram" },
    { targetType: "creator", query: "Delhi entertainment creator cinema recommendations Instagram" },
  ],
  communities: [
    { targetType: "community", query: "Delhi NCR film club movie screening community" },
    { targetType: "community", query: "Delhi university film society cinema club" },
    { targetType: "community", query: "Gurgaon Noida movie club film community" },
  ],
};

const PRESETS_ALL = Object.values(PRESETS).flat();

function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normaliseUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith("utm_") || key === "ref") url.searchParams.delete(key);
  }
  return url.toString().replace(/\/$/, "");
}

function excerptOf(result: ExaResult): string | undefined {
  const value = result.highlights?.[0] ?? result.summary ?? result.text;
  if (!value) return undefined;
  return value.replace(/\s+/g, " ").trim().slice(0, 600);
}

function scoreTarget(targetType: TargetType, title: string, excerpt: string | undefined, url: string): Pick<Target, "priorityScore" | "priorityReasons"> {
  const haystack = `${title} ${excerpt ?? ""} ${url}`.toLowerCase();
  const reasons: string[] = [];
  let score = 0;

  if (/delhi|ncr|gurgaon|gurugram|noida|ghaziabad|faridabad/.test(haystack)) {
    score += 30;
    reasons.push("Delhi-NCR relevance");
  }
  if (/cinema|movie|film|imax|theatre|theater|screening|projection/.test(haystack)) {
    score += 25;
    reasons.push("Cinema relevance");
  }
  if (/the odyssey|odyssey/.test(haystack)) {
    score += 20;
    reasons.push("Current-film relevance");
  }
  if (targetType === "conversation" && /where|which|best|worth|price|ticket|imax/.test(haystack)) {
    score += 15;
    reasons.push("Decision intent");
  }
  if (targetType === "conversation" && /(^|\.)reddit\.com$|(^|\.)quora\.com$/.test(new URL(url).hostname)) {
    score += 10;
    reasons.push("Peer discussion");
  }
  if (targetType !== "conversation" && /instagram|youtube|reddit|meetup|club|society|newsletter/.test(haystack)) {
    score += 10;
    reasons.push("Reachable public node");
  }

  return { priorityScore: clamp(score, 0, 100), priorityReasons: reasons };
}

function makeId(url: string): string {
  // Stable and readable enough for a manually maintained launch queue. URLs
  // remain the canonical dedupe key; this ID is only for a future database import.
  let hash = 2166136261;
  for (const char of url) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `target_${(hash >>> 0).toString(36)}`;
}

/**
 * Vite loads `.env.local` for browser code, but this is a standalone tsx
 * process and receives only the shell environment by default. Keep the tiny
 * parser here instead of adding dotenv for one launch script. Shell-provided
 * values always win, which is the normal CI/Vercel precedence.
 */
async function loadLocalEnvironment(): Promise<void> {
  try {
    const raw = await readFile(resolve(".env.local"), "utf8");
    for (const rawLine of raw.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) continue;
      const [, name, rawValue] = match;
      if (process.env[name] !== undefined) continue;
      const value = rawValue.trim();
      const isQuoted =
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"));
      process.env[name] = isQuoted ? value.slice(1, -1) : value;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

async function search(query: DiscoveryQuery, apiKey: string, limit: number): Promise<ExaResult[]> {
  const response = await fetch(EXA_SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({
      query: query.query,
      numResults: limit,
      type: "auto",
      ...(query.includeDomains ? { includeDomains: query.includeDomains } : {}),
      contents: { highlights: { maxCharacters: 700 } },
    }),
  });
  if (!response.ok) throw new Error(`Exa search failed for “${query.query}” (HTTP ${response.status})`);
  const body = (await response.json()) as { results?: ExaResult[] };
  return body.results ?? [];
}

async function loadExisting(path: string): Promise<TargetFile> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as Partial<TargetFile>;
    if (parsed.schemaVersion === 1 && Array.isArray(parsed.targets)) {
      return { schemaVersion: 1, updatedAt: parsed.updatedAt ?? "", targets: parsed.targets };
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return { schemaVersion: 1, updatedAt: "", targets: [] };
}

function upsert(targets: Target[], incoming: Target): void {
  const existing = targets.find((target) => target.url === incoming.url);
  if (!existing) {
    targets.push(incoming);
    return;
  }
  existing.queries = [...new Set([...existing.queries, ...incoming.queries])];
  existing.priorityScore = Math.max(existing.priorityScore, incoming.priorityScore);
  existing.priorityReasons = [...new Set([...existing.priorityReasons, ...incoming.priorityReasons])];
  existing.excerpt ??= incoming.excerpt;
  existing.author ??= incoming.author;
  existing.publishedDate ??= incoming.publishedDate;
}

async function main(): Promise<void> {
  await loadLocalEnvironment();
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) throw new Error("EXA_API_KEY is required. Add it to .env.local, then run the command through your shell.");

  const requestedPreset = readFlag("--preset") ?? "launch";
  const queries = requestedPreset === "launch" ? PRESETS_ALL : PRESETS[requestedPreset];
  if (!queries) throw new Error(`Unknown preset “${requestedPreset}”. Use launch, conversations, creators, or communities.`);

  const parsedLimit = Number(readFlag("--limit") ?? DEFAULT_LIMIT);
  const limit = Number.isInteger(parsedLimit) && parsedLimit >= 1 && parsedLimit <= 25 ? parsedLimit : DEFAULT_LIMIT;
  if (process.argv.includes("--dry-run")) {
    process.stdout.write(`Configuration valid: ${requestedPreset} will run ${queries.length} queries with up to ${limit} results each.\n`);
    return;
  }
  const output = resolve(readFlag("--out") ?? DEFAULT_OUTPUT);
  const database = await loadExisting(output);
  const seenBefore = database.targets.length;

  for (const query of queries) {
    process.stdout.write(`Searching ${query.targetType}: ${query.query}\n`);
    const results = await search(query, apiKey, limit);
    for (const result of results) {
      if (!result.url || !result.title) continue;
      let url: string;
      try {
        url = normaliseUrl(result.url);
      } catch {
        continue;
      }
      const excerpt = excerptOf(result);
      const score = scoreTarget(query.targetType, result.title, excerpt, url);
      upsert(database.targets, {
        id: makeId(url),
        targetType: query.targetType,
        title: result.title,
        url,
        author: result.author,
        publishedDate: result.publishedDate,
        discoveredAt: new Date().toISOString(),
        source: "exa",
        queries: [query.query],
        excerpt,
        ...score,
        status: "new",
        notes: "",
      });
    }
  }

  database.targets.sort((a, b) => b.priorityScore - a.priorityScore || a.title.localeCompare(b.title));
  database.updatedAt = new Date().toISOString();
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(database, null, 2)}\n`, "utf8");
  process.stdout.write(`Saved ${database.targets.length} targets to ${output} (${database.targets.length - seenBefore} new).\n`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
