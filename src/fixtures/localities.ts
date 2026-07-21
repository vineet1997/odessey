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
  /** Hand-geocoded 2026-07-21, cross-checked against the expected city/region
   * in each result's address components before accepting — per this
   * project's established rule that free-geocoder output must be verified,
   * never trusted blindly (see data/venues-curated.json's coords_needs_manual_check
   * precedent). All 20 resolved cleanly. */
  lat: number;
  lng: number;
}

export const REGIONS: Region[] = ["Delhi", "Gurugram", "Noida", "Ghaziabad", "Faridabad"];

export const LOCALITIES: Locality[] = [
  // Delhi
  { name: "Hauz Khas", region: "Delhi", lat: 28.5591389, lng: 77.1964782 },
  { name: "Saket", region: "Delhi", lat: 28.5234897, lng: 77.209631 },
  { name: "Vasant Vihar", region: "Delhi", lat: 28.557827, lng: 77.1611168 },
  { name: "Vasant Kunj", region: "Delhi", lat: 28.5292495, lng: 77.1541335 },
  { name: "Malviya Nagar", region: "Delhi", lat: 28.5339201, lng: 77.2124474 },
  { name: "Nehru Place", region: "Delhi", lat: 28.5480268, lng: 77.2534172 },
  { name: "Rajouri Garden", region: "Delhi", lat: 28.6484714, lng: 77.1204602 },
  { name: "Dwarka", region: "Delhi", lat: 28.5656109, lng: 77.0670366 },
  { name: "Pitampura", region: "Delhi", lat: 28.690109, lng: 77.1343765 },
  { name: "Rohini", region: "Delhi", lat: 28.7194361, lng: 77.0672351 },
  // Gurugram
  { name: "DLF Phase 2, Gurugram", region: "Gurugram", lat: 28.483901, lng: 77.0846097 },
  { name: "DLF Phase 3, Gurugram", region: "Gurugram", lat: 28.4919048, lng: 77.0937804 },
  { name: "Sector 29, Gurugram", region: "Gurugram", lat: 28.4669197, lng: 77.0671306 },
  { name: "Golf Course Road, Gurugram", region: "Gurugram", lat: 28.4518332, lng: 77.0987206 },
  // Noida
  { name: "Sector 18, Noida", region: "Noida", lat: 28.5705399, lng: 77.3228931 },
  { name: "Sector 62, Noida", region: "Noida", lat: 28.6211447, lng: 77.3643493 },
  { name: "Sector 137, Noida", region: "Noida", lat: 28.5087875, lng: 77.4104388 },
  // Ghaziabad
  { name: "Raj Nagar Extension, Ghaziabad", region: "Ghaziabad", lat: 28.6528305, lng: 77.3671095 },
  { name: "Indirapuram, Ghaziabad", region: "Ghaziabad", lat: 28.6380466, lng: 77.3644168 },
  // Faridabad
  { name: "Sector 15, Faridabad", region: "Faridabad", lat: 28.3983558, lng: 77.3231003 },
];
