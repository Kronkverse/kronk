// Pull lat/lng (and optional zoom) out of the two OSM URL shapes the
// event composer's <MapPinPicker> writes:
//   1. `?mlat=<lat>&mlon=<lng>` — query params (Nominatim result URLs).
//   2. `#map=<zoom>/<lat>/<lng>` — hash fragment (map viewer URLs).
// The composer writes both simultaneously; a hand-typed URL might have
// only one shape. Returns null when the URL isn't OSM-parseable so the
// caller can fall back to just showing the link (or nothing).

export interface ParsedPin {
  lat: number;
  lng: number;
  zoom?: number;
}

export const parseOsmUrl = (raw: string | null): ParsedPin | null => {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const mlat = url.searchParams.get('mlat');
  const mlon = url.searchParams.get('mlon');
  if (mlat && mlon) {
    const lat = parseFloat(mlat);
    const lng = parseFloat(mlon);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const hashMatch = /map=([\d.]+)\/([-\d.]+)\/([-\d.]+)/.exec(url.hash);
      const zoom = hashMatch ? parseFloat(hashMatch[1] ?? '') : NaN;
      return { lat, lng, zoom: Number.isFinite(zoom) ? zoom : undefined };
    }
  }
  const hashMatch = /map=([\d.]+)\/([-\d.]+)\/([-\d.]+)/.exec(url.hash);
  if (hashMatch) {
    const zoom = parseFloat(hashMatch[1] ?? '');
    const lat = parseFloat(hashMatch[2] ?? '');
    const lng = parseFloat(hashMatch[3] ?? '');
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng, zoom: Number.isFinite(zoom) ? zoom : undefined };
    }
  }
  return null;
};
