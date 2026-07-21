# ITHAKA
### Where should *you* watch The Odyssey in Delhi NCR?

**Working name:** Ithaka — in the poem, every mile of Odysseus's journey is about getting home. Our sharpest feature is literally "will you make it home tonight." The name is the product thesis.

---

## The one-liner

A single-purpose web app that answers one question with editorial confidence and personal arithmetic: **which screen, which show, for you** — balancing how good the screen is against what it costs you in money, time, and the trip home.

## Why now (and why only now)

- The film opened **July 17, 2026**. The argument — "is the IMAX worth it or do I just go to the mall near me?" — is happening in every Delhi group chat *this week*.
- It runs **172 minutes**. An 8:15pm show ends ~11:20pm — after the last metro on most lines. Nobody else models this.
- **India has no IMAX 70mm film screens.** The honest answer to "where's the best experience" requires curation, not marketing copy: IMAX with Laser (Priya Vasant Vihar, Select Citywalk Saket) sits at the top of what NCR actually offers.
- Ticket prices span **₹350 to ₹2,500** for the same film — sometimes ₹900 vs ₹2,400 *inside the same building*. "Value" is a real, computable dimension.

This is a **drop**, not a platform. It matters intensely for ~6 weeks. Every decision below is downstream of that.

## The insight (three truths)

1. **"Best screen" is objective.** A film shot on IMAX cameras has a correct viewing hierarchy. We hard-code it, per venue *and* format, with a one-line editorial verdict each. This is the moat — Google Maps can't have opinions.
2. **"Best choice" is personal.** Distance, budget, and transport turn one objective ranking into a different answer for a student in Kamla Nagar vs a couple in DLF Phase 5.
3. **Nobody models the journey home.** 172 minutes + last metro ≈ 11pm means showtime choice decides whether the trip home costs ₹40 or ₹600. This is our signature output — the screenshot moment.

## The experience (60 seconds, four taps)

1. **Where's home?** — curated locality picker, ~40 NCR localities. No GPS permission, no typing.
2. **When are you going?** — weekday / weekend, then matinée / evening / night.
3. **What matters most?** — one of three intents (below).
4. **The answer.** One confident recommendation + one runner-up. Each is a *narrative card*, not a table row:

> **PVR Priya IMAX, Vasant Vihar** — the best screen in North India for this film. IMAX with Laser, the format it was made for.
> ₹2,100 · 45 min by metro (Magenta Line → 12 min walk) · **Take the 4:45 show — after the 8:15 you won't have a train home.**
> ~₹4,350 all-in for two, door to door.

Card is screenshot-composed: it should look good in a WhatsApp forward. Deep link out to booking (District/BookMyShow) and to Google Maps directions. No booking inside the app, ever.

## The three intents (presets, not sliders)

| Intent | Weighting philosophy |
|---|---|
| **The Full Epic** | Experience dominates. Cost and distance are tiebreakers. |
| **Worth Every Rupee** | Experience per rupee — ticket + travel *both ways*. Often lands on Saket IMAX classic seats: 90% of the experience at 40% of the price. |
| **The Easy Evening** | Door-to-door time and transport certainty dominate; experience is a floor (we'll never send you to a bad screen), not a ceiling. |

**Scoring:** weighted sum over four normalized dimensions — hard-coded experience score (per venue+format), total cost (tickets + transport, round trip), door-to-door time, transport feasibility. Feasibility is partly a **gate**: "no way home after this show" is a heavy penalty with an explicit warning, not a silent deduction. Showtime band shifts both price band and the last-train verdict.

## The data — two layers

**Layer 1: Curated (the opinion, hand-built once)**
- **Venues (~12–15, hand-picked):** name, lat/lng, formats with per-format experience score (0–100) and one-line editorial verdict, price bands as fallback (weekday/weekend × time band × seat class), nearest metro station + walk minutes, parking notes.
- **Metro:** derived once from Delhi's Open Transit Data GTFS (otd.delhi.gov.in) — nearest stations, interchange counts, last-train times. Precomputed, shipped as JSON.
- **Localities (~40):** name, lat/lng, nearest metro station.

**Layer 2: Live (the facts, refreshed by a robot)**
- **Showtimes & availability — scraped from District (verified feasible):** District's pages are server-rendered — real showtimes, formats, and seat-pressure labels ("Filling fast", "Almost full") sit in plain HTML with no bot defenses. A scheduled job fetches our ~15 venue pages every 30–60 min. One source covers every chain. (PVR's own JSON API is the documented fallback if District hardens; BookMyShow is deliberately avoided — heavily bot-protected, strictest ToS, and redundant.)
- **Per-show prices — build-phase investigation:** live on District one layer deeper (the seat-picker request). If reachable, great; if not, curated price bands (±₹100, verified against real listings) carry the ranking fine.
- **Travel times — live-first via a routing proxy, matrix as backup:** each recommendation calls our `/api/route` Edge Function for the user's exact locality→venue pairs (traffic-aware, ~5 calls per session — 10K/month free tier supports ~60 sessions/day at this rate). The precomputed 40×15×3 matrix is the fallback and the scale path: if quota nears the cap or the call fails, the function silently returns matrix values instead. In-app, each card gets a free Maps Embed directions view + deep links.
- **Cab estimate — honest approximation with surge:** Uber/Rapido/Ola expose no public fare APIs (Uber's ToS bans comparison use outright). We ship a Delhi fare-card formula over distance+time, hand-calibrated against the apps on ~10 real routes, with time-based surge multipliers (weekend evenings ~×1.2, post-11pm ~×1.3–1.4) — always shown as a range ("₹450–600"), labeled as an estimate.

Every recommendation card carries a "prices/shows as of X minutes ago" stamp. If the scraper breaks, the app degrades to last-known data, then to the curated snapshot — it never breaks in the user's hands.

## What we are not building

In-app booking (deep-link out to District) · user accounts · reviews or ratings · other cities · a general-purpose cinema engine · BookMyShow scraping · a database or application backend. Each cut is what keeps the ship date inside the film's theatrical window.

## Experience principles (design phase to follow)

- **Editorial voice throughout** — the app talks like a film-obsessed friend, not a booking portal. Copy is a feature.
- **One answer, confidently held.** Never a list of 15 options. Recommendation-as-narrative.
- **Dark, cinematic, restrained** — the aesthetic of a title sequence, not a ticketing app. No generic component-library look.
- **Built to be forwarded.** The result card is the marketing.
- **Themed to the film itself.** The Odyssey's own visual language — sea-voyage motion, epic/mythic typography, Nolan's desaturated-amber grading — should read through the UI, not just live in the copy. Not a generic dark-mode app; a small, specific thing that could only be about this film. Full direction via a dedicated design pass (ui-ux-pro-max) before any build — includes exploring scroll-driven reveals, zoom transitions, and motion (GSAP) that make the four-tap flow feel like a journey rather than a form.

## Trust: the metric that actually matters

Shares are vanity if the recommendation doesn't hold up. **The real success metric is conversion without verification** — the % of users who tap through to book (District deep link) directly off our card, without first re-checking BookMyShow or Google Maps themselves. That's the bar: did we actually replace the manual research, or just add an opinion on top of it?

What earns that trust, to work into the design pass:
- **Show the reasoning, briefly.** Not a black box — a one-line "why this, not the other one" per card (e.g. "beats Select Citywalk by ₹200 for the same screen"), so the verdict feels inspected, not asserted.
- **Freshness as a visible signal**, not fine print — "prices as of 12 min ago" builds more confidence than silence does, especially because it implies the alternative (BookMyShow, right now) wouldn't tell you anything we haven't already.
- **The runner-up is not padding** — seeing the second-best option, and why it lost, is what makes the top pick feel like a real comparison rather than a random pick.
- **Never oversell.** If data is stale or a price is a band not a confirmed number, say so plainly. One caught inaccuracy costs more trust than ten accurate calls earn.

## Noted for later: variables we're not solving now

- **Party size changes the math.** Cost is currently computed as "for you"; for a group, per-person cab fare can undercut per-person metro once you're 3–4 people splitting one car — a different winner than the solo case. Not building this input in v1 (keeps the four-tap flow intact), but the scoring engine's cost dimension should be structured as *total cost ÷ party size* from the start, even with party size hardcoded to 1, so adding a "how many of you?" input later is a UI change, not a rearchitecture.

## Tech: a static app, fed by a robot, with one thin door for live routing

*(This section previously contradicted itself — said "everything precomputed" while also promising live per-user Google Routes calls. Resolved below: two separate mechanisms, not one.)*

**The app** — React + Vite static site, scoring engine as a pure, unit-testable TypeScript module, deployed on Vercel. Showtimes, prices, venue scores, and metro facts load from one pre-built `data.json`. No database.

**The scraper** — a scheduled job (GitHub Actions cron, free) wakes every 30–60 minutes: scrape District for our ~15 venues → merge with the curated layer → emit a timestamped `data.json` → trigger redeploy. ~150 lines of boring, reliable script. If it fails, the app serves last-known data.

**The routing call** — this is the one thing that can't be a static file, because it's genuinely per-user (their locality → a venue, at a specific time). It also can't be called directly from the browser: a Google Maps key usable client-side is public by nature, and we want quota control in one place. So it's a **single tiny Vercel Edge Function** — `/api/route`: takes origin+destination, calls Google Routes with the server-held key, and falls back to the precomputed 40×15×3 matrix if quota is tight or the call errors. This is the only server-side code in the project — a stateless proxy with a fallback, not an app backend.

**Costs & keys:** one Google Maps key (Embed API free; Routes inside the 10K/month free tier — the Edge Function is what makes the quota enforceable in one place instead of trusting the client). GitHub Actions, Vercel static hosting, and the Edge Function's free tier all cost ₹0.

**Honesty note:** scraping District sits in ToS gray territory. Mitigations: tiny volume (~15 pages/hour), no redistribution beyond facts (showtimes and prices aren't copyrightable), we send them booking traffic via deep links, and the 6-week window limits exposure. If they block us, degradation is graceful by design.

## Success looks like

Primary: people book off our card without leaving to double-check (see **Trust**, above — this is the metric that proves we replaced the manual research rather than added to it). Secondary, and still real: someone we've never met screenshots their card into a group chat with "okay this is scary accurate" — that's distribution, but it's downstream of trust, not a substitute for it.

## Open questions

1. Name: **Ithaka** vs something more literal for discoverability ("Odyssey Screen Finder, Delhi").
2. Per-show price scraping: confirmed or fallback to bands — resolved in the first build-phase spike.
3. Venue list final cut — needs a verification pass per venue (formats, current prices) before data entry.
4. ~~Routing proxy platform~~ — **decided 2026-07-20: Vercel Edge Function**, same platform as the app deploy, no cross-origin setup.
5. Ambience Mall IMAX laser-vs-xenon and price — needs a phone call to the venue, not resolvable by search (see data gap findings above).

## Setup: Google Maps API key (Vineet's action item)

This is the one piece of external setup the project needs; account/billing creation isn't something I can do for you. Steps:

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a new project (e.g. "ithaka-odyssey").
2. Enable **three APIs**: *Routes API*, *Maps Embed API*, *Maps JavaScript API* is NOT needed (we use Embed, not the JS SDK) — just Routes + Embed.
3. **Billing must be linked** even though we expect ₹0 spend — Google requires a card on file to issue keys past the free tier, but Routes API stops (doesn't silently overbill) once free quota is exhausted unless you separately raise a budget cap. Set a budget alert at, say, $1 as a tripwire.
4. Create an API key under **Credentials**. Create it **unrestricted initially**, then once the Edge Function's server address is known, restrict it by **IP** (server-side key) rather than HTTP referrer (referrer restriction is for browser-exposed keys, which this isn't — the whole point of the Edge Function is that this key never reaches the client).
5. Send me the key value directly in chat when ready, or better: add it as an environment variable named `GOOGLE_MAPS_SERVER_KEY` directly in the Vercel project dashboard once that project exists (Vercel → Settings → Environment Variables) — that way it never touches our conversation history at all.

## Model usage plan

Build like an elite team where seniority matches ambiguity:

- **Fable (design & judgment):** scoring model + weight calibration, editorial verdicts and all user-facing copy, the UX/UI design pass, District price-layer reverse-engineering spike, code review of everything Sonnet ships, anything ambiguous or taste-driven.
- **Sonnet (spec-driven build):** the District scraper against a documented page structure, GTFS→metro-JSON parsing script, React components from the design spec, GitHub Actions workflow, unit tests, geocoding/data-entry chores, ongoing scraper maintenance.
- **Pattern:** Fable writes the interface + acceptance criteria → delegates to a Sonnet subagent → reviews the diff. Nothing taste-driven gets delegated; nothing mechanical gets done at Fable prices.

## Next steps

1. ~~Align on brief~~ · ~~Feasibility probes (District ✓, PVR API ✓)~~ · ~~DLF Phase 2 end-to-end experiment ✓~~ · ~~Design pass ✓ → DESIGN.md~~ · ~~Data gap pass ✓~~ · ~~Infra decision ✓ (Vercel)~~
2. ~~Full NCR venue census & first-pass scoring~~ ✓ 2026-07-20 → `data/VENUE-SCORING.md` + `data/venues-raw.json`. **~75 unique screens found (not ~12-15)** — scored via a format-tier rubric (IMAX Laser → IMAX unconfirmed → premium boutique → Atmos/laser-tagged → 4DX-capped → untagged), every score carries a confidence flag (CONFIRMED/HIGH/UNCONFIRMED/INFERRED). Surfaced: two distinct "Ambience Mall" properties (Vasant Kunj Delhi vs NH8 Gurugram), not yet disambiguated.
3. ~~Curation pass~~ ✓ 2026-07-20 — proceeded with what we have rather than blocking on the confidence gaps below. **15-venue shortlist → `data/venues-curated.json`**, each with editorial verdict + honest confidence flag carried through. Known open items on the shortlist itself: Ambience Gurugram duplication unresolved, Ghaziabad has one weak option and Faridabad has none (real coverage gap, not hidden).
4. Remaining confidence gaps (laser/xenon on 5 venues, Ambience disambiguation) — deferred to a pre-ship verification pass, not blocking the build.
5. ~~Google Maps API key~~ ✓ Vineet has created it, billing enabled, both APIs on — **holding it back from the codebase until the Vercel project exists**, per plan (env var, never in chat).
6. ~~Scaffold + scoring engine + coordinate pass~~ ✓ 2026-07-20. Subagent build hit a session-limit interruption partway through (not a code failure); scaffold and scoring engine were already complete at that point, only the coordinate pass was mid-flight — finished by hand. Final state: Vite+React+TS+Tailwind scaffold wired to MASTER.md tokens exactly (verified: typecheck clean, smoke-test component renders Cinzel/gold/dark correctly); `src/scoring/score.ts` implements the weighted-sum scoring + feasibility gate + `totalCost/partySize` exactly per spec, with 12/12 vitest tests passing (including a test that the three intents genuinely diverge, mirroring the DLF Phase 2 finding). Venue coordinates: **11 of 15 verified** (10 geocoded this pass + 1 pre-verified), **4 honestly flagged** `coords_needs_manual_check` rather than guessed — for 3 of those 4, a real street address was confirmed via web search even though the free geocoder couldn't resolve building-level precision, so the manual lookup that remains is now fast, not a cold search. Bonus find during this pass: **PVR Cinemagic Pitampura's laser projection is now CONFIRMED** (was unconfirmed) via a press writeup of the multiplex's opening — score bumped 65→68.
7. **UI build started 2026-07-20** — decoupled from the live-data pipeline deliberately (the Helm/Result Card don't need the scraper or routing proxy to be built and judged, only realistic fixture data). First piece: the **Result Card** ✓ — `src/components/ResultCard.tsx` + `src/fixtures/sampleResult.ts`, built against DESIGN.md's card anatomy spec, scored through the real `scoreVenue()` engine (not faked numbers). Verified in-browser (screenshot, console clean, no failed font loads) — matches DESIGN.md closely: gold hairline border draw, Cinzel venue name, mono ledger, gold return strip as the signature element, real DMRC Yellow Line color, Greek-key hairline used exactly once. `npm run build` and `npm run dev` both clean.
8. ~~The Helm~~ ✓ 2026-07-20 — `src/components/Helm.tsx` + `src/components/helm/*` + `src/fixtures/localities.ts`. Judgment call made during the build: split BRIEF.md's combined "day + time band" step into two separate single-decision screens (locality → day → time band → intent, 4 screens, one choice each), matching DESIGN.md's "every choice is one tap" more literally than the brief's own numbering. Verified end-to-end (all 4 screens + transition into the existing Result Card) — confirmed the app code itself is correct via direct DOM interaction after the browser automation tool's coordinate-based clicks proved unreliable against a backgrounded/unfocused tab (`document.hidden` even when marked "active" — a tool/environment quirk, reproduced on a fresh tab too, not a code bug; worth trying `tabs_select` + a hard reload first next time this shows up, and falling back to direct `.click()` calls via the JS eval tool to isolate app-code correctness from click-delivery flakiness). `npm test` (12/12) and `npm run build` both clean after the build.
9. ~~Prologue + Crossing~~ ✓ 2026-07-20 — `src/components/Prologue.tsx` (pinned ScrollTrigger scrub through 3 statements + release/CTA, the app's ONLY pinned section, `ScrollTrigger.refresh()` after fonts load) and `src/components/Crossing.tsx` (pure-geometry line-draw + mono log, fixed 1200ms placeholder duration clearly commented as a stand-in for real routing latency once the proxy exists). **All 4 scenes now wired end-to-end in App.tsx**: Prologue (first visit only, gated on `localStorage.ithaka_visited`) → Helm → Crossing → Result. Verified directly in-browser: pin-spacer + exact scroll-height math confirmed the ScrollTrigger setup is structurally correct even though the tool's known hidden-tab quirk prevented visually watching the scrub itself; the full click-through (Begin → all 4 Helm screens → Crossing auto-advancing via its `setTimeout`, unaffected by that same rAF throttling → Result) confirmed working; returning-user skip-to-Helm confirmed on reload. Console clean throughout, 12/12 tests + build still clean.
10. **The full four-scene UI is now built and click-through-verified end to end**, entirely on fixture data.
11. ~~District scraper~~ ✓ 2026-07-20 — `scripts/scrape-district.ts` (`npm run scrape:district`), output → `data/showtimes-live.json`. **All 15 curated venues resolved to a real district.in URL and scraped successfully, live, right now** (The Odyssey is still in theaters). Key technical find: District's cinema pages are Next.js and embed the full session dataset server-side in a `<script id="__NEXT_DATA__">` JSON blob — real showtimes, formats, per-seat-class prices, and availability, no HTML-scraping fragility, no headless browser needed. A subagent build hit a session-limit interruption partway through (same pattern as twice before — not a code failure); it had already found all 15 URLs and built a working scraper, but had just caught a real bug in its own approach and hadn't applied the fix yet when cut off. Finished by hand: **the aggregate availability must come from District's own session-level `seatStatus`/`avail`/`total` fields, not a worst-case-across-seat-classes computation** — the original approach made almost every real show read "Sold Out" just because a small premium tier (e.g. a 16-seat Recliner block) sold out first, even when the show was only ~25% booked overall. Also fixed while in there: price ranges now exclude sold-out seat classes (a price you can't pay isn't a real price band, per the "never oversell" rule), and the date is now threaded through explicitly rather than silently discarded (matters because a late-night scrape run can legitimately return tomorrow's schedule, confirmed against real timestamps during this fix). Verified against real fetched HTML by hand before trusting the fix, not just applied blind.
12. Next: GitHub Actions cron to run the scraper on a schedule, GTFS metro pull, Vercel project creation + the routing proxy Edge Function (Maps key gets wired in at that point — this is also when Crossing's placeholder duration gets replaced with real latency). The 4 remaining manual coordinate lookups (Elan Epic Gurugram, Pacific Mall Jasola, PVR Cinemagic Pitampura, Ambience Mall disambiguation) fold into whichever pass touches that data next. Also queued: wiring `showtimes-live.json` into the actual UI (Helm/ResultCard currently still run on the static fixture).

**Data gap findings (2026-07-20):**
- **Ambience Mall IMAX (laser vs xenon): still unconfirmed.** Public sources only confirm "PVR Kotak IMAX" exists at Ambience with no projector-tech detail — this needs either a phone call to the venue or an on-the-ground check; not resolvable by more searching. Score it conservatively (below Priya/Saket) until confirmed.
- **Ambience IMAX price: still unconfirmed** — District doesn't expose per-seat prices without a booking-flow session (confirms the "per-show prices may need the seat-picker spike" assumption from the tech section).
- **Last-train times: general pattern only, not per-station** — Yellow Line last train ~11:20–11:50pm depending on direction, Magenta ~11:30pm from termini. Real per-station precision still needs the GTFS pull — general web sources don't have it, which is exactly why we planned to derive it from otd.delhi.gov.in rather than search for it live.
- **Correction to an assumption from the DLF Phase 2 experiment: Rapid Metro Gurugram is NOT defunct** — it's operational in 2026, now under Gurugram Metro Rail Ltd (GMRL)/HMRTC rather than DMRC, following a 2024 operational handover. Branding may be shifting ("Gurgaon Metro Rapid Line"); worth a naming check during data entry, not a routing problem.
- **Station→venue walking distances: mixed reliability.** Sikanderpur Metro → Ambience Mall ≈ 2.7 km (that's a real walk-averse distance — likely an auto/cab leg, not a walk, worth noting explicitly in the Ambience venue card). The free geocoder returned an unreliable coordinate for "Sector 32 Noida" station and failed outright on "Malviya Nagar" — reinforces the earlier lesson: **venue AND station coordinates must be hand-verified during data entry, never trusted from live geocoding.**
