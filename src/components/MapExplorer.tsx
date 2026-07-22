import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { DossierEntry } from "../lib/buildRecommendation";
import type { Origin } from "./helm/types";

interface MapExplorerProps {
  origin: Origin;
  venues: DossierEntry[];
}

/**
 * The trust/explore view (feedback item #5, reframed as a map per Vineet's
 * request): every venue that was actually scored for this request — not a
 * curated highlight reel, the real candidate set buildRecommendation()
 * ranked — plotted with the same numbers the scoring engine used. The point
 * isn't "here's a map"; it's "here's the data, verify it yourself."
 *
 * `venues` is the full dossier (every scored venue x format x show plan) —
 * one marker per VENUE is drawn, using that venue's best-scoring candidate,
 * since the map plots places, not format variants.
 *
 * Built on Leaflet + free CartoDB dark tiles rather than Google's Maps
 * JavaScript API deliberately: our existing Google key is IP-restricted and
 * server-only (api/route.ts) by design — exposing it to the browser for an
 * interactive map would need a second, separately-restricted key and reopens
 * exactly the client-exposed-secret surface the routing proxy architecture
 * was built to avoid. Leaflet needs no key, costs nothing, and gives full
 * control over marker styling, which a Google embed wouldn't.
 */
export function MapExplorer({ origin, venues }: MapExplorerProps) {
  // One marker per venue — the dossier already sorts by totalScore desc, so
  // the first entry seen for a venueId is that venue's best candidate.
  const bestPerVenue = useMemo(() => {
    const seen = new Map<string, DossierEntry>();
    for (const entry of venues) {
      if (!seen.has(entry.venueId)) seen.set(entry.venueId, entry);
    }
    return [...seen.values()];
  }, [venues]);

  if (bestPerVenue.length === 0) return null;

  const bounds = L.latLngBounds([
    [origin.lat, origin.lng],
    ...bestPerVenue.map((v) => [v.coords.lat, v.coords.lng] as [number, number]),
  ]);

  return (
    <div className="w-full overflow-hidden rounded-[10px] border border-border">
      <MapContainer
        bounds={bounds}
        boundsOptions={{ padding: [32, 32] }}
        scrollWheelZoom={false}
        style={{ height: "360px", width: "100%", background: "#0a0e14" }}
      >
        <FitBounds bounds={bounds} />
        {/* CartoDB's free "dark_all" basemap — no API key, matches the app's
            own dark palette far better than stock OpenStreetMap tiles would. */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        <Marker position={[origin.lat, origin.lng]} icon={homeIcon}>
          <Popup>
            <MapPopupContent title={origin.label} lines={["Your starting point"]} />
          </Popup>
        </Marker>

        {bestPerVenue.map((venue) => (
          <Marker
            key={venue.venueId}
            position={[venue.coords.lat, venue.coords.lng]}
            icon={venueIcon(venue)}
          >
            <Popup>
              <MapPopupContent
                title={venue.venueName}
                lines={[
                  venue.format,
                  `Experience score: ${venue.experienceScore}/100`,
                  `From ₹${venue.priceRupees.toLocaleString("en-IN")}`,
                  `${venue.distanceKm} km · ${venue.durationMinutes} min away`,
                  venue.isWinner
                    ? "★ Today's recommendation"
                    : venue.isRunnerUp
                      ? "Runner-up"
                      : "",
                ].filter(Boolean)}
              />
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <Legend />
    </div>
  );
}

/** react-leaflet's `bounds` prop only fits on mount — refit whenever the
 * candidate set changes (e.g. after switching intents) rather than leaving
 * the view stuck on the first render's venues. */
function FitBounds({ bounds }: { bounds: L.LatLngBounds }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [32, 32] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds.toBBoxString()]);
  return null;
}

function MapPopupContent({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div style={{ fontFamily: "'Source Serif 4', serif", minWidth: "180px" }}>
      <div style={{ fontFamily: "Cinzel, serif", fontSize: "14px", marginBottom: "4px" }}>
        {title}
      </div>
      {lines.map((line, i) => (
        <div
          key={i}
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "11px",
            color: "#555",
            lineHeight: 1.5,
          }}
        >
          {line}
        </div>
      ))}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-bg-raised px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
      <LegendDot color="var(--gold)" label="Recommended" />
      <LegendDot color="var(--sea-bright)" label="Runner-up" />
      <LegendDot color="var(--ink-muted)" label="Also scored" />
      <LegendDot color="var(--gold-bright)" label="You" shape="square" />
    </div>
  );
}

function LegendDot({ color, label, shape = "circle" }: { color: string; label: string; shape?: "circle" | "square" }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5"
        style={{ backgroundColor: color, borderRadius: shape === "circle" ? "9999px" : "2px" }}
      />
      {label}
    </span>
  );
}

// --- Custom DivIcons — Leaflet's default marker PNGs don't respect our
// palette, and the default bundler-path issue (a well-known Leaflet+Vite
// gotcha) is sidestepped entirely by not using the default icon at all. ---

function dotIcon(color: string, size: number): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2px solid #0a0e14;box-shadow:0 0 0 1px ${color}66;"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const homeIcon = L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;background:var(--gold-bright,#e3c158);border:2px solid #0a0e14;transform:rotate(45deg);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function venueIcon(venue: DossierEntry): L.DivIcon {
  if (venue.isWinner) return dotIcon("#c9a227", 20); // --gold
  if (venue.isRunnerUp) return dotIcon("#5fa8ad", 16); // --sea-bright
  return dotIcon("#8b94a3", 10); // --ink-muted
}

export default MapExplorer;
