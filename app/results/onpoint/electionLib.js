// Shared logic for the Election Results grid: a dark-tuned hybrid palette,
// civicAPI region→our-county-geometry joining, and a tiny dependency-free
// GeoJSON→SVG projector. No deps; pure functions.

// ── Palette ───────────────────────────────────────────────────────────
// OnPoint Politics party colors, data only: blue Democrat, red Republican,
// lavender independent. Everything that is not a party (ballot measures,
// nonpartisan contests, write-ins, no data) is neutral ink, so no party hue
// is ever borrowed for something that is not that party. Hex values (not CSS
// vars) because mix()/shade() parse them. The desk is dark only.
export const PARTY = {
  dem: '#3d7bff',   // --dem
  gop: '#ff3b5c',   // --gop
  yes: '#3ddc97',   // ballot measure approve (--win)
  no: '#8e86a3',    // ballot measure reject, neutral (--mute)
  ind: '#b78cff',   // independent / third party (--ind)
  other: '#c9c2d6', // nonpartisan / write-in / generic (--ink2)
  none: '#1c1626',  // no data / not reporting
}

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
  // Independent and minor parties share the independent lavender; civicAPI's
  // own per-candidate colors are ignored so no off-palette hue reaches a page.
  void cleanHex; void PLACEHOLDER;
  if (/(independent|green|working famil|progress|libertarian|reform|constitution|peace|socialist|labor)/.test(pt))
    return PARTY.ind;
  if (/(write|other|uncommitted|scatter|none of)/.test(nm)) return PARTY.other;
  if (/nonpartisan/.test(pt)) return PARTY.other;
  return PARTY.other;
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

// HEADER intensity (card/scoreboard tint behind white text). A dead heat sits
// quiet over the dark ground, a blowout deepens. `lead` = winner% - runnerup%.
export function shade(base, lead) {
  const t = Math.max(0, Math.min(1, (lead || 0) / 40));
  return mix('#150f1f', base, 0.28 + 0.62 * t);
}

// MAP / choropleth intensity, per the OnPoint maps ramp: pale for close, deep
// for solid. Party hues use the county margin ramp endpoints (--county-*-pale
// to --county-*-deep, saturating at 40 points); any other base runs from a
// pale tint of itself to a deep shade of itself.
export function mapShade(base, lead) {
  const t = Math.max(0, Math.min(1, (lead || 0) / 40));
  const b = String(base || '').toLowerCase();
  if (b === PARTY.dem) return mix('#d6e2ff', '#10288c', t);
  if (b === PARTY.gop) return mix('#ffdce4', '#8c0a28', t);
  return mix(mix(base, '#ffffff', 0.55), mix(base, '#0a0711', 0.45), t);
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

// Same-party runners up get tones of their own party family (never another
// party's hue); the vote leader keeps the full party color. Pale tint first,
// matching the results rows (winner deep, runners up pale).
const FAMILY = {
  [PARTY.dem]: ['#b9ccff', '#1a3fb0', '#7fa6ff', '#10288c'],
  [PARTY.gop]: ['#ffbfcb', '#b0163a', '#ff8399', '#8c0a28'],
  [PARTY.ind]: ['#d9c6ff', '#7b5bc4', '#9d7ae6'],
  [PARTY.other]: ['#8e86a3', '#5f5873', '#e6e1ee', '#6f6883'],
  [PARTY.yes]: ['#9fedcb'],
  [PARTY.no]: ['#5f5873'],
};
export function tonePalette(cands) {
  const list = Array.isArray(cands) ? cands : [];
  const base = list.map((c) => candColor(c));
  const groups = {};
  base.forEach((c, i) => { (groups[c] ||= []).push(i); });
  const out = base.slice();
  for (const color of Object.keys(groups)) {
    const idxs = groups[color];
    if (idxs.length <= 1) continue;
    idxs.sort((a, b) => (list[b].votes || 0) - (list[a].votes || 0));
    const fam = FAMILY[color] || FAMILY[PARTY.other];
    for (let j = 1; j < idxs.length; j++) {
      out[idxs[j]] = fam[(j - 1) % fam.length];
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

// Neutral "no result yet" fill; stays a hex so mix()/shade() can consume it.
export const nodataFill = () => PARTY.none;
export const NODATA = PARTY.none; // legacy alias

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
  // civicAPI's own fill is off palette, so no-vote regions stay neutral.
  return nodataFill();
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
