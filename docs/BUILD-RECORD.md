# Ithaka Build Record

> A living record of the product, technical, and craft decisions behind
> Ithaka. It is source material for the future `#made` page, a build article,
> portfolio case study, or LinkedIn post. It records decisions while they are
> still fresh; it is not a polished retrospective.

**Last updated:** 2026-07-22  
**Product status:** live, focused on *The Odyssey* in Delhi NCR  
**Companion document:** [`MAKING-OF-BRIEF.md`](./MAKING-OF-BRIEF.md) is the
specification for the public-facing “How this was made” page. This file is
the evidence and narrative inventory that page should draw from.

## How to maintain this file

Update this after any change that affects one of these things:

- what the product promises a user;
- what data is trusted, rejected, or made visible as uncertain;
- architecture, cost, reliability, privacy, or performance trade-offs;
- a bug that changed our understanding of the system;
- a meaningful validation, launch result, or user-learning.

Each entry should answer: **What was the problem? What did we choose? Why?
What did it cost or rule out? How do we know?** Link the relevant commit,
file, test, or source. Do not record keys, tokens, personal data, or internal
conversation transcripts.

Suggested entry format:

```md
### YYYY-MM-DD — Short decision title

**Problem:**
**Decision:**
**Why this was the right trade-off:**
**Evidence:** commit / test / source / observed behaviour
**What remains open:**
```

---

## The product in one sentence

Ithaka answers one narrow question properly: **where should someone in Delhi
NCR watch *The Odyssey*, for their priorities and their journey home?**

The product is intentionally a recommendation, not a listings site. A user
gets one defended pick, a real runner-up, and enough working to trust or
challenge the answer.

## The product thesis

Movie listings solve discovery; they do not solve the decision. For a
large-format film, venue quality, ticket price, departure time, travel time,
and the ability to get home are all part of the same choice.

The signature promise is not “here are some screens.” It is:

> Here is the screen and showtime I would choose for you, including the
> consequences of getting there and getting home.

### Constraints that made the product sharper

| Constraint | Decision it forced |
| --- | --- |
| A short theatrical window | Build a focused tool, not a general cinema platform. |
| One city/region | Curate and verify deeply instead of pretending to cover everywhere. |
| No accounts or booking flow | Give a recommendation, then deep-link to the actual booking source. |
| Zero-cost infrastructure target | Static data wherever possible; one server-side route proxy only where data is genuinely user-specific. |
| Trust matters more than page views | Show freshness, alternatives, and the full scoring trail rather than a black-box “best.” |

### Explicit refusals

- No generic “best cinemas in Delhi” list.
- No user accounts, reviews, social feed, or booking checkout.
- No BookMyShow scraping.
- No fake certainty: unknown transit is labelled unknown; uncertain venue facts are not promoted to fact.
- No visual polish that disguises an unfinished decision engine.

---

## Architecture, deliberately small

```text
District public pages
        |
        v
Scheduled scraper (GitHub Actions; triggered every 30 min by Supabase pg_cron)
        |
        v
data/showtimes-live.json committed to Git
        |
        v
Vercel deploy: React + Vite static app
        |
        +--> curated venue scores + pure TypeScript scoring engine
        |
        +--> /api/route Vercel Edge Function
                   |
                   v
              Google Routes API (server-held key)
```

This is intentionally **a static site fed by a robot**, with one live escape
hatch for routes. It avoids building a database and app backend just to serve
data that is naturally refreshed as a small file.

### Current stack

| Layer | Choice | Why it matters |
| --- | --- | --- |
| Product UI | React, Vite, TypeScript, Tailwind | Fast static deployment; typed interfaces around recommendation data. |
| Decision engine | Pure TypeScript scoring module | The recommendation can be unit-tested independently of the UI and network. |
| Live showtimes | District page `__NEXT_DATA__` | Structured server-rendered data; no headless browser and less brittle than DOM scraping. |
| Scheduling | Supabase pg_cron → GitHub Actions dispatch | Replaced unreliable sub-hour GitHub scheduling while retaining a simple scraper workflow. |
| Hosting / server code | Vercel + one Edge Function | The route key stays server-side; no application backend is introduced. |
| Interactive map | Leaflet + CartoDB dark tiles | No browser-exposed Google key; no additional Maps map-load cost. |
| Animation / craft | GSAP + Canvas 2D | The opening experience is treated as part of the product, with mobile performance constraints. |

---

## Decision log

### 2026-07-21 — Turn a cinema search into an opinionated decision engine

**Problem:** A venue-only comparison treats a ₹310 recliner show and a
₹1,000 IMAX show at the same multiplex as the same option. It also leaves the
user to reconcile price, travel, and timing themselves.

**Decision:** Model a complete plan as **venue × format × showtime**. Score
each viable plan on experience, cost, door-to-door time, and feasibility.
Offer three explicit intents: *The Full Epic*, *Worth Every Rupee*, and *The
Easy Evening*.

**Why:** The honest answer changes with the user’s priorities. The app should
make that subjectivity visible rather than hide it behind one universal score.

**Evidence:** `src/scoring/score.ts`; rebuilt candidate engine in commit
`b0105fe`; every viable show scoring and progressive evidence in `c074245`.

**Trade-off:** More candidates and more explanation work. We accepted that
complexity because it is the product’s actual value.

### 2026-07-21 — Make editorial judgment a first-class data layer

**Problem:** “Best screen” is not a neutral data lookup for a film that
benefits from premium large-format presentation. A generic rating would blur
the distinction that matters.

**Decision:** Build a venue census and score formats on a documented 0–100
rubric, with confidence levels and concise editorial verdicts. Treat 4DX as a
separate format and deliberately keep it out of recommendation eligibility
for this film.

**Why:** An opinionated tool needs accountable opinions. The data makes clear
which claims are confirmed, high-confidence, or still unresolved.

**Evidence:** [`data/VENUE-SCORING.md`](../data/VENUE-SCORING.md),
`data/venues-curated.json`, commit `d63af69`.

**Trade-off:** Curation is slower than ingesting a venue directory. It is also
the part a generic map cannot provide.

### 2026-07-21 — Use District’s embedded data, not a headless browser

**Problem:** Showtimes, formats, prices, and availability are live enough to
matter, but a traditional scraper can become fragile quickly.

**Decision:** Read District’s server-rendered Next.js `__NEXT_DATA__` payload
for the curated venue set, then write a timestamped static JSON file.

**Why:** The data is structured at the source, so parsing it is less brittle
than imitating a browser or scraping visual HTML. The app can keep serving the
last known good data if refreshes fail.

**Evidence:** [`scripts/scrape-district.ts`](../scripts/scrape-district.ts),
commit `0567564`.

**Important learning:** Availability must use District’s whole-session
roll-up, not the worst seat class. A sold-out 16-seat premium block should not
turn an otherwise available show into “Sold Out.” Sold-out seat classes are
also excluded from the displayed price range.

### 2026-07-22 — Catch and fix the timezone bug before it corrupted trust

**Problem:** District’s show times were UTC, but the first scraper treated
them as IST. That moved showtimes by 5½ hours and could reverse the
journey-home conclusion for late shows.

**Decision:** Convert the source timestamps to IST in the scraper and retain
the date explicitly. Scrape the next five published dates instead of silently
assuming today.

**Why:** A plausible-looking wrong time is more dangerous than a crash. The
issue was caught by sanity-checking an implausible early-morning flagship
show against the rendered District page.

**Evidence:** commit `d5f741c`; regression data regenerated in `3965373`.

**Lesson worth sharing:** Data validation needs product intuition. A parser
can be syntactically correct and still make the core promise false.

### 2026-07-21 — Keep Google routing server-side; keep maps free in-browser

**Problem:** Route data must be personalized to the user’s locality, but a
browser-exposed Maps key would be public and harder to control.

**Decision:** Use one Vercel Edge Function as a Google Routes proxy. Use
Leaflet with CartoDB tiles for the interactive comparison map instead of
Google Maps JavaScript.

**Why:** The route key stays in Vercel environment variables and can be
restricted. Leaflet gives the map explorer the product needs without adding a
client key, map-load cost, or a second secrets surface.

**Evidence:** [`api/route.ts`](../api/route.ts),
[`src/components/MapExplorer.tsx`](../src/components/MapExplorer.tsx), commits
`ea54170` and `6e4efa5`.

**Trade-off:** The route card deep-links to Google Maps rather than embedding
a Google map. That is a conscious simplification, not a missing integration.

### 2026-07-22 — Make the evidence progressive, not overwhelming

**Problem:** A recommendation needs receipts, but dumping every scored show
into the first screen makes the core decision feel like a spreadsheet.

**Decision:** Put the pick, one runner-up, and score dimensions first. Place
the dossier, alternatives, map, and full ranked plan ledger behind an
intentional “Explore full research” disclosure.

**Why:** Trust should be available on demand. The user who wants an answer
gets one; the user who wants to audit it can see exactly what was compared.

**Evidence:** [`src/components/Dossier.tsx`](../src/components/Dossier.tsx),
commit `e12b6bd` and follow-up `c074245`.

### 2026-07-22 — Finish the journey-home promise with timed transit checks

**Problem:** A citywide 11:15 PM cutoff claimed to say whether public
transport was available, while the UI actually priced the return as a cab.
That was a trust contradiction at the centre of the product.

**Decision:** Remove the fixed cutoff. Query Google Routes transit from the
venue back to the selected locality at **show end + 15 minutes**. Distinguish
three outcomes: a scheduled route found, no route found, and transit
unverified. Always retain a labelled cab fallback.

**Why:** The product can now say what it knows: a departure time, stop, line,
duration, and fare when Google returns them; or an explicit limitation when it
cannot verify transit. It never calls an unknown route “available.”

**Cost control:** Every viable show still receives a conservative cab-home
score. Live transit is checked only for the 12 plans with the strongest
potential score, preventing a 100+ show schedule from generating 100+ route
calls.

**Evidence:** [`src/lib/buildRecommendation.ts`](../src/lib/buildRecommendation.ts),
[`api/route.ts`](../api/route.ts), 30 passing unit tests, commit `c7339d3`.

**Trade-off:** The full candidate set is scored conservatively; only the
highest-potential plans receive richer live-transit evidence. This is a
deliberate cost/latency boundary and is surfaced in the dossier.

### 2026-07-22 — Design local development to fail honestly, not fail closed

**Problem:** Local Vite does not execute Vercel functions, so localhost used
to report that it could not find a screen whenever the routing endpoint was
absent.

**Decision:** Mount the same route handler in Vite development. Without a
server key, driving returns a clearly labelled geometric estimate and transit
returns “unverified,” never fabricated schedule data.

**Why:** The entire product flow can be tested locally without copying a
production secret into a browser or pretending local estimates are live.

**Evidence:** [`vite.config.ts`](../vite.config.ts), commit `c074245`.

---

## Reliability, cost, and privacy decisions

### Data freshness

- District showtimes are refreshed every 30 minutes.
- Supabase pg_cron triggers the GitHub Actions workflow because the measured
  GitHub schedule did not reliably honour a 30-minute cadence.
- The workflow only commits when the live JSON changed; a Git push triggers
  Vercel’s normal redeploy.
- A failed scrape leaves the last known good build available rather than
  replacing it with an error state.

### Routing and free-tier guardrails

The current maximum route pattern for one recommendation is approximately:

| Call type | Maximum | Billing class | Why it exists |
| --- | ---: | --- | --- |
| Locality → venue drive route | 11 | Google Routes Pro (`TRAFFIC_AWARE`) | Makeability, travel time, cab fallback. |
| Venue → locality scheduled transit route | 12 | Google Routes Essentials | Verify the journey home for top potential plans. |

At the 2026-07-22 Google Maps Platform free caps, the limiting global bucket
is the 5,000 monthly Pro requests: roughly **450 complete recommendation
runs/month** at maximum usage. India-priced billing has a 35,000-request Pro
free cap: roughly **3,100 runs/month**. These are capacity estimates, not a
promise; revisit them whenever Google changes pricing or the call pattern.

Sources: [Google Routes usage and billing](https://developers.google.com/maps/documentation/routes/usage-and-billing),
[Google Maps pricing categories](https://developers.google.com/maps/billing-and-pricing/pricing-categories),
[Google SKU details](https://developers.google.com/maps/billing-and-pricing/sku-details).

### Privacy and secrets

- No accounts, tracking profile, or user database.
- Locality is used in-session to compute a recommendation and directions.
- The Google Maps key remains server-side in `GOOGLE_MAPS_SERVER_KEY`.
- The interactive map deliberately has no Google client key.

---

## Verification standards

The default standard is **do not confuse “it compiled” with “it works.”**

| Claim | Required proof |
| --- | --- |
| Scoring change | Unit test for the new decision boundary. |
| Scraper change | Compare parsed data with a real rendered District page. |
| Route change | Test the deployed route handler with real input; check live/estimated/unavailable state. |
| UI flow | Exercise the actual browser path, including the fallback state. |
| Visual/performance change | Inspect it on desktop and mobile-sized viewports; test reduced-motion behaviour where relevant. |

Recent verification receipts:

- The live Vercel route endpoint was tested for DRIVE, TRANSIT, malformed
  POST, and invalid method behaviour.
- The journey-home implementation passed 30 unit tests and a production build
  before commit `c7339d3`.
- Localhost was tested without the Google key: estimates are labelled local,
  and transit is labelled unverified instead of presented as a real route.
- The cinematic result overhaul passed 32 unit tests and a production build,
  then the actual locality → date → intent flow was inspected at 1440×900 and
  390×844. That mobile pass caught and fixed a transformed-ancestor bug that
  prevented the booking bar from remaining viewport-sticky.
- Evidence-bounded format reasoning passed 40 unit tests and a production
  build. Coverage now checks every live exact format label, while unknown
  labels deliberately fall back to measured cost, time, and screen-score facts.
- The Passage passed 48 unit tests and a production build. The real exported
  PNG was inspected at its native 1080 × 1350 dimensions and mobile preview
  scale: 1.6 MB, no console errors, no horizontal overflow, body scroll locked
  while composing, focus restored on close, and no precise origin in the
  artifact model.

---

## Product and craft evolution

| Date | Change | Why it matters to the story |
| --- | --- | --- |
| 2026-07-21 | First scaffold, venue rubric, pure scoring engine, and four-scene flow | The product began as a decision system, not a directory. |
| 2026-07-21 | District scraper and static-data deployment loop | Live-enough data without building a conventional backend. |
| 2026-07-21 | Live Vercel routing, booking deep links, map explorer, share card | The recommendation became actionable and inspectable. |
| 2026-07-22 | Prologue mural, canvas shatter, social metadata, mobile performance pass | Craft was treated as a product differentiator with a performance budget. |
| 2026-07-22 | Timezone correction and five-day showtime coverage | A data bug became a lesson in validating with domain sense. |
| 2026-07-22 | Three-tap input flow, format-aware candidates, dossier | Fewer inputs; more honest reasoning underneath. |
| 2026-07-22 | Progressive evidence, every viable show scored | The product can explain the comparison without front-loading complexity. |
| 2026-07-22 | Live journey-home verification | The signature promise became specific rather than heuristic. |
| 2026-07-23 | Cinematic result briefing, complete-evening timeline, and counterfactual answers | The first viewport now makes the decision effortless; the rest makes it defensible. |
| 2026-07-23 | Exact-format knowledge and contribution-based comparison narratives | The app no longer turns a score gap into an unsupported claim about a projector, frame, or screen. |

---

## Story angles for future writing

These are prompts, not claims to repeat without updating the evidence.

1. **“The small app where the hardest feature was getting home.”**  
   Show how a showtime is only useful when paired with its post-film journey.

2. **“A timezone bug nearly inverted the product’s main promise.”**  
   A concrete story about why product sense is part of engineering quality.

3. **“I chose a static site and one server function.”**  
   Explain the value of resisting backend reflexes and keeping live state
   narrowly scoped.

4. **“What an opinionated recommender owes its user.”**  
   Venue rubric, 4DX rejection, confidence labels, runner-up, and receipts.

5. **“The useful AI workflow is spec → build → verify.”**  
   Focus on the human work: deciding constraints, checking facts, and setting
   the definition of done—not on prompt theatre.

6. **“Trust is a layout decision.”**  
   Explain why evidence is progressive: answer first, proof immediately below,
   full ledger on demand.

For every post, lead with a real decision or bug, include one concrete number
or artifact, name the trade-off, and close with what changed because of it.

---

## Open questions / next decisions

- Should repeat route queries be cached server-side by locality, venue, and
  showtime to extend the free-tier runway?
- How should the transit-shortlist size adapt to latency, quota use, and the
  number of competing plans?
- Which venue facts need a phone call or primary-source verification before
  they can become a stronger editorial claim?
- How will real user behaviour validate the central metric: booking directly
  from the recommendation without re-checking elsewhere?
- When the film’s theatrical window ends, does Ithaka become a reusable
  format for another film, or should the project remain a deliberately finite
  artifact?

## Change ledger

### 2026-07-23 — The build record became a public companion piece

- Added the lazy-loaded `/made` route as a focused product-engineering article:
  problem framing, the plan-scoring model, static-first architecture,
  believable data failures, evidence hierarchy, responsive art direction, and
  the specialist-pass workflow. It uses visual artifacts only when they
  clarify a decision.
- The public record leads with what the product does and labels its product
  hypotheses as unproven. It documents decisions and revisions—not invented
  traction or a retrospective victory lap.
- Its visual artifacts are sanitised and bounded: no personal origins, route
  requests, credentials, private transcripts, or raw multi-megabyte generated
  images are shipped on the normal Ithaka path.

### 2026-07-23 — Ithaka received its canonical public address

- Set `https://ithaka.vineet.cc/` as the canonical site, Open Graph, Twitter
  card, social-image and share-caption destination. The random Vercel
  deployment URL remains infrastructure, not Ithaka's public identity.
- The share URL always uses the canonical homepage, including from local
  development and preview deployments, so a downloaded invitation cannot
  accidentally send someone to localhost or a temporary host.

### 2026-07-23 — The shared answer became a Screening Declaration

- Replaced the evidence-heavy night brief with **The Screening Declaration**:
  a fixed 1080 × 1350 personal film-poster cover made to feel worth posting,
  not like an exported dashboard. The fixed hierarchy is only the Odyssey,
  personal plan, date/time, format, venue, optional broad region and Ithaka
  attribution.
- Kept the personal statement honest. “MY ODYSSEY PLAN” and “THIS IS MY ONE.”
  describe a chosen recommendation, rather than implying the user has booked
  a ticket or that an answer is universally objective.
- Moved conversion out of the image and into the social caption: a concise
  “Who’s in?” invitation plus a clean public homepage. The PNG itself has no
  QR, URL, booking control, score, price, route, return promise, research
  count, or decision receipt.
- The share model remains a privacy boundary: the image, caption and filename
  contain no origin label, coordinates, directions URL or route parameters.
  A safe coarse region can appear only when it fits the appointment field.
- Export still waits for helmet/font readiness at explicit 1080 × 1350 canvas
  dimensions, then offers native share or download with a live-to-final PNG
  preview in the accessible composer.

### 2026-07-23 — The result became a briefing for the whole evening

- Replaced the screenshot-card-first result with a responsive decision
  surface: a sticky cinematic verdict/helmet pane on desktop and a compact
  poster plus persistent booking actions on mobile.
- Chose two purpose-made Reve assets rather than destructively cropping one:
  the reference-faithful wide helmet for desktop and a portrait rear view for
  mobile. Optimised outputs total roughly 210 KB.
- Elevated the product's differentiator into one temporal model: leave home,
  reach the theatre, film start, film end, exit buffer, return, and home.
- Added three counterfactual answers over the same viable plans—picture-first,
  price-first, and earliest-home—so the interface demonstrates trade-offs
  instead of pretending one venue is objectively best.
- Made source confidence progressive and precise: showtime refresh, outbound
  route source/check time, return status/scheduled time, and the 15-minute
  theatre-exit assumption are separate evidence.
- Kept the visual language deliberately narrow: one monumental image,
  near-black/bone/bronze, teal only for verified evidence, wine only for a
  failed return condition, hard rules, light grain, and no repeated Greek
  ornament.
- A follow-up density pass deliberately kept every fact while replacing
  dashboard cards and long tracked-mono sentences with editorial ledgers:
  scenario → answer → decisive metric → receipt. Alternatives became a ranked
  shortlist, full research became an archive door, and provenance became a
  structured research receipt. The lesson was that trust needs hierarchy,
  not merely more or less information.

### 2026-07-23 — Format copy became a trust system

- Reframed the backlog item from "curated comparison copy" to
  **evidence-bounded, format-aware recommendation reasoning**. The aim is not
  to hand-write every matchup; it is to control which claims the system is
  allowed to make.
- Added an exact-label format profile table. A new or unknown District label
  receives no inferred laser, Atmos, recliner, large-format, or equivalence
  traits; it still renders safely using measured facts.
- Scoped editorial verdicts to an exact venue plus exact format. A venue's
  flagship IMAX judgment can no longer leak onto its GOLD, recliner, or other
  secondary screening.
- Replaced the old raw-rupees-versus-raw-minutes heuristic with weighted score
  contribution deltas. The prose now explains the dimension that actually
  moved the recommendation, then shows the cost, journey, screen-score, and
  return-evidence receipt.
- Moved value-comparison language into the same pure reasoning layer. Numeric
  gaps alone can no longer produce claims such as "same screen tier" or "the
  frame is bigger"; picture-led versus comfort-led language appears only when
  both exact profiles support it.
- Kept scoring weights and the redesigned result hierarchy unchanged. This
  was a semantic integrity pass, not another visual redesign.

Add new entries above this line, newest first, when a decision changes the
product’s promise or the story we can truthfully tell about it.
