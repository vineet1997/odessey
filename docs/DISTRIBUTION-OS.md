# Launch distribution system

Odessey does not need a general static guide before launch. The app is the
destination; distribution work exists to put the app in front of people already
making this decision.

## What is in the first version

`npm run discover:outreach` searches the public web for three kinds of leads:

- **Conversations** — people actively asking where or how to watch *The Odyssey*.
- **Creators** — Delhi-NCR voices with cinema relevance.
- **Communities** — film clubs, societies, and movie-going groups.

It writes a deduplicated, scored queue to `data/distribution/targets.json`.
That file is intentionally ignored by Git: it becomes working outreach research,
not product data. Review every lead and write the reply/DM manually.

## Setup

1. Create an Exa API key.
2. Copy `.env.example` to `.env.local` and add `EXA_API_KEY`.
3. Run one of:

   ```powershell
   npm run discover:outreach
   npm run discover:outreach -- --preset conversations --limit 12
   npm run discover:outreach -- --preset creators
   npm run discover:outreach -- --preset communities
   npm run discover:outreach -- --preset conversations --dry-run
   ```

The `launch` preset runs all three categories. Start with conversations: they
are the fastest way to make the app useful in public. The dry run confirms the
local key and planned request volume without calling Exa.

The conversation preset intentionally limits results to Reddit and Quora. News,
ticketing, and generic guide pages are useful research, but they are not people
to answer or communities to join. Preserve broad research separately; use a
fresh output file when collecting a reviewable outreach cohort:

```powershell
npm run discover:outreach -- --preset conversations --limit 12 --out data/distribution/conversations-high-intent.json
```

## Deliberate omissions

- **No automated DMs or email.** The first 100–150 contacts should be personal.
- **No Apify on day one.** It adds scraping/maintenance cost before we know which
  creator or community segment responds.
- **No Firecrawl on every result.** Add it later only to enrich a target that
  survives manual review (for example, to find a public contact page).
- **No shared database yet.** The currently connected Supabase project belongs
  to another product. Create a dedicated Odessey project before persisting
  outreach, partner attribution, or conversion events there.

## Enriching the first cohort

`data/distribution/first-cohort.json` is a deliberately short, hand-selected
set of targets. `npm run enrich:outreach` uses Firecrawl to inspect **only**
those exact public pages and writes an outreach brief with public emails,
contact/join pages, linked public social profiles, and a short page excerpt.

```powershell
npm run enrich:outreach -- --dry-run
npm run enrich:outreach
```

Do not treat a public email or social profile as permission to automate
outreach. Review each brief, verify recent activity, and send a useful,
personal message manually.

## Review rule

Do not lead with an app link. A good response answers the specific question,
names the relevant trade-off (screen, price, or journey), and only then offers
Ithaka/Odessey as the way to run the comparison for that person's situation.
