/**
 * District.in showtime scraper for Ithaka's curated Delhi NCR venues.
 *
 * WHY THIS APPROACH:
 * District's cinema pages are Next.js pages that embed a `<script id="__NEXT_DATA__">`
 * JSON blob containing the FULL session dataset server-side-rendered into the page
 * (session times, screen format, per-seat-class price, and a seat-status/availability
 * label) — confirmed by manually inspecting fetched HTML for three different chains
 * (PVR, INOX, Cinepolis) before writing this parser. This is far more reliable than
 * regex/DOM-scraping the visible markup, since it's the exact data the page renders
 * from, not a presentation-layer approximation of it.
 *
 * Path inside that JSON (confirmed against real pages):
 *   json.props.pageProps.data.serverState[cinemaId].arrangedSessions
 *     -> array of { entityName: <movie title>, sessions: [...] }
 *   each session: { showTime: "YYYY-MM-DDTHH:MM" (24h, UTC — NOT local/IST, confirmed by
 *                    comparing the Priya venue page's embedded JSON against its rendered
 *                    HTML: embedded 07:45/11:15/14:45/18:15 vs. rendered 1:15 PM/4:45 PM/
 *                    8:15 PM/11:45 PM — exactly +5:30 IST offset on each), scrnFmt,
 *                    premiumLabel, areas: [{ label, price, seatStatus }, ...] }
 *
 * Multi-day: passing `?fromdate=YYYY-MM-DD` to a venue URL returns that date's sessions in
 * the same __NEXT_DATA__ shape (the bare URL returns "today" per District's own clock). This
 * script fetches today/tomorrow/day-after (computed in IST, host-timezone independent) for
 * every venue and merges the results.
 *
 * Run: npm run scrape:district
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const VENUES_PATH = path.join(ROOT, "data", "venues-curated.json");
const OUTPUT_PATH = path.join(ROOT, "data", "showtimes-live.json");

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 15_000;
const DELAY_BETWEEN_REQUESTS_MS = 750; // polite pacing per BRIEF.md's "low-volume scraper" posture
const MOVIE_TITLE = "The Odyssey";
const IST_OFFSET_MS = 330 * 60 * 1000; // +5:30
// 5 IST dates: today through +4 — enough to always cover the coming
// weekend (the "This weekend" Helm option needs Sat/Sun data even when
// opened on a Tuesday). District publishes ~5 sessionDates; fromdate
// pages beyond what's published just return zero sessions, harmlessly.
const DAYS_PER_VENUE = 5;

/**
 * district.in cinema page URL for each of the 15 curated venues (data/venues-curated.json ids).
 *
 * `priya-vasant-vihar` and `ambience-gurugram-kotak-imax` were pre-confirmed by earlier
 * project research and reused as-is. The remaining 13 were resolved by fetching district.in's
 * city-level "The Odyssey" listing pages (delhi-ncr, gurgaon, new-delhi, noida, ghaziabad —
 * URL pattern https://www.district.in/movies/the-odyssey-movie-tickets-in-<city-slug>-MV187151)
 * and matching venue names against venues-curated.json's `name`/`locality` fields, using the
 * stable CD###### cinema code as the canonical identifier (district.in lists the same CD code
 * under multiple city-slug URL variants; any working variant was picked).
 *
 * All 15 curated venues resolved to a confident URL — none were left unresolved.
 */
const DISTRICT_URLS: Record<string, string> = {
  "priya-vasant-vihar":
    "https://www.district.in/movies/pvr-imax-with-laser-priya-vasant-vihar-new-delhi-in-new-delhi-CD1022246",
  "select-citywalk-saket":
    "https://www.district.in/movies/pvr-select-city-walk-saket-new-delhi-in-delhi-ncr-CD1022254",
  "mall-of-india-noida":
    "https://www.district.in/movies/pvr-superplex-mall-of-india-sector-18-noida-in-delhi-ncr-CD1024358",
  "vegas-dwarka":
    "https://www.district.in/movies/pvr-vegas-dwarka-new-delhi-in-gurgaon-CD1022286",
  "ambience-gurugram-kotak-imax":
    "https://www.district.in/movies/pepsi-pvr-ambience-ambience-mall-gurugram-in-gurgaon-CD1022302",
  "inox-paras-nehru-place":
    "https://www.district.in/movies/inox-coca-cola-imax-paras-nehru-place-delhi-in-delhi-ncr-CD1018957",
  "inox-vishal-mall-rajouri":
    "https://www.district.in/movies/inox-vishal-mall-rajouri-garden-new-delhi-in-delhi-ncr-CD1018962",
  "inox-insignia-epicuria":
    "https://www.district.in/movies/inox-insignia-at-epicuria-nehru-place-new-delhi-in-delhi-ncr-CD1018958",
  "cinepolis-dlf-avenue-saket":
    "https://www.district.in/movies/cinepolis-dlf-avenue-saket-new-delhi-in-delhi-ncr-CD1390",
  "devgn-cinex-elan-epic":
    "https://www.district.in/movies/devgn-cinex-formerly-ny-elan-epic-gurugram-in-gurgaon-CD1029765",
  "wave-cinemas-gurugram":
    "https://www.district.in/movies/wave-cinemas-gurugram-in-gurgaon-CD1039102",
  "directors-cut-mall-of-india-noida":
    "https://www.district.in/movies/pvr-directors-cut-dlf-mall-of-india-noida-in-delhi-ncr-CD1058603",
  "inox-pacific-mall-jasola":
    "https://www.district.in/movies/inox-pacific-mall-jasola-new-delhi-in-delhi-ncr-CD1018963",
  "pvr-cinemagic-pitampura":
    "https://www.district.in/movies/pvr-cinemagic-unity-one-elegante-nsp-pitampura-in-delhi-ncr-CD1102047",
  "new-us-cinemas-ghaziabad":
    "https://www.district.in/movies/new-us-cinemas-aditya-mall-ghaziabad-in-new-delhi-CD25281",
};

interface CuratedVenue {
  id: string;
  name: string;
  locality: string;
  city: string;
  [key: string]: unknown;
}

interface Showtime {
  date: string; // "YYYY-MM-DD", IST — converted from District's UTC showTime. Kept explicit
  // (rather than assumed) because late-night sessions fetched under one `?fromdate=` can
  // convert to the following IST date (see IST conversion helpers below).
  time: string; // e.g. "6:15 PM", IST
  format: string; // e.g. "IMAX 2D", "ONYX 2D", "4DX-2D"
  /** District's own whole-show aggregate label (session.seatStatus), e.g. "Filling Fast" — NOT
   * a worst-case-across-seat-classes computation. That approach was tried and rejected: a show
   * that's 62% full overall (143/381 seats) still has small premium tiers like Recliner (16
   * seats) sell out first, which made almost every real show read "Sold Out" — misleading. */
  availability: string | null;
  /** Seats available / total across the whole show, straight from District's own rollup. */
  seatsAvailable: number | null;
  seatsTotal: number | null;
  /** Bonus, not required by spec: min-max ticket price across seat classes that are actually
   * still purchasable (excludes Sold Out / disableClick tiers — a price you can't pay isn't a
   * real price band, per this project's "never oversell" rule). Null if every class is sold out. */
  priceRange: { min: number; max: number } | null;
  /** The seat-class label (e.g. "CLASSIC", "RECLINER") that priceRange.min actually belongs
   * to — added so the UI can show a real class name instead of inventing one. Null alongside
   * priceRange when everything's sold out. */
  cheapestSeatClassLabel: string | null;
}

interface VenueResult {
  venueId: string;
  districtUrl: string | null;
  fetchedAt: string;
  showtimes: Showtime[];
  error?: string;
}

// --- district.in's embedded __NEXT_DATA__ shapes (only the fields we read) ---

interface DistrictArea {
  label?: string;
  price?: number;
  seatStatus?: string;
  disableClick?: boolean; // true means this seat class is sold out / not actually bookable
}

interface DistrictSession {
  showTime?: string; // "YYYY-MM-DDTHH:MM"
  scrnFmt?: string;
  premiumLabel?: string | null;
  areas?: DistrictArea[];
  avail?: number; // seats available, whole-session total across all seat classes
  total?: number; // total seats, whole-session
  statusColor?: string; // district's own pressure indicator: G/Y/R/D (roughly Available/Filling Fast/Almost Full/Sold Out)
  seatStatus?: string; // district's own human-readable label for the whole show, e.g. "Filling Fast" — the field actually used now
}

interface DistrictArrangedEntity {
  entityName?: string;
  sessions?: DistrictSession[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/**
 * Converts a District `showTime` string ("YYYY-MM-DDTHH:MM", UTC — see file header) into its
 * IST calendar date and time-of-day. Uses Date.UTC()/getUTC*() exclusively so the result is
 * identical regardless of the host machine's local timezone (GitHub Actions runners are UTC).
 */
function utcShowTimeToIst(showTime: string): { date: string; hhmm: string } {
  const [datePart, timePart] = showTime.split("T");
  const [y, mo, d] = datePart.split("-").map((s) => parseInt(s, 10));
  const [h, mi] = timePart.split(":").map((s) => parseInt(s, 10));
  const utcMs = Date.UTC(y, mo - 1, d, h, mi);
  const istMs = utcMs + IST_OFFSET_MS;
  const ist = new Date(istMs);
  const date = `${ist.getUTCFullYear()}-${pad2(ist.getUTCMonth() + 1)}-${pad2(ist.getUTCDate())}`;
  const hhmm = `${pad2(ist.getUTCHours())}:${pad2(ist.getUTCMinutes())}`;
  return { date, hhmm };
}

/**
 * Returns the current IST calendar date ("YYYY-MM-DD") plus `count - 1` subsequent IST dates,
 * computed from the current UTC instant + IST offset so it's host-timezone independent.
 */
function istDateSequence(count: number): string[] {
  const nowIstMs = Date.now() + IST_OFFSET_MS;
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(nowIstMs + i * 24 * 60 * 60 * 1000);
    dates.push(`${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`);
  }
  return dates;
}

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

function extractNextData(html: string): unknown {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
  );
  if (!match) {
    throw new Error('__NEXT_DATA__ script tag not found in fetched HTML');
  }
  return JSON.parse(match[1]);
}

function formatTime24hTo12h(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr ?? "00";
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${period}`;
}

function buildFormatLabel(session: DistrictSession): string {
  const scrnFmt = (session.scrnFmt ?? "").trim();
  const premium = (session.premiumLabel ?? "").trim();
  if (!premium) return scrnFmt || "UNKNOWN";
  if (scrnFmt.toUpperCase().includes(premium.toUpperCase())) return scrnFmt;
  return `${premium} ${scrnFmt}`.trim();
}

function buildPriceRange(session: DistrictSession): { min: number; max: number } | null {
  // Only seat classes that are actually still bookable — a "Sold Out" Recliner tier's price
  // isn't a real option for anyone, and including it in the range overstates what's available.
  const prices = (session.areas ?? [])
    .filter((a) => a.disableClick !== true)
    .map((a) => a.price)
    .filter((p): p is number => typeof p === "number");
  if (prices.length === 0) return null;
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

function buildCheapestSeatClassLabel(session: DistrictSession): string | null {
  const bookable = (session.areas ?? []).filter(
    (a) => a.disableClick !== true && typeof a.price === "number"
  );
  if (bookable.length === 0) return null;
  const cheapest = bookable.reduce((min, a) => ((a.price as number) < (min.price as number) ? a : min));
  return cheapest.label ?? null;
}

type ShowtimeWithSortKey = Showtime & { _sortKey: string };

function parseShowtimesFromNextData(nextData: unknown): ShowtimeWithSortKey[] {
  // Defensive traversal — district.in's page shape isn't a public contract, so every
  // step is optional-chained; anything missing just means "no showtimes found", not a crash.
  const data = (nextData as any)?.props?.pageProps?.data;
  const serverState = data?.serverState;
  if (!serverState || typeof serverState !== "object") {
    throw new Error("serverState missing from __NEXT_DATA__ (page shape may have changed)");
  }

  const cinemaEntries = Object.values(serverState) as any[];
  const showtimes: ShowtimeWithSortKey[] = [];

  for (const entry of cinemaEntries) {
    const arranged: DistrictArrangedEntity[] = entry?.arrangedSessions ?? [];
    for (const movie of arranged) {
      if ((movie.entityName ?? "").trim().toLowerCase() !== MOVIE_TITLE.toLowerCase()) {
        continue;
      }
      for (const session of movie.sessions ?? []) {
        const showTime = session.showTime;
        if (!showTime || !showTime.includes("T")) continue;
        // showTime is UTC (see file header) — convert to IST before deriving date/time.
        const { date, hhmm } = utcShowTimeToIst(showTime);
        showtimes.push({
          date,
          time: formatTime24hTo12h(hhmm),
          format: buildFormatLabel(session),
          availability: session.seatStatus ?? null,
          seatsAvailable: typeof session.avail === "number" ? session.avail : null,
          seatsTotal: typeof session.total === "number" ? session.total : null,
          priceRange: buildPriceRange(session),
          cheapestSeatClassLabel: buildCheapestSeatClassLabel(session),
          _sortKey: `${date}T${hhmm}`, // IST instant as "YYYY-MM-DDTHH:MM" — sorts correctly lexicographically
        } as ShowtimeWithSortKey);
      }
    }
  }

  // Sorting/deduping/stripping the internal sort key happens once, after merging this list
  // with the other IST-date fetches for the same venue — see mergeDedupeSortShowtimes().
  return showtimes;
}

/**
 * Merges the showtime lists from a venue's multiple date fetches (today/tomorrow/day-after),
 * deduping same date+time+format sessions that can appear twice (e.g. a late-night IST
 * rollover session returned by both the bare "today" fetch and the next day's `?fromdate=`
 * fetch), sorts by the converted IST instant, then strips the internal sort key.
 */
function mergeDedupeSortShowtimes(lists: ShowtimeWithSortKey[][]): Showtime[] {
  const byKey = new Map<string, ShowtimeWithSortKey>();
  for (const list of lists) {
    for (const s of list) {
      const key = `${s.date}|${s.time}|${s.format}`;
      if (!byKey.has(key)) byKey.set(key, s);
    }
  }
  const merged = Array.from(byKey.values());
  merged.sort((a, b) => (a._sortKey < b._sortKey ? -1 : a._sortKey > b._sortKey ? 1 : 0));
  return merged.map(({ _sortKey, ...rest }) => rest);
}

/** Builds the URL for one IST date: bare venue URL for "today", `?fromdate=` otherwise. */
function buildDateUrl(baseUrl: string, istDate: string, isToday: boolean): string {
  return isToday ? baseUrl : `${baseUrl}?fromdate=${istDate}`;
}

async function fetchVenueDate(url: string): Promise<ShowtimeWithSortKey[]> {
  const html = await fetchHtml(url);
  const nextData = extractNextData(html);
  return parseShowtimesFromNextData(nextData);
}

interface DateFetchTask {
  istDate: string;
  isToday: boolean;
  url: string;
}

async function main() {
  const raw = await readFile(VENUES_PATH, "utf8");
  const parsed = JSON.parse(raw);
  const venues: CuratedVenue[] = parsed.shortlist ?? [];

  const istDates = istDateSequence(DAYS_PER_VENUE);
  console.log(`IST dates to fetch per venue: ${istDates.join(", ")}`);

  const results: Record<string, VenueResult> = {};
  let ok = 0;
  let failed = 0;
  let unresolved = 0;

  // Flatten per-venue date tasks up front so pacing (the sleep between requests) applies
  // uniformly across all ~45 requests, not just between venues.
  const venueTasks: { venue: CuratedVenue; baseUrl: string; tasks: DateFetchTask[] }[] = [];
  for (const venue of venues) {
    const baseUrl = DISTRICT_URLS[venue.id];
    if (!baseUrl) {
      unresolved++;
      results[venue.id] = {
        venueId: venue.id,
        districtUrl: null,
        fetchedAt: new Date().toISOString(),
        showtimes: [],
        error: "No district.in URL resolved for this venue.",
      };
      console.log(`[${venue.id}] SKIPPED - no URL resolved`);
      continue;
    }
    const tasks: DateFetchTask[] = istDates.map((istDate, idx) => ({
      istDate,
      isToday: idx === 0,
      url: buildDateUrl(baseUrl, istDate, idx === 0),
    }));
    venueTasks.push({ venue, baseUrl, tasks });
  }

  const totalFetches = venueTasks.reduce((sum, v) => sum + v.tasks.length, 0);
  let fetchIndex = 0;

  for (const { venue, baseUrl, tasks } of venueTasks) {
    const fetchedAt = new Date().toISOString();
    const successLists: ShowtimeWithSortKey[][] = [];
    const errors: string[] = [];

    for (const task of tasks) {
      console.log(`[${venue.id}] fetching (${task.istDate}) ${task.url}`);
      try {
        const showtimes = await fetchVenueDate(task.url);
        successLists.push(showtimes);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${task.istDate}: ${message}`);
        console.log(`[${venue.id}] WARNING - fetch for ${task.istDate} failed: ${message}`);
      }

      fetchIndex++;
      // Polite pacing between requests — not yet on a cron, but still a low-volume scraper per BRIEF.md.
      if (fetchIndex < totalFetches) {
        await sleep(DELAY_BETWEEN_REQUESTS_MS);
      }
    }

    if (successLists.length === 0) {
      // Every date fetch for this venue failed — that's the only case that sets venue-level error.
      failed++;
      results[venue.id] = {
        venueId: venue.id,
        districtUrl: baseUrl,
        fetchedAt,
        showtimes: [],
        error: errors.join("; "),
      };
      console.log(`[${venue.id}] FAILED - all ${tasks.length} date fetches failed`);
    } else {
      ok++;
      const showtimes = mergeDedupeSortShowtimes(successLists);
      results[venue.id] = { venueId: venue.id, districtUrl: baseUrl, fetchedAt, showtimes };
      const partial = errors.length > 0 ? ` (${errors.length}/${tasks.length} date fetches failed)` : "";
      console.log(`[${venue.id}] OK - ${showtimes.length} showtimes${partial}`);
    }
  }

  const datesCovered = Array.from(
    new Set(Object.values(results).flatMap((r) => r.showtimes.map((s) => s.date)))
  ).sort();

  const output = {
    // Documented output shape:
    // Record<venueId, { venueId, districtUrl, fetchedAt, showtimes: [{ time, format, availability, priceRange }], error? }>
    _meta: {
      generatedAt: new Date().toISOString(),
      movieTitle: MOVIE_TITLE,
      source: "district.in (__NEXT_DATA__ embedded session JSON)",
      timezone: "IST (converted from District's UTC showTime fields)",
      datesCovered,
      totalVenues: venues.length,
      ok,
      failed,
      unresolved,
    },
    venues: results,
  };

  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf8");
  console.log(
    `\nWrote ${OUTPUT_PATH} — ${ok} ok, ${failed} failed, ${unresolved} unresolved (of ${venues.length} venues).`
  );
}

main().catch((err) => {
  console.error("Fatal error running scraper:", err);
  process.exitCode = 1;
});
