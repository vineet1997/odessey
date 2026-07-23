// Vercel Edge Function — the ONLY server-side code in this project.
//
// Per BRIEF.md's "Tech" section: a single stateless proxy that holds the
// Google Maps key server-side (it must never reach the browser) and calls
// the Routes API live, per user, for one locality->venue journey leg. This
// is genuinely per-user data (a specific origin/destination pair), which is
// why it can't be baked into the static data.json the rest of the app reads.
//
// Three response tiers, always returned as 200 with an explicit `source`
// field — callers decide how to label the number, never guess from a
// missing field:
//   "live"        — a real Google Routes API answer.
//   "estimated"   — Google failed/unavailable, straight-line-distance
//                   fallback (BRIEF.md's precomputed 40x15x3 matrix hasn't
//                   been built yet; this is the honest interim substitute
//                   — clearly NOT the same as a measured route).
//   "unavailable" — even the estimate couldn't be computed (bad input).
//
// Deploy config: set GOOGLE_MAPS_SERVER_KEY in Vercel's dashboard
// (Settings -> Environment Variables). Never pass it from the client.

export const config = { runtime: "edge" };

const ROUTES_API_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
const GOOGLE_TIMEOUT_MS = 8_000;

type TravelMode = "DRIVE" | "TRANSIT" | "WALK" | "BICYCLE";
const VALID_MODES: readonly TravelMode[] = ["DRIVE", "TRANSIT", "WALK", "BICYCLE"];

interface LatLng {
  lat: number;
  lng: number;
}

interface RouteRequestBody {
  origin: LatLng;
  destination: LatLng;
  mode?: TravelMode;
  departureTime?: string;
}

interface RouteResult {
  source: "live" | "estimated";
  durationMinutes: number;
  distanceKm: number;
  reason?: string; // present only for "estimated"
  transit?: {
    departureTime: string;
    departureStop: string;
    lineName: string;
    lineColorHex?: string;
    vehicleType?: string;
    fareRupees?: number;
  };
}

type RouteUnavailableReason = "not_configured" | "no_route" | "no_metro_route" | "service_error";

class RouteUnavailableError extends Error {
  constructor(
    readonly reasonCode: RouteUnavailableReason,
    message: string
  ) {
    super(message);
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isLatLng(value: unknown): value is LatLng {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    isFiniteNumber(v.lat) &&
    isFiniteNumber(v.lng) &&
    Math.abs(v.lat as number) <= 90 &&
    Math.abs(v.lng as number) <= 180
  );
}

function parseBody(json: unknown): RouteRequestBody | null {
  if (!json || typeof json !== "object") return null;
  const body = json as Record<string, unknown>;
  if (!isLatLng(body.origin) || !isLatLng(body.destination)) return null;
  const mode =
    typeof body.mode === "string" && VALID_MODES.includes(body.mode as TravelMode)
      ? (body.mode as TravelMode)
      : "DRIVE";
  const departureTime = body.departureTime;
  if (
    departureTime !== undefined &&
    (typeof departureTime !== "string" || !Number.isFinite(Date.parse(departureTime)))
  ) {
    return null;
  }
  return { origin: body.origin, destination: body.destination, mode, departureTime };
}

/** Great-circle distance, km. */
function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Straight-line-distance fallback. Deliberately conservative on speed
 * (18 km/h) since NCR door-to-door legs involve traffic, parking, and
 * walking to/from stations — a number that reads a bit slow but honest
 * beats one that reads fast and is wrong. Not a substitute for the real
 * precomputed matrix (BRIEF.md), just today's interim behavior.
 */
function estimateRoute(origin: LatLng, destination: LatLng, reason: string): RouteResult {
  const distanceKm = haversineKm(origin, destination);
  const ASSUMED_KMH = 18;
  const durationMinutes = Math.max(5, Math.round((distanceKm / ASSUMED_KMH) * 60));
  return { source: "estimated", durationMinutes, distanceKm: Math.round(distanceKm * 10) / 10, reason };
}

async function callGoogleRoutes(
  origin: LatLng,
  destination: LatLng,
  mode: TravelMode,
  apiKey: string,
  departureTime?: string
): Promise<RouteResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GOOGLE_TIMEOUT_MS);

  try {
    const res = await fetch(ROUTES_API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": [
          "routes.duration",
          "routes.distanceMeters",
          ...(mode === "TRANSIT"
            ? [
                "routes.travelAdvisory.transitFare",
                "routes.legs.steps.travelMode",
                "routes.legs.steps.transitDetails",
              ]
            : []),
        ].join(","),
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: {
          location: { latLng: { latitude: destination.lat, longitude: destination.lng } },
        },
        travelMode: mode,
        ...(mode === "DRIVE" ? { routingPreference: "TRAFFIC_AWARE" } : {}),
        ...(mode === "TRANSIT"
          ? {
              ...(departureTime ? { departureTime } : {}),
              // Ithaka's public-transport promise is deliberately metro-only.
              // Google's preference is not a hard filter, so the response is
              // also validated below before it can become a recommendation.
              transitPreferences: { allowedTravelModes: ["SUBWAY"], routingPreference: "FEWER_TRANSFERS" },
            }
          : {}),
      }),
    });

    if (!res.ok) {
      throw new Error(`Routes API HTTP ${res.status}`);
    }

    const data = (await res.json()) as {
      routes?: Array<{
        duration?: string;
        distanceMeters?: number;
        travelAdvisory?: {
          transitFare?: { currencyCode?: string; units?: string; nanos?: number };
        };
        legs?: Array<{
          steps?: Array<{
            travelMode?: string;
            transitDetails?: {
              stopDetails?: {
                departureTime?: string;
                departureStop?: { name?: string };
              };
              transitLine?: {
                name?: string;
                nameShort?: string;
                color?: string;
                vehicle?: { type?: string; name?: { text?: string } };
              };
            };
          }>;
        }>;
      }>;
    };
    const route = data.routes?.[0];
    if (!route?.duration || typeof route.distanceMeters !== "number") {
      throw new RouteUnavailableError("no_route", "Routes API returned no usable route");
    }

    // duration comes back as e.g. "1834s"
    const seconds = parseInt(route.duration.replace(/s$/, ""), 10);
    if (!Number.isFinite(seconds)) {
      throw new Error("Routes API returned an unparseable duration");
    }

    const result: RouteResult = {
      source: "live",
      durationMinutes: Math.round(seconds / 60),
      distanceKm: Math.round((route.distanceMeters / 1000) * 10) / 10,
    };

    if (mode === "TRANSIT") {
      const transitSteps = route.legs
        ?.flatMap((leg) => leg.steps ?? [])
        .filter((step) => step.travelMode === "TRANSIT" && step.transitDetails) ?? [];
      const transitStep = transitSteps[0];
      const details = transitStep?.transitDetails;
      const stopDetails = details?.stopDetails;
      const line = details?.transitLine;
      if (!stopDetails?.departureTime || !stopDetails.departureStop?.name || !line) {
        throw new RouteUnavailableError("no_route", "Transit route had no scheduled transit step");
      }

      const vehicleTypes = transitSteps.map((step) => step.transitDetails?.transitLine?.vehicle?.type ?? "UNKNOWN");
      const isMetroOnly = vehicleTypes.length > 0 && vehicleTypes.every((type) => type === "SUBWAY");
      if (!isMetroOnly) {
        throw new RouteUnavailableError(
          "no_metro_route",
          `Route did not satisfy Ithaka's metro-only policy (${vehicleTypes.join(", ")})`
        );
      }

      const fare = route.travelAdvisory?.transitFare;
      const units = fare?.units ? Number(fare.units) : 0;
      const nanos = fare?.nanos ?? 0;
      const fareRupees =
        fare?.currencyCode === "INR" && Number.isFinite(units)
          ? Math.round(units + nanos / 1_000_000_000)
          : undefined;

      result.transit = {
        departureTime: stopDetails.departureTime,
        departureStop: stopDetails.departureStop.name,
        lineName: line.nameShort || line.name || line.vehicle?.name?.text || "PUBLIC TRANSIT",
        ...(line.color && /^#[0-9a-f]{6}$/i.test(line.color) ? { lineColorHex: line.color } : {}),
        ...(line.vehicle?.type ? { vehicleType: line.vehicle.type } : {}),
        ...(fareRupees !== undefined ? { fareRupees } : {}),
      };
    }

    return result;
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return Response.json({ source: "unavailable", error: "Use POST" }, { status: 405 });
  }

  let parsedBody: RouteRequestBody | null;
  try {
    parsedBody = parseBody(await req.json());
  } catch {
    parsedBody = null;
  }

  if (!parsedBody) {
    return Response.json(
      {
        source: "unavailable",
        error:
          "Expected JSON body: { origin: {lat, lng}, destination: {lat, lng}, mode?: DRIVE|TRANSIT|WALK|BICYCLE }",
      },
      { status: 400 }
    );
  }

  const { origin, destination, mode, departureTime } = parsedBody;
  const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY;

  if (!apiKey) {
    // Driving can degrade to a geometric estimate. Transit cannot: inventing
    // a scheduled service would be worse than returning an explicit unknown.
    if (mode === "TRANSIT") {
      return Response.json({
        source: "unavailable",
        reasonCode: "not_configured",
        error: "GOOGLE_MAPS_SERVER_KEY not configured",
      });
    }
    return Response.json(estimateRoute(origin, destination, "GOOGLE_MAPS_SERVER_KEY not configured"));
  }

  try {
    const result = await callGoogleRoutes(origin, destination, mode ?? "DRIVE", apiKey, departureTime);
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (mode === "TRANSIT") {
      return Response.json({
        source: "unavailable",
        reasonCode: err instanceof RouteUnavailableError ? err.reasonCode : "service_error",
        error: message,
      });
    }
    return Response.json(estimateRoute(origin, destination, `Live call failed: ${message}`));
  }
}
