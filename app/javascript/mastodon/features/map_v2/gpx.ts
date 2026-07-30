// Map — Logger. Parse a GPS track file (GPX or TCX) entirely in the browser
// and extract ONLY the geometry and a few derived stats. Heart-rate, cadence,
// power, and any device/serial fields are never read, so they never leave the
// device — the server receives only [lng, lat] points (which it then privacy-
// trims) plus the distance / time / elevation numbers computed here.

export interface ParsedTrack {
  points: [number, number][]; // [lng, lat], GeoJSON order
  distance_m: number; // full length, including the ends the server will trim
  moving_sec: number; // elapsed time across the track (0 if untimed)
  elevation_gain: number | null; // summed positive climb (null if no elevation)
}

const EARTH_R = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;

const haversine = (
  [lng1, lat1]: [number, number],
  [lng2, lat2]: [number, number],
): number => {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(a)));
};

interface RawPoint {
  lng: number;
  lat: number;
  ele: number | null;
  time: number | null; // epoch ms
}

const num = (v: string | null | undefined): number | null => {
  if (v == null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const childText = (el: Element, tag: string): string | null => {
  const found = el.getElementsByTagName(tag);
  return found.length > 0 ? (found[0]?.textContent ?? null) : null;
};

const parseGpx = (doc: Document): RawPoint[] =>
  Array.from(doc.getElementsByTagName('trkpt')).map((pt) => {
    const time = childText(pt, 'time');
    return {
      lat: Number(pt.getAttribute('lat')),
      lng: Number(pt.getAttribute('lon')),
      ele: num(childText(pt, 'ele')),
      time: time ? Date.parse(time) : null,
    };
  });

const parseTcx = (doc: Document): RawPoint[] =>
  Array.from(doc.getElementsByTagName('Trackpoint'))
    .map((pt): RawPoint | null => {
      const lat = num(childText(pt, 'LatitudeDegrees'));
      const lng = num(childText(pt, 'LongitudeDegrees'));
      if (lat === null || lng === null) return null; // pause/rest point
      const time = childText(pt, 'Time');
      return {
        lat,
        lng,
        ele: num(childText(pt, 'AltitudeMeters')),
        time: time ? Date.parse(time) : null,
      };
    })
    .filter((p): p is RawPoint => p !== null);

export const parseTrackFile = (text: string, filename: string): ParsedTrack => {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('That file could not be read as GPX or TCX.');
  }

  const isTcx =
    /\.tcx$/i.test(filename) ||
    doc.getElementsByTagName('Trackpoint').length > 0;
  const raw = (isTcx ? parseTcx(doc) : parseGpx(doc)).filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng),
  );

  if (raw.length < 2) {
    throw new Error('No usable track points were found in that file.');
  }

  const points = raw.map((p): [number, number] => [p.lng, p.lat]);

  let distance = 0;
  let climb = 0;
  let sawEle = false;
  let prev = raw[0];
  for (let i = 1; i < raw.length; i += 1) {
    const cur = raw[i];
    if (prev && cur) {
      distance += haversine([prev.lng, prev.lat], [cur.lng, cur.lat]);
      if (prev.ele !== null && cur.ele !== null) {
        sawEle = true;
        if (cur.ele > prev.ele) climb += cur.ele - prev.ele;
      }
    }
    prev = cur;
  }

  const first = raw[0]?.time ?? null;
  const last = raw[raw.length - 1]?.time ?? null;
  const moving =
    first !== null && last !== null ? Math.max(0, last - first) : 0;

  return {
    points,
    distance_m: Math.round(distance),
    moving_sec: Math.round(moving / 1000),
    elevation_gain: sawEle ? Math.round(climb) : null,
  };
};
