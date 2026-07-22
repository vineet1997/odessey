# Brief: "How this was made" page

**Living source material:** [`BUILD-RECORD.md`](./BUILD-RECORD.md) holds the
dated decisions, evidence, trade-offs, and story angles. Update that file as
the app evolves; use this brief to decide how the public page presents it.

*Written 2026-07-22. This is the brief only — the page gets built in a later pass (Sonnet-buildable from this spec). Authority order for any conflict: DESIGN.md > this brief.*

## Why this page exists (two audiences, one page)

1. **The curious visitor** — someone who used Ithaka, felt that it was unusually considered for a "where to watch a movie" tool, and wants to peek behind it. They should leave thinking *"this is what caring about a small thing looks like."*
2. **Vineet's portfolio** — a shareable, standalone URL that demonstrates decision-making, taste, and modern AI-assisted engineering practice to peers, employers, collaborators. The page must work when shared cold on LinkedIn/X with zero context.

The second audience is the demanding one. What impresses that audience is **not** the tech stack — it's *decisions under constraint*: what was cut, what was refused, what was verified rather than assumed. The page's editorial spine is therefore **decisions, not features**. Every section answers: what was the problem, what were the options, what did we choose, what did that cost us.

## Voice & visual rules

Same design system as the app, no exceptions: wine-dark sea palette, Cinzel for section titles, Source Serif 4 for narrative, JetBrains Mono for every fact/number/code fragment. The app's trust device — *opinions in serif, evidence in mono* — IS the page's layout principle: narrative paragraphs in serif, and every claim's receipt (a number, a JSON snippet, a commit hash) beside it in mono. The page must practice what the product preaches: never a claim without its evidence.

No stock imagery, no screenshots-of-code-as-decoration. Every image earns its place (list below).

## Access

- **Route**: hash route `#made` (the app is stage-based with no router; a hash check at App level renders the page and survives direct sharing — `ithaka.example/#made` must work cold).
- **Entry points**: (1) a mono footer link `HOW THIS WAS MADE` under the result card's wordmark footer — visible *after* the product has delivered its value, never before; (2) same link in the Prologue's release screen, small, under the Begin button. Nowhere else — this page is dessert, not navigation.
- Back to app: wordmark at top returns to `#` (fresh flow or remembered state, whatever App already does).

## Structure — eight sections, each one decision-shaped

Titles in Cinzel. Each section ≤ 200 words of serif narrative + its mono receipts. Total page: a 6–8 minute read.

### 1. The premise (hero)
- One line: *"One question — where should you watch The Odyssey in Delhi NCR — answered properly, once."*
- The constraint box (mono): 172-min film · no IMAX 70mm in India · ₹350–2,500 spread · ~6-week relevance window · ₹0/month infrastructure budget · no accounts, no tracking.
- The refusal that defines the product: **we don't list options, we take a position.** BookMyShow gives you 75 screens; decision paralysis is the actual problem. One card, one runner-up, receipts below.

### 2. The trust bet
- The success metric (verbatim): *% of users who book off the card WITHOUT re-verifying on BookMyShow/Maps.* Not shares, not visits — replaced research.
- Design consequences that followed: visible freshness timestamp, runner-up shown as a real comparison, the dossier ("the working") under every verdict, honest staleness over confident guessing.
- Receipt: the graceful-degradation chain (mono diagram): `live route → precomputed matrix → curated snapshot` — the app never silently lies when a data source dies.

### 3. The data layer (the war story section — lead with the timezone bug)
- **The bug that inverted our signature feature**: District's embedded showtimes are UTC; we read them as IST. Every recommendation was 5½ hours early — a "6:15 PM show, easy way home" was really the 11:45 PM show ending 2:37 AM. The last-metro verdict — the whole point of the app — was silently backwards for late shows.
- How it was caught: not by a crash, but by *reading the data with intent* — a 381-seat flagship IMAX doesn't run a 4:15 AM show. Then proven: embedded JSON `18:15` vs the same page's rendered `11:45 PM`. Receipt: that exact pair, side by side, in mono.
- The scraping architecture: District's `__NEXT_DATA__` embedded JSON (no headless browser, no HTML parsing), 15 venues × 5 days every 30 minutes via GitHub Actions, committed to the repo, which triggers the deploy — *the robot feeds a static site*. Receipt: the cron YAML fragment + a real JSON snippet of one showtime.
- The one live call: travel times via a single Vercel Edge Function proxying Google Routes (key server-side, IP-restricted). Everything else is static. Receipt: architecture diagram (below).

### 4. The judgment layer
- The venue census: ~75 screens found, scored 0–100 on a tiered rubric where one variable dominates — *does this screen show the 1.43:1 expanded frame, and how well*. Laser vs xenon. Receipt: the actual rubric tier table (S/A/B/C/D/E with score bands).
- Intellectual honesty as data schema: every score carries a confidence flag (`CONFIRMED / HIGH / UNCONFIRMED / INFERRED`); unverified coordinates are flagged `coords_needs_manual_check`, never guessed; Faridabad's zero-venue gap is stated, not hidden.
- The 4DX stance (personality receipt, verbatim from the data): *"Skip the 4DX show for this one — the motion seats fight Nolan's camerawork."* An opinionated tool must have opinions with names on them.
- The format-blindness fix: the same multiplex sells a ₹1,000 IMAX seat and a ₹310 recliner seat for the same film — a recommender that scores them identically is lying. Venue × format candidates, per-format scores.

### 5. The engine
- Three intents as weight vectors — show the actual numbers (mono table: experience/cost/time/feasibility per intent). The insight: *the same data, three honest answers.* From one Gurugram locality the three intents produce three different venues — that worked example, shown as three mini-cards.
- The feasibility gate: being stranded is never a score deduction hidden in math — it's a named warning that must surface (`strandedWarning`, wine-dark strip).
- Pure-function scoring engine, 35 unit tests, no I/O — receipt: the `scoreVenue` signature.

### 6. The craft (the background gets its own act)
- The prologue mural: six AI-generated scenes (Reve, chosen over 3 other generators for *one consistent rendering hand* — judged, not defaulted), composited into one continuous 1800×3500 painting, unified by a single duotone LUT locked to the app's palette. Receipt: three-step image strip — raw generation → composite → duotoned mural.
- The tile-shatter canvas: the technique (one image sliced into spring-physics tiles), and the performance war in three acts, each with its number: (1) 83,000 tiles simulated per frame → slow-motion soup; (2) "settled is free" — at rest the whole mural is ONE draw call; (3) mobile: scroll-shatter removed entirely (a phone scroll IS a finger drag — the two effects stacked), touch-only shatter, half-resolution mural. Frame budget as a design material.
- Typography rule receipt: three typefaces, zero UI sans, and why ("opinions in serif, evidence in mono" — the trust device is typographic).

### 7. The making of the making (the AI-honesty section — Vineet's differentiator)
- Stated plainly: this was built by one person directing AI models, deliberately cast in different roles. **Fable** (judgment tier): product decisions, data-integrity calls, scoring rubric, design language, code review, war-story debugging. **Sonnet** (build tier): spec-driven implementation against written interfaces + acceptance criteria. The human owned: what to build, what to refuse, what "done" means.
- The working pattern, honestly: *spec → subagent build → verify the subagent's claims yourself.* Receipt: one real spec fragment (the scraper-fix acceptance criteria, which required the subagent to prove Priya's converted times matched the site's rendered ones).
- What this page is arguing without saying it: the scarce skill isn't writing code anymore — it's knowing what's true, what matters, and what to cut.
- Timeline receipt (mono): built evenings across ~5 days, first commit → live URL dates.

### 8. Colophon
- Stack, one mono line each: React + Vite + TS + Tailwind · GSAP ScrollTrigger · Canvas 2D · Leaflet + CartoDB dark · Vercel (static + 1 edge function) · GitHub Actions cron · District.in data · Google Routes.
- Links: GitHub repo · Vineet (X/LinkedIn/email — his choice which).
- Last line, serif italic, the page's only flourish: *"Built for one film, one city, six weeks. Some journeys deserve the full ocean."*

## Assets needed (produce during build pass)

1. Architecture diagram — scraper → repo → Vercel → user, with the one live edge-function call highlighted gold. Drawn in-palette (SVG, mono labels), NOT a generic boxes-and-arrows tool export.
2. The timezone receipt: two-column mono comparison (embedded JSON vs rendered page).
3. Mural process strip: raw Reve frame → composite → final duotone (crops exist in repo history / images dir).
4. Three-intents worked example: three mini result cards for one locality (can be static captures of real results).
5. Rubric tier table + intent weight table (HTML tables, mono).

## Explicitly out of scope

- No analytics on this page, no "subscribe", no CTA beyond the repo + contact links.
- No prompt dumps or chat transcripts — the *pattern* is the story, not the logs.
- No disparaging BookMyShow/District by name beyond factual contrast; District is credited as the data source, respectfully.
- English only, like the app.

## Success criteria

- Shared cold to a stranger in tech: they finish it and can name two *decisions* (not features) from memory.
- Vineet can send the URL instead of a resume paragraph.
- A curious user reaches it from the result card and doesn't feel marketed to.
