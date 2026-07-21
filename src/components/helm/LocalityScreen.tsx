import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { LOCALITIES, REGIONS } from "../../fixtures/localities";

interface LocalityScreenProps {
  onSelect: (locality: string) => void;
}

/**
 * Screen 1 — "Where's home?" DESIGN.md: "Locality picker: full-height
 * sheet, grouped by region ... 48px touch rows, search field for the
 * impatient." Client-side filter, no debounce needed for ~20 fixture rows.
 */
export function LocalityScreen({ onSelect }: LocalityScreenProps) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? LOCALITIES.filter((l) => l.name.toLowerCase().includes(q)) : LOCALITIES;
    return REGIONS.map((region) => ({
      region,
      items: filtered.filter((l) => l.region === region),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  return (
    <div className="flex h-full flex-1 flex-col">
      <h1 className="font-display text-[26px] tracking-wide text-ink">Where's home?</h1>
      <p className="mt-1 font-body text-[14px] text-ink-muted">
        We'll route everything from here.
      </p>

      <div className="mt-5 flex items-center gap-2 rounded-md border border-border bg-bg px-3 py-2.5">
        <Search size={16} strokeWidth={1.5} className="shrink-0 text-ink-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your locality"
          className="w-full bg-transparent font-mono text-[16px] text-ink outline-none placeholder:text-ink-muted"
        />
      </div>

      <div className="mt-4 flex-1 overflow-y-auto pb-4">
        {groups.length === 0 && (
          <p className="mt-6 text-center font-body text-[14px] text-ink-muted">
            No locality matches "{query}".
          </p>
        )}
        {groups.map((group) => (
          <div key={group.region} className="mb-4">
            <div className="sticky top-0 bg-bg-raised py-1.5 font-mono text-[12px] uppercase tracking-widest text-gold-bright">
              {group.region}
            </div>
            <div className="flex flex-col">
              {group.items.map((locality) => (
                <button
                  key={locality.name}
                  type="button"
                  onClick={() => onSelect(locality.name)}
                  className="flex min-h-[48px] cursor-pointer items-center border-b border-border text-left font-body text-[16px] text-ink transition-colors duration-150 hover:text-gold-bright active:scale-[0.99]"
                >
                  {locality.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
