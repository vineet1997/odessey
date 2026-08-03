/**
 * Enriches an explicitly selected outreach cohort with public contact routes
 * and page context. It does not discover new targets, follow links, collect
 * private data, or send messages.
 *
 * Usage:
 *   npm run enrich:outreach
 *   npm run enrich:outreach -- --dry-run
 *   npm run enrich:outreach -- --limit 3
 *   npm run enrich:outreach -- --targets data/distribution/another-cohort.json
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const FIRECRAWL_SCRAPE_URL = "https://api.firecrawl.dev/v2/scrape";
const DEFAULT_TARGETS = "data/distribution/first-cohort.json";
const DEFAULT_OUTPUT = "data/distribution/enriched-first-cohort.json";

interface CohortTarget {
  name: string;
  targetType: "creator" | "community";
  url: string;
  collaborationAngle: string;
}

interface CohortFile {
  schemaVersion: 1;
  targets: CohortTarget[];
}

interface FirecrawlResponse {
  success?: boolean;
  data?: {
    markdown?: string;
    links?: string[];
    metadata?: {
      title?: string;
      description?: string;
      sourceURL?: string;
      url?: string;
      statusCode?: number;
      error?: string;
    };
  };
}

interface EnrichedTarget extends CohortTarget {
  enrichedAt: string;
  sourceUrl: string;
  pageTitle?: string;
  pageDescription?: string;
  publicEmails: string[];
  publicContactRoutes: string[];
  publicSocialProfiles: string[];
  briefingExcerpt?: string;
  status: "ready_for_review" | "needs_manual_research";
  error?: string;
}

function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

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

function cleanedExcerpt(markdown: string | undefined): string | undefined {
  if (!markdown) return undefined;
  const text = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/[#>*_`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, 900) : undefined;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function findPublicEmails(markdown: string | undefined): string[] {
  if (!markdown) return [];
  return unique(
    [...markdown.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)]
      .map((match) => match[0].toLowerCase())
      .filter((email) => !email.endsWith("@example.com"))
  );
}

function classifyLinks(links: string[]): Pick<EnrichedTarget, "publicContactRoutes" | "publicSocialProfiles"> {
  const usable = links.filter((link) => /^https?:\/\//i.test(link));
  const publicContactRoutes = unique(
    usable.filter((link) => /contact|connect|join|membership|about|mailto:/i.test(link))
  ).slice(0, 10);
  const publicSocialProfiles = unique(
    usable.filter((link) => /instagram\.com|youtube\.com|linkedin\.com|threads\.net|x\.com|twitter\.com|facebook\.com/i.test(link))
  ).slice(0, 10);
  return { publicContactRoutes, publicSocialProfiles };
}

async function scrapeTarget(target: CohortTarget, apiKey: string): Promise<EnrichedTarget> {
  const response = await fetch(FIRECRAWL_SCRAPE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url: target.url,
      formats: ["markdown", "links"],
      onlyMainContent: true,
      blockAds: true,
      removeBase64Images: true,
      maxAge: 86_400_000,
      timeout: 30_000,
    }),
  });

  if (!response.ok) {
    return {
      ...target,
      enrichedAt: new Date().toISOString(),
      sourceUrl: target.url,
      publicEmails: [],
      publicContactRoutes: [],
      publicSocialProfiles: [],
      status: "needs_manual_research",
      error: `Firecrawl returned HTTP ${response.status}`,
    };
  }

  const payload = (await response.json()) as FirecrawlResponse;
  const data = payload.data;
  if (!payload.success || !data) {
    return {
      ...target,
      enrichedAt: new Date().toISOString(),
      sourceUrl: target.url,
      publicEmails: [],
      publicContactRoutes: [],
      publicSocialProfiles: [],
      status: "needs_manual_research",
      error: data?.metadata?.error ?? "Firecrawl returned no usable page data",
    };
  }

  const routes = classifyLinks(data.links ?? []);
  const hasContactRoute = routes.publicContactRoutes.length > 0 || routes.publicSocialProfiles.length > 0 || findPublicEmails(data.markdown).length > 0;
  return {
    ...target,
    enrichedAt: new Date().toISOString(),
    sourceUrl: data.metadata?.sourceURL ?? data.metadata?.url ?? target.url,
    pageTitle: data.metadata?.title,
    pageDescription: data.metadata?.description,
    publicEmails: findPublicEmails(data.markdown),
    ...routes,
    briefingExcerpt: cleanedExcerpt(data.markdown),
    status: hasContactRoute ? "ready_for_review" : "needs_manual_research",
  };
}

async function main(): Promise<void> {
  await loadLocalEnvironment();
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY is required. Add it to .env.local, then run the command again.");

  const inputPath = resolve(readFlag("--targets") ?? DEFAULT_TARGETS);
  const outputPath = resolve(readFlag("--out") ?? DEFAULT_OUTPUT);
  const cohort = JSON.parse(await readFile(inputPath, "utf8")) as Partial<CohortFile>;
  if (cohort.schemaVersion !== 1 || !Array.isArray(cohort.targets)) {
    throw new Error(`Invalid target file: ${inputPath}`);
  }
  const requestedLimit = Number(readFlag("--limit") ?? cohort.targets.length);
  const targets = cohort.targets.slice(0, Number.isInteger(requestedLimit) && requestedLimit > 0 ? requestedLimit : cohort.targets.length);
  if (process.argv.includes("--dry-run")) {
    process.stdout.write(`Configuration valid: ${targets.length} explicitly selected public pages will be scraped.\n`);
    return;
  }

  const enriched: EnrichedTarget[] = [];
  for (const target of targets) {
    process.stdout.write(`Enriching ${target.name}: ${target.url}\n`);
    enriched.push(await scrapeTarget(target, apiKey));
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify({ schemaVersion: 1, enrichedAt: new Date().toISOString(), targets: enriched }, null, 2)}\n`, "utf8");
  const ready = enriched.filter((target) => target.status === "ready_for_review").length;
  process.stdout.write(`Saved ${enriched.length} enrichment briefs to ${outputPath} (${ready} with a public route to review).\n`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
