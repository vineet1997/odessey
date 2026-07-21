// Throwaway local sanity check for src/lib/buildRecommendation.ts — stubs
// global fetch (no network needed) to exercise the real matching/scoring
// logic against the real data files before pushing to a live deploy.
// Not part of the app; delete anytime, or keep as a dev utility.

import { buildRecommendation } from "../src/lib/buildRecommendation";
import { LOCALITIES } from "../src/fixtures/localities";

// Stub the routing proxy: a plausible-shaped "live" response, distance
// scaled crudely off nothing in particular — this is only testing
// buildRecommendation's own logic, not real travel times.
(globalThis as unknown as { fetch: typeof fetch }).fetch = (async () => {
  return {
    ok: true,
    json: async () => ({ source: "live", durationMinutes: 35, distanceKm: 12.4 }),
  };
}) as unknown as typeof fetch;

async function main() {
  const dlfPhase2 = LOCALITIES.find((l) => l.name === "DLF Phase 2, Gurugram")!;

  for (const intentId of ["full-epic", "worth-every-rupee", "easy-evening"] as const) {
    console.log(`\n=== EVENING / ${intentId} ===`);
    const outcome = await buildRecommendation(dlfPhase2, "evening", intentId);
    if (!outcome.ok) {
      console.log("NO RESULT:", outcome.reason);
      continue;
    }
    const r = outcome.result;
    console.log(`${r.venueName} (${r.formatChip}) — ${r.showtime} ${r.dateLabel}`);
    console.log(`  ${r.verdict}`);
    console.log(`  ${r.seatClass} ${r.priceLabel} · total ₹${r.journey.totalCostRupees}`);
    console.log(`  return: [${r.journey.return.status}] ${r.journey.return.headline}`);
    console.log(`  why: ${r.whyLine}`);
    console.log(`  runner-up: ${r.runnerUp ? r.runnerUp.venueName : "(none)"}`);
    console.log(`  districtUrl: ${r.districtUrl}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
