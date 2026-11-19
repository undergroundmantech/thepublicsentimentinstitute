/* ON POINT SKETCHBOOK map engine. Plain JS, no dependencies.

   Reads every map on the page, whatever palette it was drawn with, and tags each partisan shape so the kit's CSS
   can redraw it in pencil. Nothing is written to fill or style, so React can keep re-rendering its maps freely.

     data-sk-fill   h-d-safe | h-d-likely | h-d-lean | h-r-* | h-toss | h-purple     pencil hatching
                    f-d-1 .. f-d-5 | f-r-1 .. f-r-5 | f-t | f-i                       flat ink wash
     data-sk-party  d | r | t | i

   States get hatching. Counties, House districts and any map drawn small get the flat wash instead, on a five step
   ramp that keeps the margin detail: hatching on a ten pixel county only reads as noise. A map counts as fine
   grained when it has more than sixty partisan shapes, when many of them are small on screen, or when its shapes
   carry a county style hook such as .county, .district, data-fips, data-county or data-cd.

   The engine also draws one hover ring per map, on top of every shape, so a hovered county is never half hidden by
   the neighbors painted after it.

   Opt out per map:  data-sk-nohatch  keeps the original colors
                     data-sk-noring   keeps the site's own hover treatment
                     data-sk-draw="flat" or "hatch"  forces one drawing mode

   SKMaps.start()  begin watching the page, returns a stop function
   SKMaps.sweep()  re-read every map now, e.g. after a zoom
*/
const SHAPES = 'path, polygon, rect';
const MIN_SVG = 150;          // drawings smaller than this are icons and portraits, never maps
const SMALL = 20;             // a shape under this many pixels on its short side is too small to hatch
const FLAT_SHARE = 0.4;       // when this share of a map's shapes is small, the whole map goes flat
const FLAT_COUNT = 60;        // more partisan shapes than there are states: counties, districts or precincts
// markup that says a shape is a county, district or precinct, so even a three county state draws flat
const FINE = '.county, .cty, .precinct, .district, [data-fips], [data-county], [data-cd], [data-precinct]';
const NS = 'http://www.w3.org/2000/svg';

function parse(c) {
  if (!c) return null;
  c = c.trim();
  if (c[0] === '#') {
    let h = c.slice(1);
    if (h.length === 3 || h.length === 4) h = h.split('').map((x) => x + x).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    if (h.length === 8 && parseInt(h.slice(6), 16) / 255 < 0.6) return null;
    const n = parseInt(h.slice(0, 6), 16);
    if (Number.isNaN(n)) return null;
    return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const m = c.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+%?))?/);
  if (!m) return null;
  if (m[4] !== undefined) { const a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]); if (a < 0.6) return null; }
  return [+m[1] / 255, +m[2] / 255, +m[3] / 255];
}
function hsl([r, g, b]) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60; if (h < 0) h += 360;
  return { h, s, l };
}
// Which party a fill color stands for and how strong it is. Blue is Democratic, red Republican, the toss up gold
// and the independent lavender get their own marks. Greys, near whites and near blacks are left alone.
export function classify(fill) {
  const rgb = parse(fill); if (!rgb) return null;
  const { h, s, l } = hsl(rgb);
  if (s < 0.35 || l > 0.93 || l < 0.12) return null;
  let party = null;
  if (h >= 205 && h <= 240) party = 'd';
  else if (h >= 335 || h <= 8) party = 'r';
  else if (h >= 35 && h <= 52 && s > 0.55 && l < 0.75) party = 't';
  else if (h >= 255 && h <= 290 && s > 0.45) party = 'i';
  if (!party) return null;
  return { party, tier: l < 0.5 ? 'safe' : l < 0.7 ? 'likely' : 'lean', lvl: l <= 0.38 ? 5 : l <= 0.5 ? 4 : l <= 0.62 ? 3 : l <= 0.76 ? 2 : 1 };
}
function token(c, flat) {
  if (c.party === 't') return flat ? 'f-t' : 'h-toss';
  if (c.party === 'i') return flat ? 'f-i' : 'h-purple';
  return flat ? `f-${c.party}-${c.lvl}` : `h-${c.party}-${c.tier}`;
}

const seen = new WeakMap();    // shape: { key, cls } the fill we last read and what it meant
const mode = new WeakMap();    // svg: { partisan, flat }
const keyOf = (el) => `${el.style.fill}|${el.getAttribute('fill') || ''}|${el.getAttribute('class') || ''}`;
const skip = (el) => !!el.closest('defs, pattern, clipPath, mask, symbol, marker, .sk-map-ring, #sk-defs');
const untag = (el) => { if (el.hasAttribute('data-sk-fill')) { el.removeAttribute('data-sk-fill'); el.removeAttribute('data-sk-party'); } };
const tag = (el, t, party) => { if (el.getAttribute('data-sk-fill') !== t) { el.setAttribute('data-sk-fill', t); el.setAttribute('data-sk-party', party); } };
// the fill a shape was given by the site: its own style or attribute when that is a plain color
function ownFill(el) {
  const s = el.style.fill; if (s && !s.startsWith('url(') && parse(s)) return s;
  const a = el.getAttribute('fill'); if (a && parse(a)) return a;
  return null;
}

// One full pass over a drawing, in three phases so the browser lays the page out once and not once per county.
function sweepSvg(svg) {
  if (!svg.isConnected || skip(svg)) return;
  const off = svg.closest('[data-sk-nohatch]');
  const box = svg.getBoundingClientRect();
  const shapes = [...svg.querySelectorAll(SHAPES)].filter((e) => !skip(e));
  if (off || (box.width < MIN_SVG && box.height < MIN_SVG)) { shapes.forEach(untag); mode.set(svg, { partisan: false, flat: false }); return; }

  // 1. shapes colored through a class need their computed fill, read with our own tag out of the way
  const rows = shapes.map((el) => ({ el, key: keyOf(el), own: ownFill(el), cls: null, w: 0, h: 0, k: 1 }));
  for (const r of rows) if (!r.own) untag(r.el);
  // 2. read
  let dr = 0, other = 0;
  for (const r of rows) {
    let raw = r.own;
    if (!raw) { raw = getComputedStyle(r.el).fill; if (raw.startsWith('url(')) raw = ''; }
    r.cls = classify(raw);
    if (!r.cls) continue;
    if (r.cls.party === 'd' || r.cls.party === 'r') dr++; else other++;
    const b = r.el.getBoundingClientRect(); r.w = b.width; r.h = b.height;
    const m = r.el.getScreenCTM && r.el.getScreenCTM(); r.k = m ? Math.hypot(m.a, m.b) : 1;
  }
  // A drawing is redrawn only when it reads as a partisan map: at least three blue or red shapes, and more of them
  // than gold or lavender ones. Candidate maps in the primaries, one color per candidate, keep their colors.
  const partisan = dr >= 3 && dr >= other;
  let flat = false;
  if (partisan) {
    const marked = rows.filter((r) => r.cls && r.w > 0);
    const small = marked.filter((r) => Math.min(r.w, r.h) < SMALL).length;
    const ks = marked.map((r) => r.k).sort((a, b) => a - b), k = ks[ks.length >> 1] || 1;
    // hatch strokes scale with the drawing: shrunk they turn to mud, zoomed in they turn to stripes
    flat = marked.length > FLAT_COUNT || small / Math.max(1, marked.length) > FLAT_SHARE || k < 0.55 || k > 1.8 || marked.some((r) => r.el.matches(FINE));
    const force = svg.closest('[data-sk-draw]'); if (force) flat = force.getAttribute('data-sk-draw') === 'flat';
  }
  mode.set(svg, { partisan, flat });
  // 3. write
  for (const r of rows) {
    seen.set(r.el, { key: r.key, cls: r.cls });
    if (!partisan || !r.cls) { untag(r.el); continue; }
    if (r.el.tagName === 'rect' && (r.w < 10 || r.h < 10)) { untag(r.el); continue; }
    tag(r.el, token(r.cls, flat || Math.min(r.w, r.h) < SMALL * 0.6), r.cls.party);
  }
}

// One shape changed color, e.g. React re-rendered a county on a new vote drop: re-read that shape alone.
function touch(el) {
  const svg = el.ownerSVGElement; if (!svg || skip(el)) return;
  const st = mode.get(svg); if (!st) { sweepSvg(svg); return; }
  const key = keyOf(el), was = seen.get(el);
  if (was && was.key === key) return;
  let raw = ownFill(el);
  if (!raw) { untag(el); raw = getComputedStyle(el).fill; if (raw.startsWith('url(')) raw = ''; }
  const cls = classify(raw); seen.set(el, { key, cls });
  if (!st.partisan || !cls) { untag(el); return; }
  const b = el.getBoundingClientRect();
  tag(el, token(cls, st.flat || Math.min(b.width, b.height) < SMALL * 0.6), cls.party);
}

export function sweep(root = document.body) {
  if (!root) return;
  if (root instanceof SVGSVGElement) { sweepSvg(root); return; }
  if (root instanceof SVGElement) { if (root.ownerSVGElement) sweepSvg(root.ownerSVGElement); return; }
  root.querySelectorAll && root.querySelectorAll('svg').forEach((s) => { if (!s.ownerSVGElement) sweepSvg(s); });
}

/* ---------- hover ring ---------- */
let ring = null, ringFor = null;
function outline(el) {
  if (el.tagName === 'path') return el.getAttribute('d');
  if (el.tagName === 'polygon') { const p = (el.getAttribute('points') || '').trim(); return p ? `M${p}Z` : null; }
  return null;
}
function showRing(el) {
  const svg = el.ownerSVGElement, d = outline(el);
  if (!svg || !d || el.closest('[data-sk-noring]')) return;
  if (!ring) { ring = document.createElementNS(NS, 'g'); ring.setAttribute('class', 'sk-map-ring'); ring.setAttribute('aria-hidden', 'true'); ring.innerHTML = '<path class="glow"/><path class="ink"/>'; }
  const a = svg.getScreenCTM(), b = el.getScreenCTM(); if (!a || !b) return;
  const m = a.inverse().multiply(b);
  ring.setAttribute('transform', `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`);
  ring.setAttribute('data-sk-party', el.getAttribute('data-sk-party') || '');
  ring.querySelectorAll('path').forEach((p) => p.setAttribute('d', d));
  if (ring.parentNode !== svg || svg.lastElementChild !== ring) svg.appendChild(ring);
  ringFor = el;
}
function hideRing(el) { if (ring && (!el || el === ringFor)) { ring.remove(); ringFor = null; } }

export function start() {
  if (typeof document === 'undefined' || !document.documentElement.hasAttribute('data-sk')) return () => {};
  const pending = new Set(), shapes = new Set(); let raf = 0;
  const flush = () => { raf = 0; pending.forEach(sweep); pending.clear(); shapes.forEach((el) => { if (el.isConnected) touch(el); }); shapes.clear(); };
  const kick = () => { if (!raf) raf = requestAnimationFrame(flush); };
  const queue = (n) => { pending.add(n); kick(); };
  queue(document.body);
  const mo = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'childList') m.addedNodes.forEach((n) => {
        if (!(n instanceof Element) || n.classList.contains('sk-map-ring') || n.id === 'sk-defs') return;
        if (n instanceof SVGElement) { const o = n instanceof SVGSVGElement ? n : n.ownerSVGElement; if (o) queue(o); }
        else if (n.querySelector('svg')) queue(n);
      });
      else if (m.target instanceof SVGElement && m.target.matches(SHAPES) && !skip(m.target)) { shapes.add(m.target); kick(); }
    }
  });
  mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['fill', 'style', 'class'] });
  // fonts and late layout can resize a map after the first pass; a resize can move it between hatch and flat
  const late = setTimeout(() => queue(document.body), 1500);
  let rt = 0; const onResize = () => { clearTimeout(rt); rt = setTimeout(() => queue(document.body), 220); };
  window.addEventListener('resize', onResize);
  const hit = (e) => (e.target instanceof SVGElement && e.target.hasAttribute('data-sk-fill') ? e.target : null);
  const over = (e) => { const el = hit(e); if (el) showRing(el); };
  const out = (e) => { const el = hit(e); if (el) hideRing(el); };
  document.addEventListener('pointerover', over); document.addEventListener('pointerout', out);
  document.addEventListener('focusin', over); document.addEventListener('focusout', out);
  return () => {
    mo.disconnect(); if (raf) cancelAnimationFrame(raf); clearTimeout(late); clearTimeout(rt); window.removeEventListener('resize', onResize);
    document.removeEventListener('pointerover', over); document.removeEventListener('pointerout', out);
    document.removeEventListener('focusin', over); document.removeEventListener('focusout', out); hideRing();
  };
}

const SKMaps = { start, sweep, classify };
if (typeof window !== 'undefined') window.SKMaps = SKMaps;
export default SKMaps;
