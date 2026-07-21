# Ithaka — Full NCR Venue Census & Experience Scoring
*First pass, 2026-07-20. Source: district.in listings for Delhi NCR / Gurgaon / New Delhi (three overlapping pages, deduplicated). ~75 unique screens found — far more than the ~12-15 assumed earlier. This document scores all of them; curation into the final ~12-15 for the app happens in a later pass, using these scores.*

## The rubric

The film was shot on IMAX cameras and expands to a taller 1.43:1 frame on IMAX screens. India has **no IMAX 70mm film screens** (confirmed earlier) — every "IMAX" venue here is digital, either **laser** (brighter, better contrast) or older **xenon** (dimmer). That single variable — does this screen show the expanded frame, and how well — is the dominant signal. Sound system and seating are real but secondary; 4DX's motion seats actively work against a director's intended cinematography and are penalized, not rewarded, regardless of ticket price.

| Tier | Score band | Definition |
|---|---|---|
| **S** | 90–100 | IMAX with Laser, confirmed or high-confidence |
| **A** | 74–84 | IMAX-branded, laser vs. xenon status unconfirmed |
| **B** | 60–72 | Premium boutique (Director's Cut, Insignia, Onyx, PXL/Luxe) or laser-projected Dolby Atmos, non-IMAX |
| **C** | 50–59 | Dolby Atmos/7.1 or "laser" tag on an otherwise ordinary screen |
| **D** | 44–50 | 4DX-tagged — deliberately capped regardless of tech spec; see editorial note below |
| **E** | 35–42 | No premium format tag on district.in — assume ordinary 2K digital |

**Confidence flag on every row:** `CONFIRMED` (directly stated in a source), `HIGH` (strong general reputation but not cited this pass), `UNCONFIRMED` (format tag exists but laser/xenon or install-quality unknown — needs a verification pass before it can anchor a "best experience" claim), or `INFERRED` (no tag at all; assumed standard).

**Editorial rule for 4DX:** any venue offering The Odyssey in 4DX should carry an explicit copy warning ("skip the 4DX show for this one — the motion seats fight Nolan's camerawork") rather than silently scoring it low. Several IMAX venues (Vegas Dwarka, Ambience Gurugram, Mall of India Noida) also offer 4DX as a *separate showtime* — their IMAX score stands; the 4DX slot at the same venue is simply the wrong show to pick.

## ⚠️ Data-quality flag surfaced during this pass

**There are two distinct "Ambience Mall" properties in NCR** — Ambience Mall, Vasant Kunj (Delhi) and Ambience Mall, NH8 (Gurugram) — each apparently with its own PVR Director's Cut screen, and the Gurugram one additionally has the IMAX-branded "Pepsi PVR Ambience / Kotak IMAX." Earlier research in this project treated "Ambience" as one venue; **it is two, in two different localities with different metro access**, and needs disambiguating before data entry. Flagged, not yet resolved.

---

## Tier S — IMAX with Laser (the correct way to see this film)

| Venue | Locality | Score | Confidence | Note |
|---|---|---|---|---|
| PVR IMAX with Laser – Priya | Vasant Vihar, Delhi | **96** | CONFIRMED | "with Laser" stated directly in the venue's own listing name |
| PVR Select City Walk (IMAX) | Saket, Delhi | **93** | HIGH | Widely reputed as Delhi's other flagship laser IMAX; not directly cited this pass — confirm before final copy |

## Tier A — IMAX-branded, laser/xenon unconfirmed

| Venue | Locality | Score | Confidence | Note |
|---|---|---|---|---|
| PVR Superplex, Mall of India | Sector 18, Noida | **80** | UNCONFIRMED | Modern property (2016+); moderate lean toward laser |
| PVR Vegas | Dwarka, Delhi | **79** | UNCONFIRMED | Modern property; also offers LUXE + 4DX as separate shows |
| Pepsi PVR Ambience / Kotak IMAX | Ambience Mall, **Gurugram (NH8)** | **77** | UNCONFIRMED | Flagged earlier — needs a phone call, not resolvable by search |
| INOX Coca-Cola IMAX, Paras | Nehru Place, Delhi | **76** | UNCONFIRMED | One of India's older IMAX installs (~2007) — plausibly still xenon |
| INOX Vishal Mall | Rajouri Garden, Delhi | **74** | UNCONFIRMED | Smaller-mall tier — lean toward older/lower-spec system |

## Tier B — Premium boutique / laser-Atmos, non-IMAX

| Venue | Locality | Score | Confidence | Note |
|---|---|---|---|---|
| INOX Pacific Mall | Jasola, Delhi | 69 | UNCONFIRMED | INSIGNIA + BIGPIX (INOX's premium large-format) |
| Devgn CineX (fmr. NY) | Elan Epic, Gurugram | 72 | UNCONFIRMED | "Laser Dolby Atmos" tag |
| Cinepolis Airia Mall | Sohna Road, Gurugram | 67 | UNCONFIRMED | Dolby SLS + Macro XE (large format) |
| PVR Director's Cut | Ambience Mall, Vasant Kunj, Delhi | 70 | UNCONFIRMED | See Ambience data-quality flag above |
| PVR Director's Cut | Ambience Mall, Gurugram (NH8) | 70 | UNCONFIRMED | See Ambience data-quality flag above |
| PVR Director's Cut | DLF Mall of India, Noida | 70 | UNCONFIRMED | |
| Wave Cinemas | Gurugram | 66 | UNCONFIRMED | "Recliner Laser Atmos" |
| Cinepolis DLF Avenue | Saket, Delhi | 66 | UNCONFIRMED | Onyx (Cinepolis premium) + 4DX as separate show |
| INOX Insignia, Epicuria | Nehru Place, Delhi | 68 | UNCONFIRMED | |
| INOX Nehru Place | District Centre, Delhi | 68 | UNCONFIRMED | |
| INOX RCube, Monad Mall | Delhi | 68 | UNCONFIRMED | |
| INOX Ardee Mall | Ardee City, Gurugram | 68 | UNCONFIRMED | |
| PVR Cinemagic | Unity One Elegante, Pitampura, Delhi | 65 | UNCONFIRMED | PXL + Luxe |
| QLA Cinemas | Dremz Mall, Gurugram | 64 | UNCONFIRMED | "7.1, Laser" |
| INOX World Mark | Sector 65, Gurugram | 63 | UNCONFIRMED | "Laser" tag, no Atmos mentioned |

## Tier C — Dolby Atmos/7.1/laser tag on an otherwise ordinary screen

| Venue | Locality | Score | Confidence |
|---|---|---|---|
| Cinepolis Modi Mall | Noida | 56 | UNCONFIRMED (VIP Gold Class) |
| New US Cinemas, Aditya Mall | Ghaziabad | 57 | UNCONFIRMED (Eminence Cut recliner + 4K Dolby) |
| Cinepolis V3S East Center | Nirman Vihar, Delhi | 58 | UNCONFIRMED |
| Cinepolis Pacific NSP2 | Pitampura, Delhi | 58 | UNCONFIRMED |
| Wave Cinemas | Raja Garden, Delhi | 55 | UNCONFIRMED |
| INOX AIPL Joy Street | Gurugram | 54 | UNCONFIRMED |
| Rajhans Cinemas, Ocus Medley | Sector 99, Gurugram | 54 | UNCONFIRMED |
| Miraj Maximum, Metropollis Mall | Gurugram | 54 | UNCONFIRMED |
| Cineport Cinemas | Gurugram | 53 | UNCONFIRMED (DTS-X) |
| MovieTime, Dharam Palace Mall | Noida | 52 | UNCONFIRMED |
| MovieTime Cinemas | Pitampura, Delhi | 52 | UNCONFIRMED |
| Movietime, Celebration Mall | Gurugram | 52 | UNCONFIRMED |
| PVR Mahagun | Mahagun Metro Mall, Ghaziabad | 50 | UNCONFIRMED (recliners only) |
| Miraj TGIP Red Lounge | Noida | 50 | UNCONFIRMED (recliners only) |
| Cinepolis Cross River Mall | Shahdara, Delhi | 50 | UNCONFIRMED ("renovated," vague) |

## Tier D — 4DX-tagged (deliberately capped; see editorial rule above)

| Venue | Locality | Score | Note |
|---|---|---|---|
| PVR Pacific | Subhash Nagar, Delhi | 46 | 4DX only, no other premium tag — genuinely skip for this film |
| HDFC Millennia PVR MGF | Gurugram | 46 | 4DX only |

## Tier E — No premium tag found (assume standard 2K digital)

*35 screens, listed for completeness — none of these should make the curated shortlist unless a locality has literally nothing better nearby, in which case "closest working screen" still deserves an honest low score, not silence.*

**Delhi:** INOX Odeon (CP) · PVR Plaza (CP) · PVR ECX (Chanakyapuri) · PVR Sangam (R.K. Puram) · INOX Patel Nagar · PVR Naraina · PVR Midtown (Moti Nagar) · Cinepolis V3S Mall (Laxmi Nagar) · Cinepolis Savitri Complex (GK2) · PVR Promenade (Vasant Kunj) · Miraj Chand (Mayur Vihar Ph1) · PVR Anupam (Saket) · Miraj Ivory Tower (Subhash Nagar) · PVR EDM (Ghaziabad) · PVR Shalimar Bagh · Miraj Aakash (Azadpur) · Cinepolis Janak Cinema (Janakpuri) · INOX Janak Place · PVR Prashant Vihar · PVR Vikaspuri · PVR Pacific D21 (Dwarka)

**Noida:** Wave Cinemas (Noida) · Miraj TGIP (Noida)

**Gurugram:** Cinepolis The Esplanade · 1 Cinema (Star Mall) · PVR Elan Miracle (Sec 84) · PVR Elan Town Centre (Sec 67) · PVR City Centre (DLF City Centre Mall) · INOX Sapphire 83 · PVR Mega Mall (Golf Course Rd) · Cinepolis Grand View High Street · INOX Iris Broadways (Sec 85) · MovieMax Ansal Plaza · PVR Elan Mercado (Sec 80) · INOX Sapphire 90 Mall

**Ghaziabad/Kaushambi:** Wave Cinemas (Kaushambi)

Score band: 35–42 each, `INFERRED` confidence, no individual notes — differentiating within this tier without more data would be fabricating precision we don't have.

---

## What this pass tells us

- **Tier S+A gives a real shortlist of 7 venues** — the two confirmed/high-confidence laser IMAX screens (Priya, Select Citywalk) plus five IMAX-branded screens needing a laser/xenon check. This is bigger and more geographically spread than the original assumption (Priya + Saket + "IMAX also exists in Noida/Gurgaon") — genuinely useful, e.g. Mall of India Noida and Vegas Dwarka weren't on the radar before.
- **Tier B (15 venues)** is where "Worth Every Rupee" and "Easy Evening" recommendations will mostly live — good sound, real premium seating, broad geographic spread across Gurugram sectors and Delhi neighborhoods, without IMAX pricing.
- **35 of 75 screens (nearly half) carry no premium tag at all.** These aren't going to anchor any recommendation, but they matter for coverage — someone in a locality with nothing better nearby still needs an honest answer, not a recommendation to travel 25km.

## Next: closing the confidence gaps before curation

Ordered by leverage (highest-traffic uncertainty first):
1. **Confirm laser vs. xenon for the 5 Tier-A IMAX screens** — this is the single highest-value verification, since it decides whether 5 venues move up to Tier S or stay capped in the high-70s/low-80s. IMAX corporate's participating-theater list or a venue call each resolves this.
2. **Resolve the Ambience Mall duplication** — confirm there are genuinely two properties, get correct locality/coordinates for each.
3. **Spot-check 3–4 Tier B venues** (Insignia, Onyx, PXL) against IMAX/INOX/Cinepolis's own format pages to firm up scores before they anchor "Worth Every Rupee" picks — lower priority than #1 since Tier B differences matter less to the final ranking than the S/A boundary does.
