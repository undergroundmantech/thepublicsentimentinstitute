// Shared logic for the Election Results grid: a dark-tuned hybrid palette,
// civicAPI region→our-county-geometry joining, and a tiny dependency-free
// GeoJSON→SVG projector. No deps; pure functions.

// ── Hybrid palette ────────────────────────────────────────────────────
// Semantic, dark-tuned for #0a0b0d. We classify by party/outcome; only
// when a candidate is genuinely unclassifiable do we fall back to the
// color civicAPI handed us (the "hybrid" the user chose).
// Vivid, flat, ballotline-matched (saturated solid fills, not shaded).
export const PARTY = {
  // Classic, saturated party colors — the ones you think of when you
  // think "Democrat" / "Republican", not washed pastels.
  dem: '#1d4ed8', // deep, classic blue
  gop: '#dc2626', // pure fire-engine red
  yes: '#2e9e4f', // approve — green
  no: '#d6334a', // reject — red
  ind: '#18b6a6', // independent / 3rd party — teal
  other: '#3aa856', // generic / same-party runoff — green (ballotline)
  // no data / not reporting — graphite on dark, light grey on white (a getter
  // so it tracks the theme; stays a hex so mix()/shade() can consume it).
  get none() {
    return typeof document !== 'undefined' && document.documentElement.dataset.opaTheme === 'light'
      ? '#dfe2e8'
      : '#2b2e37';
  },
};

const HEXRE = /^#?[0-9a-f]{6}$/i;
const cleanHex = (c) =>
  typeof c === 'string' && HEXRE.test(c.trim())
    ? '#' + c.trim().replace(/^#/, '').toLowerCase()
    : null;

// One candidate → a hex. `nameOnly` lets ballot-measure "Yes/No" win over
// the party (civicAPI tags them Nonpartisan).
const PLACEHOLDER = new Set(['#404040', '#000000', '#ffffff', '#fff', '#000']);
export function candColor(cand) {
  if (!cand) return PARTY.none;
  const nm = String(cand.name || '').trim().toLowerCase();
  const pt = String(cand.party || '').trim().toLowerCase();
  // Ballot measures stay semantically green/red.
  if (nm === 'yes' || nm === 'for' || nm === 'approve') return PARTY.yes;
  if (nm === 'no' || nm === 'against' || nm === 'reject') return PARTY.no;
  // Major-party candidates are ALWAYS the classic blue/red — so a
  // partisan race reads at a glance, not whatever shade civicAPI picked.
  if (/democr/.test(pt)) return PARTY.dem;
  if (/republic|\bgop\b/.test(pt)) return PARTY.gop;
  // Third-party / independent / nonpartisan: prefer civicAPI's own
  // per-candidate color, then party-family fallbacks.
  const civ = cleanHex(cand.color);
  if (civ && !PLACEHOLDER.has(civ)) return civ;
  if (/(independent|green|working famil|progress|libertarian|reform|constitution|peace|socialist|labor)/.test(pt))
    return /libertarian|constitution|reform/.test(pt) ? PARTY.other : PARTY.ind;
  if (/(write|other|uncommitted|scatter|none of)/.test(nm)) return PARTY.other;
  if (/nonpartisan/.test(pt)) return PARTY.other;
  return PARTY.ind;
}

// hex → {r,g,b}
const rgb = (h) => {
  const x = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16));
};
const hex = (a) =>
  '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => {
  const A = rgb(a), B = rgb(b);
  return hex(A.map((v, i) => v + (B[i] - v) * t));
};

const _isLight = () =>
  typeof document !== 'undefined' && document.documentElement.dataset.opaTheme === 'light';

// HEADER intensity (card/scoreboard tint behind white text). Dark: a dead heat
// sits quiet over the black canvas, a blowout deepens. Light: keep the hue
// SATURATED so white text on the header still reads. `lead` = winner%−runnerup%.
export function shade(base, lead) {
  const t = Math.max(0, Math.min(1, (lead || 0) / 45));
  if (_isLight()) return mix(base, '#0a0b10', 0.04 + 0.16 * t);
  return mix('#15171c', base, 0.28 + 0.62 * t);
}

// MAP / choropleth intensity — MUST stay byte-for-byte identical to the precinct
// map's shade() (precinct-map/web/lib/results/core.ts) so the in-hub SVG
// thumbnail and the full MapLibre map paint each county exactly the same. Light:
// a dead heat is a PALE tint of the party hue, a blowout is the deep saturated
// hue (white-mixed, hue never changes — only intensity). Dark: quiet→deep.
// NOTE: distinct from shade() above — headers need saturation for white text;
// the map needs the wide pale→deep range to read margins on the white basemap.
export function mapShade(base, lead) {
  const t = Math.max(0, Math.min(1, (lead || 0) / 45));
  if (_isLight()) {
    const light = mix('#ffffff', base, 0.30 + 0.62 * t); // pale tint → full hue
    return t > 0.78 ? mix(light, '#0b0c12', (t - 0.78) * 0.5) : light;
  }
  return mix('#15171c', base, 0.42 + 0.55 * t);
}

// Does this race render a map thumbnail? The ResultMap paints a county only
// when the race has a per-county breakdown that joins our geometry; with none
// it falls back to a flat tint (no map). civicAPI exposes exactly that as
// `has_breakdown` on the race-search row — verified 1:1 against the actual
// render: has_breakdown ⇒ ≥1 county region (statewide=all counties, a county
// office / local measure = its single county, all of which DO draw a map);
// no breakdown (e.g. a State House district) ⇒ 0 regions ⇒ fallback tint.
// So this is the precise signal — not an office/name guess. We also require a
// US state, since the thumbnail joins to US county geometry: a non-US race
// (e.g. "CA-NB") can have has_breakdown yet still fall back to a flat tint.
const US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM',
  'NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA',
  'WV','WI','WY',
])
export function raceHasMap(race) {
  if (!race || !race.has_breakdown) return false
  return US_STATES.has(String(race.province || '').toUpperCase())
}

// Distinct HUES for same-party runners-up (not shades of the same color). The
// vote leader keeps the party color so the party signal is preserved; others
// cycle through distinct hues. Muted, editorial jewel tones only — no gold, no
// electric neon, no green/red (those carry ballot-measure meaning elsewhere).
const DISTINCT_HUES = [
  '#8e6df0', '#5ab6c4', '#e5859c', '#7d8694', '#b07fc9', '#5b9e8f', '#c1c8d4',
];
export function tonePalette(cands) {
  const list = Array.isArray(cands) ? cands : [];
  const base = list.map((c) => candColor(c));
  const groups = {};
  base.forEach((c, i) => { (groups[c] ||= []).push(i); });
  const out = base.slice();
  let altIdx = 0;
  for (const color of Object.keys(groups)) {
    const idxs = groups[color];
    if (idxs.length <= 1) continue;
    idxs.sort((a, b) => (list[b].votes || 0) - (list[a].votes || 0));
    for (let j = 1; j < idxs.length; j++) {
      out[idxs[j]] = DISTINCT_HUES[altIdx++ % DISTINCT_HUES.length];
    }
  }
  return out;
}

// ── Region → our county_id join ───────────────────────────────────────
// our geometry ids: "LA-ACADIA", "AK-ALEUTIANS_EAST". civicAPI gives a
// region {name:"Power", type:"County"} under province "ID".
const DIA = (s) => {
  let out = '';
  for (const ch of String(s).normalize('NFD')) {
    const c = ch.codePointAt(0);
    if (c >= 0x300 && c <= 0x36f) continue; // combining diacritical marks
    out += ch;
  }
  return out;
};
export function regionKey(province, name) {
  if (!province || !name) return null;
  const n = DIA(String(name))
    .toUpperCase()
    .replace(/\b(COUNTY|PARISH|BOROUGH|CENSUS AREA|CITY AND BOROUGH|MUNICIPALITY|MUNICIPIO)\b/g, '')
    .trim()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${String(province).toUpperCase()}-${n}`;
}

// ── GeoJSON → SVG ─────────────────────────────────────────────────────
export function featuresForState(geo, province) {
  if (!geo || !province) return [];
  const pre = String(province).toUpperCase() + '-';
  return geo.features.filter((f) =>
    String(f.properties?.county_id || '').toUpperCase().startsWith(pre)
  );
}

const eachRing = (geom, cb) => {
  if (!geom) return;
  if (geom.type === 'Polygon') geom.coordinates.forEach(cb);
  else if (geom.type === 'MultiPolygon')
    geom.coordinates.forEach((poly) => poly.forEach(cb));
};

// Equirectangular fit with cos(lat) aspect correction → a projector +
// the rendered viewBox. Pure; good enough for a small static state map.
export function makeProjector(features, W, H, pad = 6) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const f of features)
    eachRing(f.geometry, (ring) => {
      for (const [x, y] of ring) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    });
  if (!isFinite(minX)) return null;
  const midLat = (minY + maxY) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180) || 1;
  const gw = (maxX - minX) * kx || 1;
  const gh = (maxY - minY) || 1;
  const s = Math.min((W - pad * 2) / gw, (H - pad * 2) / gh);
  const ox = (W - gw * s) / 2;
  const oy = (H - gh * s) / 2;
  const project = (lon, lat) => [
    ox + (lon - minX) * kx * s,
    oy + (maxY - lat) * s, // flip Y (screen)
  ];
  return { project, W, H };
}

export function geomToPath(geom, project) {
  let d = '';
  eachRing(geom, (ring) => {
    if (!ring.length) return;
    for (let i = 0; i < ring.length; i++) {
      const [px, py] = project(ring[i][0], ring[i][1]);
      d += (i ? 'L' : 'M') + px.toFixed(1) + ' ' + py.toFixed(1);
    }
    d += 'Z';
  });
  return d;
}

// Leader of a candidate list (region or race level) + lead margin.
export function leaderOf(cands) {
  if (!Array.isArray(cands) || !cands.length) return null;
  const s = [...cands].sort((a, b) => (b.votes || 0) - (a.votes || 0));
  const win = s.find((c) => c.winner) || s[0];
  const lead = (s[0]?.percent || 0) - (s[1]?.percent || 0);
  return { cand: win, lead: s.length > 1 ? lead : 100 };
}

// Neutral "no result yet" fill — graphite on dark, light grey on white so
// no-data counties don't read as dark blobs on the light basemap. Theme-aware
// at call time; stays a hex so mix()/shade() can consume it.
export const nodataFill = () =>
  typeof document !== 'undefined' && document.documentElement.dataset.opaTheme === 'light'
    ? '#dfe2e8'
    : '#2b2e37';
export const NODATA = '#2b2e37'; // legacy alias (dark)

export function regionVotes(region) {
  const c = Array.isArray(region?.candidates) ? region.candidates : [];
  return c.reduce((s, x) => s + (x.votes || 0), 0);
}

// One region's flat fill: vivid leader colour once it has real votes;
// civicAPI's own fill as the hybrid fallback; neutral graphite at 0%.
export function regionFill(region, nameToColor) {
  if (!region) return nodataFill();
  const votes = regionVotes(region);
  const reporting = Number(region.percent_reporting) || 0;
  if (votes <= 0 && reporting <= 0) return nodataFill();
  // LOCAL leader = most votes in THIS region. Don't use leaderOf here:
  // it keys off `winner:true`, which civicAPI sets on the race-level
  // winner inside every region's candidate list — so counties Gallrein
  // lost would still paint as Gallrein. Sort by votes and trust the count.
  const cs = [...(region.candidates || [])].sort(
    (a, b) => (b.votes || 0) - (a.votes || 0)
  );
  const localWin = cs[0];
  if (localWin && (localWin.votes || 0) > 0 && votes > 0) {
    const lead = (localWin.percent || 0) - (cs[1]?.percent || 0)
    const key = String(localWin.name || '').trim().toLowerCase()
    const base = (nameToColor && nameToColor[key]) || candColor(localWin)
    return mapShade(base, lead)
  }
  const f =
    typeof region.fill === 'string' && /^#?[0-9a-f]{6}$/i.test(region.fill.replace('#', ''))
      ? '#' + region.fill.replace('#', '')
      : null;
  return f || nodataFill();
}

// One shared in-flight + cache fetch with a small concurrency gate so we
// never burst civicAPI (it 403s a flood). Used for per-race detail.
let active = 0;
const queue = [];
const cache = new Map();
const MAX = 5;
function pump() {
  while (active < MAX && queue.length) {
    const job = queue.shift();
    active++;
    job();
  }
}
export function fetchRace(id, signal) {
  if (cache.has(id)) return Promise.resolve(cache.get(id));
  return new Promise((resolve, reject) => {
    const run = () => {
      fetch(`https://civicapi.org/api/v2/race/${id}`, { signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http ' + r.status))))
        .then((j) => {
          cache.set(id, j);
          resolve(j);
        })
        .catch(reject)
        .finally(() => {
          active--;
          pump();
        });
    };
    if (signal) signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    queue.push(run);
    pump();
  });
}

// US geometry — fetched once, lazily, only when the first map needs it.
// On any non-OK response (including 404 from the SPA catch-all, which
// returns index.html as HTML) we throw a labelled error instead of
// blindly calling .json() on HTML — otherwise the failure surfaces as a
// confusing "Unexpected token '<'" downstream.
//
// Path: the 6 MB national geojson lives in the PRECINCT deploy (already
// shipped + CDN-cached at /geo/us-counties.geojson) so we
// don't have to bloat the hub repo with a duplicate. Hub's own /public is
// .gitignored for *.geojson, which is why fetching '/us-national.geojson'
// off the hub origin returned the SPA index.html and silently broke every
// thumbnail in the elections list.
let geoP = null;
const GEO_URL = '/geo/us-counties.geojson';
export function loadGeo() {
  if (!geoP)
    geoP = fetch(GEO_URL, { credentials: 'omit' })
      .then((r) => {
        if (!r.ok) throw new Error('us-national.geojson http ' + r.status);
        const ct = r.headers.get('content-type') || '';
        if (ct.includes('html')) throw new Error('us-national.geojson got HTML');
        return r.json();
      })
      .catch((e) => {
        geoP = null;
        throw e;
      });
  return geoP;
}
