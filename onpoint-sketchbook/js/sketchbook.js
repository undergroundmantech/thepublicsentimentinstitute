/* ON POINT SKETCHBOOK runtime. Plain JS, no dependencies.
   Works as a <script type="module"> or imported from React (see react/SketchProvider.tsx).

   SK.init({ base:'/sketchbook', overlays:true })   call once
   SK.flash(ms)                                     static burst, e.g. on route change
   SK.coin(el)                                      build the 3D extruded logo coin in el
   SK.pointy(el,{pose:'idle'|'think'|'point-pointer'|'sit-ballot'|'wave-hello', run:false, wave:false})
*/
const SK = (() => {
  let BASE = '/sketchbook', started = false, reduce = false;
  const rnd = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const LOGO = 'M197.82,150c0,26.36-21.44,47.8-47.82,47.8-3.92,0-7.78-.47-11.5-1.4v-24.43c3.54,1.86,7.44,2.84,11.5,2.84,13.69,0,24.83-11.14,24.83-24.81s-11.14-24.83-24.83-24.83-24.81,11.14-24.81,24.83v80.38c-8.18-2.52-15.89-6.27-23.01-11.19v-69.19c0-26.38,21.46-47.84,47.82-47.84s47.82,21.46,47.82,47.84ZM150,65.85c-46.38,0-84.13,37.75-84.13,84.15v92.42c7.01,6.4,14.75,11.97,23.01,16.61v-109.03c0-33.73,27.42-61.16,61.12-61.16s61.14,27.44,61.14,61.16-27.44,61.12-61.14,61.12c-3.9,0-7.75-.36-11.5-1.08v23.28c3.77.53,7.63.8,11.5.8,46.4,0,84.15-37.75,84.15-84.13s-37.75-84.15-84.15-84.15ZM150,25c-68.92,0-125,56.06-125,125,0,28.56,9.75,56.12,27.54,78.24v-78.24c0-53.75,43.73-97.46,97.46-97.46s97.46,43.71,97.46,97.46-43.71,97.46-97.46,97.46c-4.62,0-9.3-.34-13.92-1.02-3.07-.44-6.19-1.04-9.26-1.78-8.62-2.12-16.89-5.4-24.64-9.77v30.59c8.24,3.43,16.82,5.95,25.51,7.5,2.78.51,5.7.93,8.92,1.29,4.49.47,9,.72,13.39.72,68.92,0,125-56.08,125-125S218.92,25,150,25Z';

  function defs() {
    if (document.getElementById('sk-defs')) return;
    const H = (id, ang, col, w, gap, fill) => `<pattern id="${id}" width="${gap}" height="${gap}" patternUnits="userSpaceOnUse" patternTransform="rotate(${ang})">${fill ? `<rect width="${gap}" height="${gap}" fill="${fill}"/>` : ''}<line x1="0" y1="0" x2="0" y2="${gap}" stroke="${col}" stroke-width="${w}"/></pattern>`;
    const svg = `<svg id="sk-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<filter id="sk-boil" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence id="sk-boil-t" type="fractalNoise" baseFrequency="0.025" numOctaves="2" seed="1"/><feDisplacementMap in="SourceGraphic" scale="7" xChannelSelector="R" yChannelSelector="G"/></filter>
<filter id="sk-wob" filterUnits="userSpaceOnUse" x="-110" y="-90" width="600" height="560"><feTurbulence id="sk-wob-t" type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="2"/><feDisplacementMap in="SourceGraphic" scale="2.6" xChannelSelector="R" yChannelSelector="G"/></filter>
<filter id="sk-pencil" filterUnits="userSpaceOnUse" x="-110" y="-90" width="540" height="540" color-interpolation-filters="sRGB">
 <feTurbulence id="sk-pencil-t" type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="1" result="n1"/>
 <feDisplacementMap in="SourceGraphic" in2="n1" scale="6" xChannelSelector="R" yChannelSelector="G" result="src"/>
 <feConvolveMatrix in="src" order="3" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" preserveAlpha="true" result="e1"/>
 <feConvolveMatrix in="src" order="3" kernelMatrix="1 1 1 1 -8 1 1 1 1" preserveAlpha="true" result="e2"/>
 <feComposite in="e1" in2="e2" operator="arithmetic" k2="1" k3="1" result="e"/>
 <feColorMatrix in="e" type="matrix" values="0 0 0 0 .09  0 0 0 0 .08  0 0 0 0 .11  2.2 2.2 2.2 0 0" result="ea"/>
 <feMorphology in="ea" operator="dilate" radius="1" result="ed"/>
 <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="1" seed="9" result="n2"/>
 <feDisplacementMap in="ed" in2="n2" scale="5" xChannelSelector="R" yChannelSelector="G" result="ed2"/>
 <feOffset in="ed2" dx="2.5" dy="-1.5" result="ed3"/>
 <feImage href="${BASE}/pencil-hatch.png" x="-40" y="-60" width="380" height="480" preserveAspectRatio="none" result="tex"/>
 <feComposite in="src" in2="tex" operator="in" result="hat"/>
 <feColorMatrix in="src" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 .28 0" result="wash"/>
 <feComponentTransfer in="ed3" result="ed4"><feFuncA type="linear" slope=".35"/></feComponentTransfer>
 <feMerge><feMergeNode in="wash"/><feMergeNode in="hat"/><feMergeNode in="ed4"/><feMergeNode in="ed2"/></feMerge></filter>
<filter id="sk-rgb" x="0" y="0" width="100%" height="100%">
 <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="r"/><feOffset in="r" dx="5" result="r2"/>
 <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="g"/>
 <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="b"/><feOffset in="b" dx="-5" result="b2"/>
 <feBlend in="r2" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="b2" mode="screen"/></filter>
<linearGradient id="sk-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3d7bff"/><stop offset=".5" stop-color="#9b5cff"/><stop offset="1" stop-color="#ff3b5c"/></linearGradient>
${H('sk-h-d-safe', 40, '#1f3fd1', 3.4, 5, 'rgba(31,63,209,.46)')}${H('sk-h-d-likely', 40, '#1f3fd1', 2, 6.5, 'rgba(31,63,209,.14)')}${H('sk-h-d-lean', 40, '#3d64e6', 1.2, 9, 'rgba(61,100,230,.07)')}
${H('sk-h-r-safe', -40, '#d42a2a', 3.4, 5, 'rgba(212,42,42,.46)')}${H('sk-h-r-likely', -40, '#d42a2a', 2, 6.5, 'rgba(212,42,42,.14)')}${H('sk-h-r-lean', -40, '#e05454', 1.2, 9, 'rgba(224,84,84,.07)')}
${H('sk-h-toss', 90, '#8a4cf0', 2, 8, 'rgba(138,76,240,.08)')}${H('sk-h-purple', 35, '#5b2bb0', 3, 7, 'rgba(107,47,214,.35)')}
${H('sk-h-good', 35, '#168c50', 3, 7, 'rgba(22,140,80,.3)')}${H('sk-h-bad', -35, '#d42a2a', 3, 7, 'rgba(212,42,42,.35)')}${H('sk-h-ink', 35, '#55505e', 2.4, 7, 'rgba(20,18,24,.12)')}${H('sk-h-off', 35, 'rgba(20,18,24,.22)', 1, 6, '#dcd7ca')}
</defs></svg>`;
    document.body.insertAdjacentHTML('afterbegin', svg);
    // CSS var inside an SVG attribute is not read by every browser: set the number directly
    const sc = getComputedStyle(document.documentElement).getPropertyValue('--sk-boil').trim() || '7';
    document.querySelector('#sk-boil feDisplacementMap').setAttribute('scale', sc);
  }

  function paper() {
    const c = document.createElement('canvas'); c.width = 900; c.height = 900; const g = c.getContext('2d');
    const im = g.createImageData(900, 900);
    for (let i = 0; i < im.data.length; i += 4) { const v = 225 + Math.random() * 22 - (Math.random() < .004 ? 120 : 0); im.data[i] = v; im.data[i + 1] = v - 3; im.data[i + 2] = v - 10; im.data[i + 3] = 255; }
    g.putImageData(im, 0, 0); g.globalAlpha = .05;
    for (let i = 0; i < 700; i++) { g.strokeStyle = '#5a5040'; g.lineWidth = Math.random() * 1.4; g.beginPath(); const x = Math.random() * 900, y = Math.random() * 900; g.moveTo(x, y); g.lineTo(x + Math.random() * 40 - 20, y + Math.random() * 40 - 20); g.stroke(); }
    document.documentElement.style.setProperty('--sk-ptex', `url(${c.toDataURL('image/jpeg', .85)})`);
  }

  let grain, gctx, stat, sctx, NB = [];
  function overlays() {
    if (document.querySelector('.sk-overlays')) return;
    const o = document.createElement('div'); o.className = 'sk-overlays'; o.setAttribute('aria-hidden', 'true');
    o.innerHTML = '<canvas class="static" width="270" height="480"></canvas><canvas class="grain" width="270" height="480"></canvas><div class="scan"></div><div class="vig"></div>';
    document.body.appendChild(o);
    stat = o.querySelector('.static'); grain = o.querySelector('.grain'); sctx = stat.getContext('2d'); gctx = grain.getContext('2d');
    for (let k = 0; k < 6; k++) { const im = gctx.createImageData(270, 480); for (let i = 0; i < im.data.length; i += 4) { const v = 128 + (Math.random() - .5) * 110; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } NB.push(im); }
  }

  let f = 0, flashUntil = 0;
  function tick() {
    f++;
    const bt = document.getElementById('sk-boil-t'), pt = document.getElementById('sk-pencil-t');
    if (bt) bt.setAttribute('seed', f % 40); if (pt) pt.setAttribute('seed', (f % 40) + 3); const wt = document.getElementById('sk-wob-t'); if (wt) wt.setAttribute('seed', (f % 40) + 5);
    if (gctx) gctx.putImageData(NB[f % NB.length], 0, 0);
    if (sctx) {
      const on = performance.now() < flashUntil;
      if (on) { sctx.putImageData(NB[(f + 3) % NB.length], 0, 0); sctx.fillStyle = 'rgba(0,0,0,.5)'; for (let i = 0; i < 5; i++) sctx.fillRect(0, rnd(f * 7 + i) * 480, 270, rnd(i + f) * 10); }
      stat.style.opacity = on ? .55 : 0;
    }
    setTimeout(() => requestAnimationFrame(tick), 1000 / 12);   // 12 fps: stop motion feel
  }
  function flash(ms = 160) { flashUntil = performance.now() + ms; }

  // reveal on scroll
  function typeIn(el) { const s = el.getAttribute('data-sk-type') || el.textContent; const cps = +(el.dataset.skCps || 40); el.textContent = ''; let i = 0; const t = setInterval(() => { el.textContent = s.slice(0, ++i); if (i >= s.length) clearInterval(t); }, 1000 / cps); }
  function countUp(el) { const to = parseFloat(el.dataset.skCount), dec = (el.dataset.skCount.split('.')[1] || '').length, pre = el.dataset.skPrefix || '', suf = el.dataset.skSuffix || ''; const t0 = performance.now(), d = +(el.dataset.skMs || 900);
    const step = n => { const p = Math.min(1, (n - t0) / d), e = 1 - Math.pow(1 - p, 3); el.textContent = pre + (to * e).toFixed(dec) + suf; if (p < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }
  function reveal(root = document) {
    const els = root.querySelectorAll('[data-sk-reveal],.sk-draw,.sk-bar,.sk-meter,.sk-check,[data-sk-type],[data-sk-count]');
    const go = el => {
      el.classList.add('sk-in');
      if (el.matches('.sk-draw')) el.querySelectorAll('path,line,polyline,rect').forEach(p => p.setAttribute('pathLength', '1'));
      if (el.matches('.sk-check')) [...el.children].forEach((li, i) => setTimeout(() => li.classList.add('done'), 160 + i * 220));
      if (el.hasAttribute('data-sk-type')) typeIn(el);
      if (el.hasAttribute('data-sk-count')) countUp(el);
      if (el.dataset.skReveal === 'slam') flash(120);
    };
    if (reduce || !('IntersectionObserver' in window)) { els.forEach(el => { el.classList.add('sk-in'); if (el.matches('.sk-check')) [...el.children].forEach(li => li.classList.add('done')); }); return; }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { const el = e.target; const d = +(el.dataset.skDelay || 0); setTimeout(() => go(el), d); io.unobserve(el); } }), { threshold: .25 });
    els.forEach(el => io.observe(el));
  }

  // 3D logo coin
  function coin(el, layers = 14) {
    let h = '<div class="stack">';
    for (let i = layers; i >= 1; i--) { const c = i < 3 ? '#4a1d9e' : '#24103f'; h += `<svg viewBox="0 0 300 300" style="transform:translateZ(${-i * 2.4}px)"><path d="${LOGO}" fill="${c}" stroke="${c}" stroke-width="1.2"/></svg>`; }
    h += `<svg viewBox="0 0 300 300" style="transform:translateZ(1px)"><path d="${LOGO}" fill="url(#sk-grad)"/><path class="sk-boil" d="${LOGO}" fill="none" stroke="#141218" stroke-width="2.2"/></svg></div>`;
    el.classList.add('sk-coin'); el.innerHTML = h;
  }

  // Pointy, from the official pack, rendered in colored pencil
  let pid = 0;
  async function pointy(el, opt = {}) {
    const pose = opt.pose || 'idle';
    let s = await (await fetch(`${BASE}/pointy/pointy-${pose}.svg`)).text();
    const tag = 'p' + (++pid);
    s = s.replace(/<title>[\s\S]*?<\/title>/, '');
    (s.match(/id="([^"]+)"/g) || []).forEach(m => { const id = m.slice(4, -1); s = s.split(`id="${id}"`).join(`id="${id}${tag}"`).split(`#${id})`).join(`#${id}${tag})`); });
    // the Nov 2026 Pointy is a clean cartoon: a light stop motion wobble by default, the full pencil sketch with {pencil:true}
    s = s.replace('<g class="pty-all"', `<g filter="url(#${opt.pencil ? 'sk-pencil' : 'sk-wob'})" class="pty-all"`);
    el.innerHTML = s; const svg = el.querySelector('svg'); svg.removeAttribute('width'); svg.removeAttribute('height'); svg.style.width = '100%'; svg.style.height = 'auto'; svg.style.overflow = 'visible';
    const all = svg.querySelector('.pty-all'), eye = svg.querySelector('.pty-eye'), af = svg.querySelector('.pty-arm.f'), ab = svg.querySelector('.pty-arm.b'), ll = svg.querySelector('.pty-leg.l'), lr = svg.querySelector('.pty-leg.r');
    const by = (all.getAttribute('transform') || '').match(/translate\(0 (\d+)\)/); const base = by ? +by[1] : 0;
    // each part carries its own joint in data-p, the eyes their centre in data-c; older packs fall back to the fixed joints
    const pv = (el, d) => (el && el.dataset.p) || d;
    const P_LL = pv(ll, '123 290'), P_LR = pv(lr, '177 290'), P_AB = pv(ab, '50 174'), P_AF = pv(af, '250 174'), EC = (eye && eye.dataset.c) || '155 176';
    if (reduce) return svg;
    const t0 = performance.now();
    const loop = now => {
      if (!svg.isConnected) return; const t = (now - t0) / 1000; const ph = t * 14;
      let bob = -Math.abs(Math.sin(t * 5.4)) * 6, lean = 0;
      if (opt.run) { const s1 = Math.sin(ph); bob = -Math.abs(Math.cos(ph)) * 20; lean = 9; ll && ll.setAttribute('transform', `rotate(${32 * s1} ${P_LL})`); lr && lr.setAttribute('transform', `rotate(${-32 * s1} ${P_LR})`); ab && ab.setAttribute('transform', `rotate(${10 - 50 * s1} ${P_AB})`); af && af.setAttribute('transform', `rotate(${-10 + 50 * s1} ${P_AF})`); }
      else if (opt.wave && af) af.setAttribute('transform', `rotate(${-140 + Math.sin(t * 9) * 18} ${P_AF})`);
      all.setAttribute('transform', `translate(0 ${base + bob}) rotate(${lean} 150 380)`);
      const b = t % 3.7; if (eye) eye.setAttribute('transform', `translate(${EC}) scale(1 ${b < .16 ? .08 + Math.abs(b - .08) / .08 * .92 : 1})`);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop); return svg;
  }

  function init(o = {}) {
    if (started) return; started = true; BASE = o.base || BASE;
    reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    defs(); paper(); if (o.overlays !== false) overlays();
    if (!reduce) tick();
    reveal();
    document.querySelectorAll('[data-sk-coin]').forEach(el => coin(el));
    document.querySelectorAll('[data-sk-pointy]').forEach(el => pointy(el, { pose: el.dataset.skPointy, run: el.hasAttribute('data-sk-run'), wave: el.hasAttribute('data-sk-wave') }));
    if (o.flashOnLoad !== false) flash(220);
  }
  return { init, flash, coin, pointy, reveal };
})();
if (typeof window !== 'undefined') window.SK = SK;
export default SK;
