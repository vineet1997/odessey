import { useMemo, useState } from "react";
import { ArrowRight, Loader2, LocateFixed, Search } from "lucide-react";
import { LOCALITIES, REGIONS } from "../../fixtures/localities";
import type { Origin } from "./types";

interface LocalityScreenProps {
  onSelect: (origin: Origin) => void;
}

const GEOLOCATION_TIMEOUT_MS = 8000;
const DEMO_LOCALITY = LOCALITIES.find((locality) => locality.name === "Vasant Vihar")!;

// This is deliberately generous: it prevents someone in another city from
// spending route calls on a Delhi-only release, without rejecting NCR edges.
function isWithinDelhiNcr({ lat, lng }: Pick<Origin, "lat" | "lng">): boolean {
  return lat >= 27.7 && lat <= 29.2 && lng >= 76.5 && lng <= 78;
}

/**
 * Screen 1 — "Where's home?" DESIGN.md: "Locality picker: full-height
 * sheet, grouped by region ... 48px touch rows, search field for the
 * impatient." Client-side filter, no debounce needed for ~20 fixture rows.
 *
 * A "Use my location" shortcut sits above the list — real GPS coordinates
 * beat picking the nearest curated name, when the browser will give them up.
 */
export function LocalityScreen({ onSelect }: LocalityScreenProps) {
  const [query, setQuery] = useState("");
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const [outsideOrigin, setOutsideOrigin] = useState<Origin | null>(null);
  const [oarAdded, setOarAdded] = useState(false);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? LOCALITIES.filter((l) => l.name.toLowerCase().includes(q)) : LOCALITIES;
    return REGIONS.map((region) => ({
      region,
      items: filtered.filter((l) => l.region === region),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  function handleUseMyLocation() {
    if (locating) return;
    setLocating(true);
    setLocationError(false);

    if (!navigator.geolocation) {
      setLocating(false);
      setLocationError(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const origin = {
          label: "Your location",
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        if (!isWithinDelhiNcr(origin)) {
          setOutsideOrigin(origin);
          return;
        }
        onSelect(origin);
      },
      () => {
        setLocating(false);
        setLocationError(true);
      },
      { enableHighAccuracy: false, timeout: GEOLOCATION_TIMEOUT_MS }
    );
  }

  function chooseDemoLocality() {
    onSelect({
      label: DEMO_LOCALITY.name,
      lat: DEMO_LOCALITY.lat,
      lng: DEMO_LOCALITY.lng,
      region: DEMO_LOCALITY.region,
    });
  }

  if (outsideOrigin) {
    return (
      <section className="flex h-full flex-1 flex-col justify-center" aria-labelledby="beyond-map-heading">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold-bright">Beyond the map</p>
        <h1 id="beyond-map-heading" className="mt-4 max-w-[15ch] font-display text-[clamp(2.2rem,7vw,3.4rem)] leading-[0.96] text-ink">
          This shore is beyond Ithaka, for now.
        </h1>
        <p className="mt-5 max-w-[34rem] font-body text-[1.05rem] leading-relaxed text-ink-muted">
          The first voyage covers Delhi NCR. Add an oar for your city, or see how the compass works from {DEMO_LOCALITY.name}.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setOarAdded(true)}
            disabled={oarAdded}
            className="flex min-h-12 w-full items-center justify-center gap-2 border border-gold px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-gold-bright transition-colors hover:bg-gold/10 disabled:cursor-default disabled:border-sea-bright disabled:text-sea-bright"
          >
            {oarAdded ? "Your oar is in" : "+1 add my oar"}
          </button>
          <button
            type="button"
            onClick={chooseDemoLocality}
            className="flex min-h-12 w-full items-center justify-center gap-2 border border-border px-4 font-mono text-[11px] uppercase tracking-[0.14em] text-ink transition-colors hover:border-ink/35 hover:bg-bg-raised"
          >
            Explore from {DEMO_LOCALITY.name}
            <ArrowRight size={15} strokeWidth={1.5} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setOutsideOrigin(null)}
            className="self-center pt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted transition-colors hover:text-ink"
          >
            Choose a Delhi NCR locality
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col">
      <h1 className="font-display text-[26px] tracking-wide text-ink">Where's home?</h1>
      <p className="mt-1 font-body text-[14px] text-ink-muted">
        We'll route everything from here.
      </p>

      <button
        type="button"
        onClick={handleUseMyLocation}
        disabled={locating}
        className="mt-5 flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-gold font-mono text-[12px] uppercase tracking-widest text-gold-bright transition-transform duration-150 active:scale-[0.97] disabled:cursor-wait disabled:opacity-70"
      >
        {locating ? (
          <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
        ) : (
          <LocateFixed size={16} strokeWidth={1.75} />
        )}
        Use my location
      </button>
      {locationError && (
        <p className="mt-2 text-center font-mono text-[11px] uppercase tracking-widest text-ink-muted">
          Couldn&rsquo;t get your location — pick from the list below.
        </p>
      )}

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
                  onClick={() =>
                    onSelect({
                      label: locality.name,
                      lat: locality.lat,
                      lng: locality.lng,
                      region: locality.region,
                    })
                  }
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
