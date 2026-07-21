/**
 * Hand-written fixture of real Delhi NCR localities, grouped by region per
 * DESIGN.md §"The Helm" locality picker spec ("full-height sheet, grouped by
 * region ... Delhi · Gurugram · Noida · Ghaziabad · Faridabad").
 *
 * This is a curated ~20-name spread, not the full ~40-locality set BRIEF.md
 * eventually wants — good enough to prove the picker UX; expanding the list
 * is a data-entry task, not a UI change.
 *
 * `DLF Phase 2, Gurugram` is included deliberately — it's the locality used
 * in an earlier validated test case for this project.
 *
 * Faridabad legitimately has weak venue coverage right now (see
 * data/venues-curated.json's known coverage gaps — "Faridabad has none").
 * It still appears here as a selectable home locality: hiding it would be
 * dishonest about where the user actually lives, even though the eventual
 * recommendation for a Faridabad local may be thin. That gap gets fixed in a
 * later data pass, not by pretending the region doesn't exist.
 */

export type Region = "Delhi" | "Gurugram" | "Noida" | "Ghaziabad" | "Faridabad";

export interface Locality {
  name: string;
  region: Region;
}

export const REGIONS: Region[] = ["Delhi", "Gurugram", "Noida", "Ghaziabad", "Faridabad"];

export const LOCALITIES: Locality[] = [
  // Delhi
  { name: "Hauz Khas", region: "Delhi" },
  { name: "Saket", region: "Delhi" },
  { name: "Vasant Vihar", region: "Delhi" },
  { name: "Vasant Kunj", region: "Delhi" },
  { name: "Malviya Nagar", region: "Delhi" },
  { name: "Nehru Place", region: "Delhi" },
  { name: "Rajouri Garden", region: "Delhi" },
  { name: "Dwarka", region: "Delhi" },
  { name: "Pitampura", region: "Delhi" },
  { name: "Rohini", region: "Delhi" },
  // Gurugram
  { name: "DLF Phase 2, Gurugram", region: "Gurugram" },
  { name: "DLF Phase 3, Gurugram", region: "Gurugram" },
  { name: "Sector 29, Gurugram", region: "Gurugram" },
  { name: "Golf Course Road, Gurugram", region: "Gurugram" },
  // Noida
  { name: "Sector 18, Noida", region: "Noida" },
  { name: "Sector 62, Noida", region: "Noida" },
  { name: "Sector 137, Noida", region: "Noida" },
  // Ghaziabad
  { name: "Raj Nagar Extension, Ghaziabad", region: "Ghaziabad" },
  { name: "Indirapuram, Ghaziabad", region: "Ghaziabad" },
  // Faridabad
  { name: "Sector 15, Faridabad", region: "Faridabad" },
];
