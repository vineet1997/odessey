# ITHAKA — Design Brief
*Companion to [BRIEF.md](BRIEF.md). This document is the design authority; `design-system/ithaka/MASTER.md` holds the same tokens in machine-friendly form for page builds.*

---

## The concept: a voyage, not a form

Every screen borrows from the structure of the poem: you **set out** (inputs), you **cross** (computation), you **arrive** (the answer) — and the app is the one companion that worries about your **return**. The metaphor lives in *motion, texture, and copy* — never in literal illustration. No ships, no marble, no Greek-key borders on everything. One hairline Greek-key divider, used once per screen, is the entire ornamental budget. Restraint is what separates "themed" from "costume party."

The film's visual grade sets the light: **warm amber highlights on deep cool darkness** — a torch on night water. Everything below follows from that one image.

## Identity

- **Wordmark:** ITHAKA set in Cinzel, generously letterspaced. Cinzel is a Trajan-style inscriptional capital — the lettering of Greco-Roman epigraphy and of epic film posters; it says "myth" without saying it.
- **Mark/favicon:** a single gold star above a horizontal horizon line (the sailor's fix — how you find home). Works at 16px.
- **Voice rule (this is the brand):** *opinions in serif, evidence in mono.* The editorial verdict is set in a literary serif; every fact — times, prices, distances, freshness — is set in monospace, like instrument readouts. The typography itself performs the trust argument: "here is what we think, and here is exactly what we measured."

## Color — "wine-dark sea" tokens

Dark mode only. This app happens at night, about the night. No pure black (OLED smear); blue-black with warm text, per the film's grade.

| Token | Hex | Role |
|---|---|---|
| `--bg` | `#0A0E14` | Aegean night — page background |
| `--bg-raised` | `#111722` | cards, decks, sheets |
| `--ink` | `#E9E4D8` | primary text — warm foam/papyrus white, never pure white |
| `--ink-muted` | `#8B94A3` | secondary text, cool slate |
| `--gold` | `#C9A227` | the accent: verdicts, CTAs, wordmark, focus rings (large text / surfaces) |
| `--gold-bright` | `#E3C158` | gold for small text & links (contrast-safe on `--bg`, ≥4.5:1) |
| `--sea` | `#2E6E73` | transport/metro surfaces, secondary actions |
| `--sea-bright` | `#5FA8AD` | transport text on dark (contrast-safe) |
| `--wine` | `#722F37` | the "wine-dark" warning surface — reserved *exclusively* for the no-way-home verdict |
| `--wine-bright` | `#C96F6F` | warning text on dark |
| `--border` | `rgba(233,228,216,0.10)` | hairlines |

- **Semantic law:** gold = verdict/action, sea = journey, wine = stranded. Never decorative use of any of the three; color always means something.
- **Metro chips use real DMRC line colors** (Yellow `#FFD200`, Magenta `#B5379A`, Blue `#3B8ACD`, Aqua…) with dark text, small sizes only. Instantly local, instantly credible — Delhi people know these colors in their bones.

## Typography

Triple stack, **no UI sans anywhere** — the fastest way to not look like every other dark-mode app:

| Slot | Font | Usage |
|---|---|---|
| Display | **Cinzel** 500/600 | wordmark, venue names, intent titles. Sparingly — carved capitals lose power when common. |
| Body | **Source Serif 4** 300–600 | editorial sentences, verdicts, the "why" line. Italic for the one-line venue verdicts. |
| Data | **JetBrains Mono** 400/500 | showtimes, prices, distances, durations, freshness stamp, labels — uppercase, `tracking-widest`, 12–13px. |

Scale (mobile): mono labels 12–13px · serif body 16px/1.6 · showtime hero 40px mono · venue name 28–32px Cinzel · prologue statements clamp(40px, 10vw, 72px). Ratio between hero and body stays ≥ 3:1 — the drama lives in the scale contrast.

## The flow — four scenes

**1 · Prologue** (first visit only; skippable; returning users jump straight to the helm with remembered inputs)
One pinned scroll-scrubbed section — the film's argument in three beats, each a full-viewport statement in Cinzel/serif: *"172 minutes." → "No IMAX 70mm anywhere in India." → "₹350 to ₹2,500 — the same film."* then the release: *"Where you watch it matters. Let's find your screen."* CTA: **Begin**. (GSAP ScrollTrigger, `scrub: 1`, pin — this is the app's *only* pinned section; more would fight native scroll on mobile.)

**2 · The Helm** (the four taps)
Inputs as a horizontal deck — each answer sails the deck left (translate-x with a barely-there 0.5° settle, expo.out, 400ms). Progress is a constellation: four stars, filling as you answer. Locality picker: full-height sheet, grouped by region (Delhi · Gurugram · Noida · Ghaziabad · Faridabad), 48px touch rows, search field for the impatient. Every choice is one tap; back is always a swipe/tap right — predictable, reversible.

**3 · The Crossing** (computation-as-theater)
While the route call runs: a thin gold line draws across a dark map-abstract from your locality toward the horizon, with the mono log underneath ticking through real steps — `CHECKING 14 SCREENS · TONIGHT'S SHOWS · LAST TRAINS · FARES`. Duration = actual latency, capped at 1.5s, never padded beyond real work; if data comes instantly, the crossing is 600ms. This replaces any spinner. The loader *is* the trust pitch: it names what we checked.

**4 · Ithaka** (the result)
The card arrives by zoom — scale 0.94→1.0 + fade, expo.out 500ms, then a gold hairline draws around it (600ms). Runner-up card sits collapsed beneath; intents switchable in place via three tabs (mono labels) without re-entering the flow — switching feels like turning the wheel: the card slides out left, the new one in from right (300ms).

## The card — anatomy of the screenshot

Composed as a 4:5 portrait object (clean crop for WhatsApp/Instagram), share button renders it to a 1080×1350 PNG with the wordmark baked in. Top to bottom:

1. **Header row** — intent label + freshness stamp, both mono: `WORTH EVERY RUPEE · AS OF 18:42`
2. **Venue** — Cinzel: *PVR Select Citywalk* + format chip in gold outline: `IMAX WITH LASER`
3. **Verdict** — serif italic, one line: *"The same laser screen as Priya, at a third of the price."*
4. **The show** — the hero element: `4:50 PM` huge mono + `SUN JUL 20 · CLASSIC · ₹1,100`
5. **Journey ledger** — three mono rows with hairline rules: outbound (line chips + duration), **return (the star: exact last train it catches, or the wine-dark strip)**, all-in total: `₹1,210 DOOR TO DOOR`
6. **Why line** — serif, small: *"Beats Priya on price by ₹1,400; beats Ambience on screen."* — the verdict shown inspected, not asserted
7. **Runner-up** — one compact row, expandable
8. **Actions** — `Book on District` (gold, primary) · `Directions` · `Share` — 48px, full-bleed row
9. **Foot** — ITHAKA wordmark + the one Greek-key hairline. Brand rides on every forward.

The wine-dark return strip is the signature moment: `NO TRAIN HOME AFTER THIS SHOW — CAB ≈ ₹550–650` on `--wine`. When the news is good it's gold: `THE 21:52 FROM MALVIYA NAGAR GETS YOU HOME`.

## Motion system

| Token | Value |
|---|---|
| Durations | 150ms (micro) · 300ms (transitions) · 500ms (arrivals) |
| Ease | `expo.out` — `cubic-bezier(0.16,1,0.3,1)` everywhere; scrub only in prologue |
| Press | scale 0.97, 150ms (all tappables) |
| Hover (desktop) | y −4px, scale 1.02, 250ms, with paired reverse tween |
| List reveal | stagger 0.03s, y 8px, ≤350ms total |
| Reduced motion | `prefers-reduced-motion`: every transform becomes a plain 150ms fade; prologue becomes static pages; crossing becomes a simple progress line |

Nothing animates decoratively. Motion means: *you moved* (deck), *we worked* (crossing), *you arrived* (card zoom). Three meanings, three moves, that's all.

## Layout

Mobile-first, 375px baseline; the card column caps at ~480px even on desktop — a phone product that visits desktops, centered on the deep-sea background with the constellation progress floating beside it. Breakpoints tested: 375 / 768 / 1024 / 1440. No horizontal page scroll ever (the deck translates within an overflow-hidden viewport). Safe-area insets respected for the sticky action row.

## Craft rules (the "no generic" enforcement)

- No Inter, no shadcn default look, no component-library gray cards, no glassmorphism blur soup, no pink.
- No emoji as icons — Lucide line icons at 1.5px stroke, plus 3 custom glyphs (star-fix mark, metro chip, screen glyph).
- No spinners; no skeleton-screen shimmer. The crossing is the only loading state.
- Focus rings: 2px `--gold`, visible always on keyboard nav. Contrast: every text/bg pair ≥4.5:1 (gold small text uses `--gold-bright`; verified at token level, not per-component).
- Numbers never lie about precision: estimated = `≈` prefix + range; measured = exact. Mono makes the difference legible.

## Build notes (for the implementation pass)

React + Vite + Tailwind (tokens as CSS variables → Tailwind theme), GSAP core + ScrollTrigger (both free; **no SplitText** — it's a paid Club plugin; prologue statements animate as whole blocks, which suits their weight anyway). `ScrollTrigger.refresh()` after font load (Cinzel swap shifts metrics). Card→PNG via `html-to-image`. Stable class targets for GSAP (no index-based selection) so React re-renders don't orphan tweens.

## Open design questions (for the mockup round)

1. Prologue: keep the scroll-scrub, or a tap-through title sequence (cheaper, works identically on desktop)? Mockup will decide.
2. The map-abstract in the crossing: pure geometry (lines + stars) vs. a faint real NCR geography. Leaning pure geometry — faster, more mythic, no map tiles.
3. Dark-only is locked, but the *shared PNG* may need a higher-contrast variant for light-mode chat backgrounds — test in the mockup.
