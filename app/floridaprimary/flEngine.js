// Ported, numbers-for-numbers, from changeorders/TPSI_FL_Scenario_Engine_Final.html.
// Deliberately left as plain imperative JS (matches the source prototype and this
// repo's convention for ported legacy widgets, e.g. app/results/onpoint/*.jsx) so the
// math/DOM logic below stays byte-for-byte equivalent to the reference build. The
// ONLY behavioral additions vs. the source file are: (1) container ids are "fl-"
// prefixed to avoid colliding with global site ids, (2) candidate colors are chosen
// per light/dark `data-theme` instead of one fixed light palette, and (3) a
// MutationObserver re-renders on theme toggle so the map/legend/table recolor live.
import B from "./flData.json";

const CAND = ["Donalds", "Fishback", "Collins", "Renner"], ALL = CAND.concat("Other");
const NM = { Donalds: "Byron Donalds", Fishback: "James Fishback", Collins: "Jay Collins", Renner: "Paul Renner", Other: "Other" };
const LB = { Donalds: "Donalds", Fishback: "Fishback", Collins: "Collins", Renner: "Renner", Other: "Other" };

// Candidate swatches, chosen to echo the source file's hues (red/teal/purple/gold/gray)
// while matching this site's --gop/--live/--purple/--gold/--muted tokens per theme.
const CO_LIGHT = { Donalds: "#c22f3b", Fishback: "#0d9488", Collins: "#6d3ee9", Renner: "#a16207", Other: "#6f6f68" };
const CO_DARK  = { Donalds: "#d64550", Fishback: "#2dd4bf", Collins: "#8a63ef", Renner: "#e8b93c", Other: "#9aa0b4" };
function isDarkTheme() {
  return typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark";
}

export function initFloridaEngine() {
  let CO = isDarkTheme() ? CO_DARK : CO_LIGHT;

  const AGE = B.age, RXE = B.rxe, CT = B.counties, DEF = B.def, BE = B.base_elec, PR = B.prop, TN = B.turnout;
  const HOME = [
    { c: "Fishback", seat: "MADISON", name: "Madison", sub: "Fishback residence", spill: ["JEFFERSON", "TAYLOR", "HAMILTON", "SUWANNEE", "LAFAYETTE"] },
    { c: "Collins", seat: "HILLSBOROUGH", name: "Hillsborough", sub: "Collins home county", spill: ["PINELLAS", "PASCO", "POLK", "MANATEE"] },
    { c: "Renner", seat: "FLAGLER", name: "Flagler", sub: "Renner home", spill: ["VOLUSIA", "ST. JOHNS", "PUTNAM"] },
    { c: "Donalds", seat: "COLLIER", name: "Collier / FL-19", sub: "Donalds district", spill: ["LEE", "CHARLOTTE", "HENDRY"] },
  ];
  const PRESETS = {
    published: { label: "TPSI baseline", age: DEF.age, rxe: DEF.rxe, home: [0, 0, 0, 0], oth: 5.2, elec: null },
    home: { label: "Baseline + home field", age: B.preset_home.age, rxe: B.preset_home.rxe, home: B.preset_home.home, oth: B.preset_home.other, elec: B.preset_home.elec },
    fishback: { label: "Fishback surge", age: B.preset_fishback.age, rxe: B.preset_fishback.rxe, home: B.preset_fishback.home, oth: 5.2, elec: B.preset_fishback.elec },
    split: { label: "Split field", age: B.preset_split.age, rxe: B.preset_split.rxe, home: B.preset_split.home, oth: B.preset_split.other, elec: B.preset_split.elec },
    donalds: { label: "Donalds runaway", age: B.preset_donalds.age, rxe: B.preset_donalds.rxe, home: B.preset_donalds.home, oth: B.preset_donalds.other, elec: B.preset_donalds.elec },
  };
  let cur = "published", AGEV, RXEV, HOMEV, ELA, ELR, OTHT, TPCT, useTurnout, view = "margin", openCty = null, OTHSCALE = 1;
  let sortK = "votes", sortDir = -1, expandAll = false, lastR = null;
  const fmt = (n) => Math.round(n).toLocaleString();
  const hx = (h) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16));
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t)), rgb = (c) => `rgb(${c})`;

  /* ---------- turnout model: propensity compression anchored at nominal ---------- */
  function turnoutComp() {
    if (!useTurnout) return { age: null, rxe: null, total: TN.nominal };
    const s0 = Math.max(0, (TPCT - TN.t0) / (TN.nom_pct - TN.t0));
    const votes = TN.reg_r * TPCT / 100;
    const out = { age: {}, rxe: {} };
    [["age", AGE, PR.age_reg, 1.0], ["rxe", RXE, PR.rxe_reg, TN.damp_rxe]].forEach(([id, keys, reg, damp]) => {
      const s = Math.max(0, 1 + (s0 - 1) * damp);
      let m = [], tot = 0;
      keys.forEach((g, j) => {
        const h = Math.max(B.hist[id][g], .01) / 100, n = Math.max(BE[id][g], .01) / 100;
        const v = h * Math.pow(n / h, s); m.push(v); tot += v;
      });
      m = m.map((v) => v / tot);
      // hard cap: a group cannot supply more votes than it has registrants
      const cap = reg.map((r) => r * TN.reg_r / votes);
      for (let it = 0; it < 60; it++) {
        let ex = 0, roomSum = 0; const over = [];
        m.forEach((v, j) => { if (v > cap[j]) { ex += v - cap[j]; over.push(j); } else roomSum += v; });
        if (!ex || !roomSum) break;
        over.forEach((j) => m[j] = cap[j]);
        m = m.map((v, j) => over.includes(j) ? v : v + ex * v / roomSum);
      }
      let t2 = m.reduce((a, b) => a + b, 0);
      keys.forEach((g, j) => out[id][g] = m[j] / t2 * 100);
    });
    out.total = votes;
    return out;
  }
  function elecWeights() {
    const ma = {}, mr = {};
    const TCx = useTurnout ? turnoutComp() : null;
    const ea = TCx ? TCx.age : ELA, er = TCx ? TCx.rxe : ELR;
    AGE.forEach((g) => ma[g] = (ea[g] || 0) / Math.max(BE.age[g], .01));
    RXE.forEach((g) => mr[g] = (er[g] || 0) / Math.max(BE.rxe[g], .01));
    const out = {}; let T = 0, TOT = 0;
    for (const k in CT) {
      const c = CT[k];
      let fa = 0, fr = 0;
      AGE.forEach((g, i) => fa += c.age[i] * ma[g]); RXE.forEach((g, i) => fr += c.rxe[i] * mr[g]);
      const v = c.votes * Math.sqrt(Math.max(fa, .01) * Math.max(fr, .01));
      out[k] = { v, ma, mr }; T += v; TOT += c.votes;
    }
    const TC = turnoutComp();
    const scale = (TC.total || TN.nominal) / T;
    for (const k in out) out[k].v *= scale;
    return out;
  }
  function compute() {
    const EW = elecWeights(), out = {};
    for (const k in CT) {
      const c = CT[k], lo = {}, p = {};
      let bA = 0, nA = 0, bR = 0, nR = 0; const ca = [], cr = [];
      AGE.forEach((g, i) => { const bs = c.age[i], ns = c.age[i] * EW[k].ma[g]; bA += bs; nA += ns; ca.push([g, bs, ns]); });
      RXE.forEach((g, i) => { const bs = c.rxe[i], ns = c.rxe[i] * EW[k].mr[g]; bR += bs; nR += ns; cr.push([g, bs, ns]); });
      CAND.forEach((cd) => {
        let t = 0;
        ca.forEach(([g, bs, ns]) => t += (ns / Math.max(nA, 1e-9)) * (Math.log(Math.max(AGEV[g][cd], .5)) - Math.log(Math.max(DEF.age[g][cd], .5))));
        cr.forEach(([g, bs, ns]) => t += (ns / Math.max(nR, 1e-9)) * (Math.log(Math.max(RXEV[g][cd], .5)) - Math.log(Math.max(DEF.rxe[g][cd], .5))));
        let pb = 0, pn = 0, qb = 0, qn = 0;
        ca.forEach(([g, bs, ns]) => { const v = Math.max(AGEV[g][cd], .5); pb += bs / Math.max(bA, 1e-9) * v; pn += ns / Math.max(nA, 1e-9) * v; });
        cr.forEach(([g, bs, ns]) => { const v = Math.max(RXEV[g][cd], .5); qb += bs / Math.max(bR, 1e-9) * v; qn += ns / Math.max(nR, 1e-9) * v; });
        const comp = (Math.log(Math.max(pn, .01)) - Math.log(Math.max(pb, .01))) + (Math.log(Math.max(qn, .01)) - Math.log(Math.max(qb, .01)));
        lo[cd] = Math.log(Math.max(c[cd], .3)) + t + comp;
      });
      HOME.forEach((h, i) => {
        if (!HOMEV[i]) return;
        if (k === h.seat) lo[h.c] += HOMEV[i]; else if (h.spill.includes(k)) lo[h.c] += HOMEV[i] * .45;
      });
      let s2 = 0; CAND.forEach((cd) => { p[cd] = Math.exp(lo[cd]); s2 += p[cd]; });
      const oth = Math.min(60, Math.max(0, c.Other * OTHSCALE)), room = 100 - oth;
      CAND.forEach((cd) => p[cd] = p[cd] / s2 * room); p.Other = oth;
      const ord = ALL.slice().sort((x, y) => p[y] - p[x]);
      out[k] = {
        p, votes: EW[k].v, name: c.name, region: c.region, nobs: c.nobs, ld: ord[0], sd: ord[1], mg: p[ord[0]] - p[ord[1]],
        age: c.age, rxe: c.rxe,
      };
    }
    const sw = {}, swv = {}; let T = 0; ALL.forEach((c) => { sw[c] = 0; swv[c] = 0; });
    for (const k in out) { const o = out[k]; T += o.votes; ALL.forEach((c) => swv[c] += o.p[c] / 100 * o.votes); }
    ALL.forEach((c) => sw[c] = swv[c] / T * 100);
    return { counties: out, sw, swv, total: T };
  }

  /* ---------- UI ---------- */
  function loadPreset(k) {
    const p = PRESETS[k]; cur = k;
    AGEV = JSON.parse(JSON.stringify(p.age)); RXEV = JSON.parse(JSON.stringify(p.rxe));
    HOMEV = p.home.slice(); OTHT = p.oth;
    ELA = JSON.parse(JSON.stringify(p.elec ? p.elec.age : BE.age));
    ELR = JSON.parse(JSON.stringify(p.elec ? p.elec.rxe : BE.rxe));
    TPCT = TN.nom_pct; useTurnout = false; openCty = null; render();
  }
  function mtable(id, title, store, keys, el) {
    let h = `<div class="card"><div class="ch"><div class="ct">${title}</div><div class="cs">% within group</div></div><div class="cb">
  <table class="mx"><tr><th></th>`;
    CAND.forEach((c) => h += `<th style="color:${CO[c]}">${LB[c].slice(0, 8)}</th>`);
    h += `<th>Other</th><th>Elec</th></tr>`;
    keys.forEach((k) => {
      const o = 100 - CAND.reduce((s, c) => s + (+store[k][c] || 0), 0);
      h += `<tr><td>${k}</td>`;
      CAND.forEach((c) => h += `<td><input data-m="${id}" data-k="${k}" data-c="${c}" value="${store[k][c]}"></td>`);
      h += `<td><input class="ro" data-ro="${id}" data-k="${k}" value="${o.toFixed(1)}" readonly></td>`;
      h += `<td><input class="el" data-e="${id}" data-k="${k}" value="${(+el[k]).toFixed(1)}"></td></tr>`;
    });
    const t = keys.reduce((s, k) => s + (+el[k] || 0), 0);
    h += `</table><div class="hint">Other fills each row to 100. <b>Elec</b> is the group's share of the
  electorate, now <b id="et_${id}">${t.toFixed(1)}%</b>.</div></div></div>`;
    return h;
  }
  function render() {
    CO = isDarkTheme() ? CO_DARK : CO_LIGHT;
    document.getElementById("fl-presets").innerHTML = Object.entries(PRESETS).map(([k, v]) =>
      `<button class="pbtn${k === cur ? " on" : ""}" data-p="${k}">${v.label}</button>`).join("");
    document.querySelectorAll("[data-p]").forEach((b) => b.onclick = () => loadPreset(b.dataset.p));
    const TC = useTurnout ? turnoutComp() : null;
    document.getElementById("fl-left").innerHTML =
      `<div class="card"><div class="ch"><div class="ct">Turnout</div>
    <div class="cs" id="t_state">${useTurnout ? "model on" : "nominal"}</div></div><div class="cb">
   <div class="tsum"><div><div class="tbig" id="t_ballots">${fmt(useTurnout ? TN.reg_r * TPCT / 100 : TN.nominal)}</div>
     <div class="tsm">projected ballots</div></div>
    <div style="text-align:right"><div class="tbig" id="t_pct">${(useTurnout ? TPCT : TN.nom_pct).toFixed(1)}%</div>
     <div class="tsm">of registered R</div></div></div>
   <div class="row"><div class="rl">Model turnout shift<i>off = nominal electorate</i></div>
    <button class="tgl${useTurnout ? " on" : ""}" data-tog="1" aria-label="toggle turnout model"></button>
    <div class="rv"></div></div>
   <div class="row"><div class="rl">Turnout rate<i>marginal voters skew young</i></div>
    <input type="range" min="16" max="45" step="0.2" value="${TPCT}" data-tp="1" ${useTurnout ? "" : "disabled"}>
    <div class="rv" id="t_rate">${TPCT.toFixed(1)}%</div></div>
   <div class="hint" id="t_note"></div>
   </div></div>` +
      mtable("age", "Vote targets by age", AGEV, AGE, useTurnout ? TC.age : ELA) +
      mtable("rxe", "Vote targets by race &amp; education", RXEV, RXE, useTurnout ? TC.rxe : ELR) +
      `<div class="card"><div class="ch"><div class="ct">Home field &amp; field size</div><div class="cs">log-odds</div></div><div class="cb">` +
      HOME.map((h, i) => `<div class="row"><div class="rl">${h.name}<i>${h.sub}</i></div>
    <input type="range" min="0" max="2" step="0.05" value="${HOMEV[i]}" data-home="${i}">
    <div class="rv">${(+HOMEV[i]).toFixed(2)}</div></div>`).join("") +
      `<div class="row"><div class="rl">Minor candidates<i>held out of the four-way split</i></div>
     <input type="range" min="0" max="20" step="0.1" value="${OTHT}" data-oth="1">
     <div class="rv">${(+OTHT).toFixed(1)}%</div></div>
    <button class="btn alt" style="margin-top:13px" id="reset">Reset scenario</button></div></div>`;
    bind(); syncTurnout(); draw();
  }
  function bind() {
    document.querySelectorAll(".mx input:not(.ro)").forEach((el) => {
      el.oninput = () => {
        const v = parseFloat(el.value); if (isNaN(v)) return;
        if (el.dataset.e) { if (useTurnout) return; (el.dataset.e === "age" ? ELA : ELR)[el.dataset.k] = v; }
        else (el.dataset.m === "age" ? AGEV : RXEV)[el.dataset.k][el.dataset.c] = v;
        refreshRO(); draw();
      };
    });
    document.querySelectorAll("[data-home]").forEach((el) => {
      el.oninput = () => {
        HOMEV[+el.dataset.home] = parseFloat(el.value);
        el.nextElementSibling.textContent = parseFloat(el.value).toFixed(2); draw();
      };
    });
    const o = document.querySelector("[data-oth]");
    if (o) o.oninput = () => { OTHT = parseFloat(o.value); o.nextElementSibling.textContent = OTHT.toFixed(1) + "%"; draw(); };
    const tg = document.querySelector("[data-tog]");
    if (tg) tg.onclick = () => {
      useTurnout = !useTurnout;
      tg.classList.toggle("on", useTurnout);
      const tp2 = document.querySelector("[data-tp]");
      if (tp2) tp2.disabled = !useTurnout;
      syncTurnout(); draw();
    };
    const tp = document.querySelector("[data-tp]");
    if (tp) tp.oninput = () => { TPCT = parseFloat(tp.value); syncTurnout(); draw(); };
    document.getElementById("reset").onclick = () => loadPreset(cur);
  }
  function syncTurnout() {
    const TC = useTurnout ? turnoutComp() : null;
    const tot = useTurnout ? TN.reg_r * TPCT / 100 : TN.nominal;
    const pct = useTurnout ? TPCT : TN.nom_pct;
    const a = document.getElementById("t_ballots"), b = document.getElementById("t_pct"),
      c = document.getElementById("t_state"), d = document.getElementById("t_rate"),
      e = document.getElementById("t_note");
    if (a) a.textContent = fmt(tot);
    if (b) b.textContent = pct.toFixed(1) + "%";
    if (c) c.textContent = useTurnout ? "model on" : "nominal";
    if (d) d.textContent = TPCT.toFixed(1) + "%";
    if (e) e.innerHTML = useTurnout ?
      `Under-40 <b>${(TC.age["18-29"] + TC.age["30-39"]).toFixed(1)}%</b> · 65+ <b>${TC.age["65+"].toFixed(1)}%</b> · nominal 31.6 / 45.6` :
      `Nominal electorate. Turn on to model turnout shifts.`;
    document.querySelectorAll("input.el").forEach((el) => {
      const id = el.dataset.e, k = el.dataset.k;
      const v = useTurnout ? TC[id][k] : (id === "age" ? ELA : ELR)[k];
      el.value = (+v).toFixed(1); el.readOnly = useTurnout;
      el.style.opacity = useTurnout ? .55 : 1;
    });
  }
  function refreshRO() {
    document.querySelectorAll("input.ro").forEach((el) => {
      const st = el.dataset.ro === "age" ? AGEV : RXEV;
      const o = 100 - CAND.reduce((s, c) => s + (+st[el.dataset.k][c] || 0), 0);
      el.value = o.toFixed(1); el.style.color = o < 0 ? CO.Donalds : "";
    });
    [["age", ELA, AGE], ["rxe", ELR, RXE]].forEach(([id, st, keys]) => {
      const t = keys.reduce((s, k) => s + (+st[k] || 0), 0), e = document.getElementById("et_" + id);
      if (e) { e.textContent = t.toFixed(1) + "%"; e.style.color = Math.abs(t - 100) > .6 ? CO.Donalds : ""; }
    });
  }

  const TABS = { margin: "Margin", votes: "Turnout", Donalds: "Donalds", Fishback: "Fishback", Collins: "Collins", Renner: "Renner" };
  document.getElementById("fl-tabs").innerHTML = Object.entries(TABS).map(([k, v]) =>
    `<button class="tab${k === view ? " on" : ""}" data-v="${k}">${v}</button>`).join("");
  document.querySelectorAll(".tab").forEach((b) => b.onclick = () => {
    view = b.dataset.v;
    document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("on", x.dataset.v === view)); draw();
  });
  const svg = document.getElementById("fl-map"), tip = document.getElementById("fl-tip"), NS = "http://www.w3.org/2000/svg";
  svg.setAttribute("viewBox", `0 0 ${B.w} ${B.h}`);

  function draw() {
    OTHSCALE = 1; for (let i = 0; i < 30; i++) { const t = compute(); OTHSCALE *= OTHT / Math.max(t.sw.Other, .05); }
    const R = compute();
    // The reference build blends every ramp toward white because it is light-only.
    // In dark the same blend floats a white slab over the canvas, so the "empty"
    // end of each ramp follows the theme's panel instead. Ramp shape is unchanged.
    const dark = isDarkTheme();
    const BASE = dark ? [26, 26, 32] : [255, 255, 255];
    const TURNOUT_LO = dark ? [22, 22, 27] : [246, 242, 236];
    const TURNOUT_HI = dark ? [214, 224, 236] : [35, 45, 58];
    const vmax = Math.max(...Object.values(R.counties).map((c) => c.votes));
    let sLo = 100, sHi = 0;
    if (CAND.includes(view)) Object.values(R.counties).forEach((c) => { sLo = Math.min(sLo, c.p[view]); sHi = Math.max(sHi, c.p[view]); });
    svg.innerHTML = ""; const g = document.createElementNS(NS, "g");
    for (const k in B.geo) {
      const r = R.counties[k]; if (!r) continue;
      const p = document.createElementNS(NS, "path"); p.setAttribute("d", B.geo[k]); p.setAttribute("class", "cty");
      let fill;
      if (view === "margin") { const b0 = hx(CO[r.ld]); fill = rgb(mix(mix(BASE, b0, .22), b0, Math.min(1, r.mg / 22))); }
      else if (view === "votes") fill = rgb(mix(TURNOUT_LO, TURNOUT_HI, Math.pow(r.votes / vmax, .42)));
      else { const b0 = hx(CO[view]), t = sHi > sLo ? (r.p[view] - sLo) / (sHi - sLo) : .5; fill = rgb(mix(mix(BASE, b0, .12), b0, t)); }
      p.setAttribute("fill", fill);
      p.addEventListener("mousemove", (e) => {
        tip.innerHTML = `<div class="tn">${r.name}</div><div class="tr">${r.region}</div>` +
          ALL.map((x) => `<div class="tl"><span style="color:${CO[x]}">${LB[x]}</span><b>${r.p[x].toFixed(1)}%</b></div>`).join("") +
          `<div class="tf">${r.ld} +${r.mg.toFixed(1)} · ${fmt(r.votes)} votes</div>`;
        tip.style.opacity = 1; let x = e.clientX + 14, y = e.clientY + 14;
        if (x + 260 > innerWidth) x = e.clientX - 260; if (y + 190 > innerHeight) y = e.clientY - 190;
        tip.style.left = x + "px"; tip.style.top = y + "px";
      });
      p.addEventListener("mouseleave", () => tip.style.opacity = 0);
      p.addEventListener("click", () => {
        openCty = openCty === k ? null : k; drawTable(R);
        const el = document.getElementById("r_" + k); if (el) el.scrollIntoView({ block: "nearest" });
      });
      g.appendChild(p);
    }
    svg.appendChild(g);
    const ord = ALL.slice().sort((a, b) => R.sw[b] - R.sw[a]), mx = R.sw[ord[0]];
    let h = `<div class="card"><div class="ch"><div class="ct">Statewide</div><div class="cs">${fmt(R.total)} votes</div></div><div class="cb">
  <div class="stack">` + ord.map((c) => `<i style="width:${R.sw[c]}%;background:${CO[c]}"></i>`).join("") + `</div>`;
    ord.forEach((c) => {
      h += `<div class="res"><span class="rn">${NM[c]}</span>
  <span class="rp" style="color:${CO[c]}">${R.sw[c].toFixed(1)}<span style="font-size:10px">%</span></span></div>
  <div class="bar"><i style="width:${R.sw[c] / mx * 100}%;background:${CO[c]}"></i></div>
  <div class="rvv">${fmt(R.swv[c])} votes</div>`;
    });
    h += `<div class="note"><b>${ord[0]} +${(R.sw[ord[0]] - R.sw[ord[1]]).toFixed(1)}</b> over ${ord[1]}</div></div></div>`;
    const cnt = {}; Object.values(R.counties).forEach((c) => cnt[c.ld] = (cnt[c.ld] || 0) + 1);
    h += `<div class="card"><div class="ch"><div class="ct">Counties carried</div></div><div class="cb"><div class="leg">` +
      Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, v]) =>
        `<span><span class="sw" style="background:${CO[k]}"></span><b>${v}</b> ${LB[k]}</span>`).join("") + `</div></div></div>`;
    h += `<div class="card"><div class="ch"><div class="ct">Simulation</div><div class="cs">4,000 runs</div></div>
  <div class="cb"><button class="btn" id="runsim">Run simulation</button><div id="simout"></div></div></div>`;
    document.getElementById("fl-right").innerHTML = h;
    document.getElementById("runsim").onclick = () => runsim(R);
    drawTable(R);
  }
  function drawTable(R) {
    lastR = R;
    const COLS = [["name", "County", 0], ["ld", "Leader", 0], ["mg", "Marg", 1]]
      .concat(ALL.map((c) => [c, LB[c].slice(0, 4), 1])).concat([["votes", "Votes", 1]]);
    const val = (c, k) => ALL.includes(k) ? c.p[k] : (k === "name" ? c.name : k === "ld" ? c.ld : c[k]);
    const rows = Object.entries(R.counties).sort((a, b) => {
      const x = val(a[1], sortK), y = val(b[1], sortK);
      return typeof x === "string" ? sortDir * x.localeCompare(y) : sortDir * (x - y);
    });
    document.getElementById("fl-ctnote").textContent = rows.length + " counties";
    const wrap = document.getElementById("fl-ctwrap");
    if (wrap) wrap.style.maxHeight = expandAll ? "none" : "360px";
    const eb = document.getElementById("fl-expandAll");
    if (eb) { eb.textContent = expandAll ? "Collapse" : "Show all 67"; eb.classList.toggle("on", expandAll); }
    document.getElementById("fl-ctbl").innerHTML =
      "<thead><tr>" + COLS.map(([k, l, r]) =>
        `<th data-s="${k}" class="${sortK === k ? "sorted" : ""}" style="text-align:${r ? "right" : "left"}${k === "name" ? ";padding-left:14px" : ""}">${l}<span class="ar">${sortDir < 0 ? "▼" : "▲"}</span></th>`).join("") + "</tr></thead><tbody>" +
      rows.map(([k, c]) => {
        const open = openCty === k;
        let s2 = `<tr><td colspan="10"><div class="crow${open ? " open" : ""}" id="r_${k}" data-c="${k}">
    <span><span class="cname"><button class="cbtn${open ? " on" : ""}" tabindex="-1">${open ? "−" : "+"}</button>${c.name}</span></span>
    <span style="color:${CO[c.ld]}">${LB[c.ld]}</span>
    <span>+${c.mg.toFixed(1)}</span>` +
          ALL.map((x) => `<span>${c.p[x].toFixed(1)}</span>`).join("") +
          `<span>${fmt(c.votes)}</span></div></td></tr>`;
        if (open) {
          const top = ALL.slice().sort((a, b) => c.p[b] - c.p[a]), m = c.p[top[0]];
          s2 += `<tr><td colspan="10"><div class="cdet"><div class="dg">
     <div><div class="dk">Projected votes</div><div class="dv">${fmt(c.votes)}</div></div>
     <div><div class="dk">Leader</div><div class="dv" style="color:${CO[c.ld]}">${LB[c.ld]} +${c.mg.toFixed(1)}</div></div>
     <div><div class="dk">Under 40</div><div class="dv">${((c.age[0] + c.age[1]) * 100).toFixed(1)}%</div></div>
     <div><div class="dk">65 and over</div><div class="dv">${(c.age[4] * 100).toFixed(1)}%</div></div>
     <div><div class="dk">Interviews</div><div class="dv">${c.nobs}</div></div>
     <div><div class="dk">Region</div><div class="dv" style="font-size:11.5px">${c.region}</div></div></div>
     <div class="dbar">` + top.map((x) => `<div class="dbr"><span>${LB[x]}</span><b>${c.p[x].toFixed(1)}% · ${fmt(c.p[x] / 100 * c.votes)}</b></div>
      <div class="bar"><i style="width:${c.p[x] / m * 100}%;background:${CO[x]}"></i></div>`).join("") +
            `</div></div></td></tr>`;
        }
        return s2;
      }).join("") + "</tbody>";
    document.querySelectorAll(".ctbl th[data-s]").forEach((th) => th.onclick = () => {
      const k = th.dataset.s;
      if (sortK === k) sortDir *= -1; else { sortK = k; sortDir = (k === "name" || k === "ld") ? 1 : -1; }
      drawTable(lastR);
    });
    document.querySelectorAll(".crow").forEach((el) => el.onclick = () => {
      openCty = openCty === el.dataset.c ? null : el.dataset.c; drawTable(lastR);
    });
  }
  document.getElementById("fl-expandAll").onclick = () => { expandAll = !expandAll; if (lastR) drawTable(lastR); };

  let g2 = null;
  function gauss() {
    if (g2 !== null) { const v = g2; g2 = null; return v; }
    let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random();
    const r = Math.sqrt(-2 * Math.log(u)); g2 = r * Math.sin(2 * Math.PI * v); return r * Math.cos(2 * Math.PI * v);
  }
  function runsim(R) {
    const N = 4000, SD = 6, win = {}, marg = []; CAND.forEach((c) => win[c] = 0);
    for (let s = 0; s < N; s++) {
      const sh = {}; let tot = 0;
      CAND.forEach((c) => { sh[c] = Math.max(.5, R.sw[c] + gauss() * SD); tot += sh[c]; });
      const nr = (100 - R.sw.Other) / tot; CAND.forEach((c) => sh[c] *= nr);
      let b = null, bv = -1, sc = -1; CAND.forEach((c) => { if (sh[c] > bv) { sc = bv; b = c; bv = sh[c]; } else if (sh[c] > sc) sc = sh[c]; });
      win[b]++; marg.push(bv - sc);
    }
    const H = new Array(28).fill(0);
    marg.forEach((m) => { const i = Math.floor(m / 40 * 28); if (i >= 0 && i < 28) H[i]++; });
    const mh = Math.max(...H, 1), wo = CAND.slice().sort((a, b) => win[b] - win[a]);
    const med = marg.slice().sort((a, b) => a - b)[Math.floor(N / 2)];
    document.getElementById("simout").innerHTML =
      `<div style="margin-top:14px"><div class="simv" style="color:${CO[wo[0]]}">${(win[wo[0]] / N * 100).toFixed(1)}%</div>
   <div class="rvv" style="margin-top:5px">probability ${NM[wo[0]]} wins · median +${med.toFixed(1)}</div>
   <div class="hist">` + H.map((v) => `<i style="height:${v / mh * 100}%;background:${CO[wo[0]]}"></i>`).join("") +
      `</div><div class="hax"><span>tie</span><span>+40</span></div>
   <div class="note">` + wo.slice(1).map((c) => `${LB[c]} ${(win[c] / N * 100).toFixed(1)}%`).join(" · ") + `</div></div>`;
  }

  loadPreset("published");

  // Theme toggle re-render: refreshes candidate swatches (map, table, legend) live.
  const themeObserver = new MutationObserver(() => render());
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  return () => themeObserver.disconnect();
}
