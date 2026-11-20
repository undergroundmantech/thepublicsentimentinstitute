// 2028 county engine for the site. This is the On Point 2028 dashboard's Build a ticket engine and its primary field
// shares, unchanged, run on the same datasets (public/forecast/2028/x/engine.json). Two additions, marked "site": Alaska and
// Connecticut spread from their state rows to their counties, and county win chances counted in the same simulations.
// The primary is the v45 official run: every candidate in every state at once, no dropouts.
/* eslint-disable */
export function createEngine(DATA, AKCT) {
  const op28 = {}; let PARAMS = {};
  const dash = { data: (id) => (DATA[id] ? { status: 'ok', data: DATA[id] } : { status: 'missing' }), params: () => PARAMS };

// primary simulator: county recalibration and a calendar simulation, run in the browser
(() => {
  const N = 2000, OTHER = { D: 0.11, R: 0.09 };
  const P = () => Object.assign({ pparty: 'D', pout: [], ptgt: '' }, dash.params());
  let memo = { key: '', out: null };
  function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  function gauss(r) { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
  op28.parseTgt = (s) => Object.fromEntries((s || '').split(';').filter(Boolean).map((x) => { const i = x.lastIndexOf('='); return [decodeURIComponent(x.slice(0, i)), Number(x.slice(i + 1))]; }));
  op28.primReady = () => ['prim_model', 'prim_cands', 'prim_calendar'].every((id) => dash.data(id).status === 'ok');
  // state primary polls: move each polled state's county shares toward the poll average, at n_polls / (n_polls + 19.19)
  op28.applyPrimPolls = (party, names, pm, sh, V) => {
    const d = dash.data('prim_polls'); if (!d || d.status !== 'ok') return {};
    const K = names.length, nC = pm.length; const rows = d.data.filter((r) => r.party === party && names.includes(r.name)); const by = {};
    for (const r of rows) (by[r.st] || (by[r.st] = [])).push(r);
    const fx = {};
    for (const [st, rs] of Object.entries(by)) {
      const idx = []; for (let i = 0; i < nC; i++) if (pm[i].st === st) idx.push(i); if (!idx.length) continue;
      const S = new Float64Array(K); let tv = 0; for (const i of idx) { tv += V[i]; for (let j = 0; j < K; j++) S[j] += sh[i * K + j] * V[i]; } for (let j = 0; j < K; j++) S[j] /= Math.max(1, tv);
      const js = rs.map((r) => names.indexOf(r.name)); const ps = rs.map((r) => Number(r.poll_share)); const psum = ps.reduce((a, b) => a + b, 0) || 1;
      let msum = 0; for (const j of js) msum += S[j]; const w = Number(rs[0].weight);
      const f = new Float64Array(K).fill(1); js.forEach((j, q) => { const tgt = (1 - w) * S[j] + w * (ps[q] / psum) * msum; f[j] = S[j] > 0 ? tgt / S[j] : 1; });
      for (const i of idx) { let s = 0; for (let j = 0; j < K; j++) { sh[i * K + j] *= f[j]; s += sh[i * K + j]; } for (let j = 0; j < K; j++) sh[i * K + j] /= s; }
      fx[st] = { w, n: Number(rs[0].n_polls) };
    }
    return fx;
  };
  // the primary field's county shares, recalibrated to the chosen targets, for the general election engine
  const pmemo = {};
  // v48f: candidates marked withdrawn in prim_cands are out of the primary field
  op28.withdrawn = (party) => { const d = dash.data('prim_cands'); return d && d.status === 'ok' ? d.data.filter((r) => r.party === party && Number(r.withdrawn) === 1).map((r) => r.name) : []; };
  op28.primShares = (party) => {
    if (!['prim_model', 'prim_cands'].every((id) => dash.data(id).status === 'ok')) return null;
    const p = P(); const out0 = [].concat(p.pout || []); const key = JSON.stringify([party, out0, p.ptgt, dash.data('prim_polls').status]);
    if (pmemo[party] && pmemo[party].key === key) return pmemo[party].out;
    const pm = dash.data('prim_model').data, pc = dash.data('prim_cands').data.filter((r) => r.party === party && !out0.includes(r.name));
    const tg = op28.parseTgt(p.ptgt); const names = pc.map((r) => r.name); const K = names.length, nC = pm.length;
    if (K < 1) return null;
    const L = new Float64Array(nC * K), V = new Float64Array(nC);
    for (let i = 0; i < nC; i++) { const r = pm[i]; V[i] = Number(party === 'D' ? r.d_votes : r.r_votes); for (let j = 0; j < K; j++) L[i * K + j] = Number(r[party + '|' + names[j]]); }
    const t0 = pc.map((c) => Math.max(0.1, isFinite(tg[c.name]) ? tg[c.name] : Number(c.target))); const ts = t0.reduce((a, b) => a + b, 0); const tgt = t0.map((x) => x / ts);
    const b = new Float64Array(K), sh = new Float64Array(nC * K), W = V.reduce((a, x) => a + x, 0);
    for (let it = 0; it < 30; it++) {
      const nat = new Float64Array(K);
      for (let i = 0; i < nC; i++) { let mx = -1e9; for (let j = 0; j < K; j++) mx = Math.max(mx, L[i * K + j] + b[j]); let s = 0;
        for (let j = 0; j < K; j++) { const e = Math.exp(L[i * K + j] + b[j] - mx); sh[i * K + j] = e; s += e; }
        for (let j = 0; j < K; j++) { sh[i * K + j] /= s; nat[j] += sh[i * K + j] * V[i]; } }
      for (let j = 0; j < K; j++) b[j] += Math.log(tgt[j] / Math.max(1e-9, nat[j] / W));
    }
    op28.applyPrimPolls(party, names, pm, sh, V);
    const sim = pc.map((c, j) => { const m = JSON.parse(c.sim || '{}'); return names.map((o, k) => (k === j ? 1 : (1 + (m[o] ?? 0)) / 2)); });
    let F = 0; for (let j = 1; j < K; j++) if (tgt[j] > tgt[F]) F = j;
    const out = { names, tgt, sh, V, sim, F, cidx: new Map(pm.map((r, i) => [r.fips, i])), hyp: Object.fromEntries(pc.map((c) => [c.name, Number(c.hypothetical) === 1])) };
    pmemo[party] = { key, out }; return out;
  };
  // v45 official primary: the whole field in every state at once. No one drops out and no state waits on another: every
  // candidate the reader keeps in is on every state's ballot, and a candidate taken out has their county voters move to the
  // rest of the field by how alike the two candidates' county support is. 4,000 runs with the 2026 model's error shape: a
  // national error per candidate with fat tails, a regional error per candidate and a state error, plus turnout error.
  op28.prim = () => {
    if (!op28.primReady()) return null;
    const N = 4000;
    const p = P(); const out0 = [].concat(p.pout || [], op28.withdrawn(p.pparty === 'R' ? 'R' : 'D')); const key = JSON.stringify(['v45', p.pparty, out0, p.ptgt, dash.data('prim_polls').status]);
    if (memo.key === key) return memo.out;
    const party = p.pparty === 'R' ? 'R' : 'D';
    const pm = dash.data('prim_model').data, pc = dash.data('prim_cands').data.filter((r) => r.party === party), cal = dash.data('prim_calendar').data.filter((r) => r.party === party);
    const tg = op28.parseTgt(p.ptgt);
    const ALL = pc.map((r) => r.name); const KA = ALL.length, nC = pm.length;
    const act = ALL.map((n) => !out0.includes(n)); const names = ALL.filter((n, j) => act[j]); const K = names.length;
    if (K < 1) return null;
    // county support for the whole field, recalibrated so the vote weighted national shares match the targets, then state polls
    const L = new Float64Array(nC * KA), V = new Float64Array(nC);
    for (let i = 0; i < nC; i++) { const r = pm[i]; V[i] = Number(party === 'D' ? r.d_votes : r.r_votes); for (let j = 0; j < KA; j++) L[i * KA + j] = Number(r[party + '|' + ALL[j]]); }
    const t0 = ALL.map((n) => { const c = pc.find((x) => x.name === n); return Math.max(0.1, isFinite(tg[n]) ? tg[n] : Number(c.target)); });
    const ts = t0.reduce((a, b) => a + b, 0); const tgt = t0.map((x) => x / ts);
    const b = new Float64Array(KA); const sa = new Float64Array(nC * KA); const W = V.reduce((a, x) => a + x, 0);
    for (let it = 0; it < 30; it++) {
      const nat = new Float64Array(KA);
      for (let i = 0; i < nC; i++) { let mx = -1e9; for (let j = 0; j < KA; j++) mx = Math.max(mx, L[i * KA + j] + b[j]); let s = 0;
        for (let j = 0; j < KA; j++) { const e = Math.exp(L[i * KA + j] + b[j] - mx); sa[i * KA + j] = e; s += e; }
        for (let j = 0; j < KA; j++) { sa[i * KA + j] /= s; nat[j] += sa[i * KA + j] * V[i]; } }
      for (let j = 0; j < KA; j++) b[j] += Math.log(tgt[j] / Math.max(1e-12, nat[j] / W));
    }
    const pollFx = op28.applyPrimPolls(party, ALL, pm, sa, V);
    // a candidate taken out: their voters in each county go to the candidates still in, by similarity times support
    const simA = ALL.map((n) => { const c = pc.find((x) => x.name === n); const m = JSON.parse(c.sim || '{}'); return ALL.map((o) => (o === n ? 0 : Math.exp(1.5 * (m[o] ?? 0)))); });
    const sh = new Float64Array(nC * K); const ai = ALL.map((n, j) => j).filter((j) => act[j]);
    for (let i = 0; i < nC; i++) {
      const row = new Float64Array(KA); for (let j = 0; j < KA; j++) row[j] = act[j] ? sa[i * KA + j] : 0;
      for (let d = 0; d < KA; d++) if (!act[d]) { let z = 0; for (const j of ai) z += simA[d][j] * sa[i * KA + j]; if (z > 0) for (const j of ai) row[j] += sa[i * KA + d] * simA[d][j] * sa[i * KA + j] / z; }
      let s = 0; for (const j of ai) s += row[j]; ai.forEach((j, k) => { sh[i * K + k] = row[j] / Math.max(1e-12, s); });
    }
    // state base shares and votes
    const sts = [...new Set(pm.map((r) => r.st))]; const si = Object.fromEntries(sts.map((s, k) => [s, k])); const nS = sts.length;
    const S = new Float64Array(nS * K), SV = new Float64Array(nS);
    for (let i = 0; i < nC; i++) { const k = si[pm[i].st]; SV[k] += V[i]; for (let j = 0; j < K; j++) S[k * K + j] += sh[i * K + j] * V[i]; }
    for (let k = 0; k < nS; k++) for (let j = 0; j < K; j++) S[k * K + j] /= Math.max(1, SV[k]);
    const win = Object.fromEntries(cal.map((r) => [r.st, Number(r.window)])); const del = Object.fromEntries(cal.map((r) => [r.st, Number(r.delegates)]));
    const regOf = Object.fromEntries(cal.map((r) => [r.st, r.region || 'x'])); const regs = [...new Set(sts.map((s) => regOf[s] || 'x'))]; const ri = sts.map((s) => regs.indexOf(regOf[s] || 'x'));
    const rr = rng(4280 + K);
    const nom = new Float64Array(K), votes = new Float64Array(K), stWin = new Float64Array(nS * K), stShare = new Float64Array(nS * K), stVotes = new Float64Array(nS * K), stTot = new Float64Array(nS);
    const eta = new Float64Array(K), reg = new Float64Array(regs.length * K), v = new Float64Array(K);
    for (let s = 0; s < N; s++) {
      for (let j = 0; j < K; j++) { let chi = 0; for (let q = 0; q < 6; q++) { const z = gauss(rr); chi += z * z; } eta[j] = 0.35 * gauss(rr) / Math.sqrt(chi / 6); }
      for (let g = 0; g < reg.length; g++) reg[g] = 0.2 * gauss(rr);
      const dl = new Float64Array(K);
      for (let k = 0; k < nS; k++) {
        const g = ri[k]; let tot = 0;
        for (let j = 0; j < K; j++) { v[j] = S[k * K + j] * Math.exp(eta[j] + reg[g * K + j] + 0.15 * gauss(rr)); tot += v[j]; }
        const tf = SV[k] * Math.exp(0.08 * gauss(rr)); let best = 0;
        for (let j = 0; j < K; j++) { v[j] /= tot; if (v[j] > v[best]) best = j; stShare[k * K + j] += v[j]; stVotes[k * K + j] += v[j] * tf; votes[j] += v[j] * tf; }
        stTot[k] += tf; stWin[k * K + best]++;
        const dg = del[sts[k]] ?? 3;
        if (party === 'D') { let q = 0; for (let j = 0; j < K; j++) if (v[j] >= 0.15) q += v[j]; if (q > 0) { for (let j = 0; j < K; j++) if (v[j] >= 0.15) dl[j] += dg * v[j] / q; } else dl[best] += dg; }
        else if (v[best] >= 0.5) dl[best] += dg; else { let q = 0; for (let j = 0; j < K; j++) if (v[j] >= 0.2) q += v[j]; if (q > 0) { for (let j = 0; j < K; j++) if (v[j] >= 0.2) dl[j] += dg * v[j] / q; } else dl[best] += dg; }
      }
      let bj = 0; for (let j = 0; j < K; j++) if (dl[j] > dl[bj]) bj = j; nom[bj]++;
    }
    const states = {};
    // a state's share is its average across the runs, votes at the average turnout
    sts.forEach((s, k) => { const share = {}, wins = {}, vv = {};
      names.forEach((n, j) => { share[n] = (stShare[k * K + j] / N) * (1 - OTHER[party]); wins[n] = stWin[k * K + j] / N; vv[n] = share[n] * SV[k]; });
      states[s] = { share, win: wins, votes: vv, total: SV[k], window: win[s] ?? 4, region: regOf[s] }; });
    // counties: each candidate's county share scaled by the state's average over its base share, then renormalized
    const csh = new Float64Array(nC * K);
    for (let i = 0; i < nC; i++) { const k = si[pm[i].st]; const st = states[sts[k]]; let z = 0;
      for (let j = 0; j < K; j++) { const b0 = S[k * K + j]; const t = st.share[names[j]] / (1 - OTHER[party]); const x = b0 > 1e-9 ? sh[i * K + j] * t / b0 : 0; csh[i * K + j] = x; z += x; }
      if (z > 0) for (let j = 0; j < K; j++) csh[i * K + j] /= z; else for (let j = 0; j < K; j++) csh[i * K + j] = sh[i * K + j]; }
    const county = new Map(); for (let i = 0; i < nC; i++) { const arr = names.map((n, j) => [n, csh[i * K + j] * (1 - OTHER[party])]).sort((a, c) => c[1] - a[1]); county.set(pm[i].fips, { top: arr.slice(0, 3), votes: V[i] }); }
    const out = { party, names, all: ALL, out: out0, tgt, pollFx, full: true, N, nom: Object.fromEntries(names.map((n, j) => [n, nom[j] / N])),
      votes: Object.fromEntries(names.map((n, j) => [n, (votes[j] / N) * (1 - OTHER[party])])),
      states, county, csh, cidx: new Map(pm.map((r, i) => [r.fips, i])), cvotes: V, colors: Object.fromEntries(pc.map((c) => [c.name, c.color])), hyp: Object.fromEntries(pc.map((c) => [c.name, Number(c.hypothetical) === 1])) };
    memo = { key, out };
    return out;
  };
})();

// ticket builder: the live dashboard's engine, Nov 18 2026 (v50b), with any number of third party tickets, up to four,
// each with its modeled share from third_model, its county spread from third_county and the overlap from third_pairs. Two site
// additions are marked "site": Alaska and Connecticut counties, and county win chances in the same runs.
(() => {
const N = 4000;
let TRAITS = ['college', 'hisp', 'black', 'young', 'old', 'rural', 'evang'];
const basisTraits = (cm) => { const k = cm && cm.length ? Object.keys(cm[0]).filter((c) => /^z_b\d+$/.test(c)).map((c) => c.slice(2)) : []; return k.length ? k : TRAITS; };
const P = () => Object.assign({ dp: 'Generic Democrat', dvp: '', rp: 'Vance', rvp: '', tp: '', tps: null, tx: '', tname: '', thome: '', tlanes: '' }, dash.params());
op28.LANES = { 'Right populist': { af: 1, pop: 0.8, anti: 0.5, leanR: 0.4 }, 'Libertarian': { lib: 1, anti: 0.4, leanR: 0.3 },
'Centrist': { mod: 1, sub: 0.6, inst: 0.3, leanD: 0.3, leanR: 0.3 }, 'Progressive left': { prog: 1, leanD: 0.4, anti: 0.2 },
'Anti establishment': { anti: 1, none: 0.8, mod: 0.3 }, 'Working class': { union: 1, pop: 0.8, mod: 0.3 } };
op28.parseLanes = (s) => { const o = {}; (s || '').split(';').filter(Boolean).forEach((x) => { const i = x.lastIndexOf('='); o[decodeURIComponent(x.slice(0, i))] = Number(x.slice(i + 1)); }); return o; };
op28.customCand = (p) => {
const ln = op28.parseLanes(p.tlanes); const tot = Object.values(ln).reduce((a, b) => a + (b > 0 ? b : 0), 0) || 0;
const draw = {}; const use = tot > 0 ? ln : { 'Anti establishment': 50, 'Centrist': 50 }; const s = tot > 0 ? tot : 100;
for (const [lane, wgt] of Object.entries(use)) for (const [ty, v] of Object.entries(op28.LANES[lane] || {})) draw[ty] = (draw[ty] || 0) + v * (wgt / s);
return { name: p.tname || 'Custom independent', party: 'X', draw: JSON.stringify(draw), home: JSON.stringify(p.thome ? { [p.thome]: 3 } : {}), third_default: 5, lane: 'Custom independent built from lanes.' };
};
op28.parseTickets = (p) => {
const raw = (p.tx || '').split(';').filter(Boolean).map((x) => { const [k, v, s] = x.split('~'); return { key: decodeURIComponent(k || ''), vp: decodeURIComponent(v || ''), share: s === '' || s == null ? null : Number(s) }; });
if (!raw.length && p.tp) raw.push({ key: p.tp, vp: '', share: p.tps == null || p.tps === '' ? null : Number(p.tps) });
return raw.filter((t) => t.key).slice(0, 4);
};
op28.writeTickets = (list) => list.map((t) => encodeURIComponent(t.key) + '~' + encodeURIComponent(t.vp || '') + '~' + (t.share == null || !isFinite(t.share) ? '' : t.share)).join(';');
op28.thirdRow = (key) => { const d = dash.data('third_model'); return d && d.status === 'ok' ? d.data.find((r) => r.key === key) || null : null; };
// site: the site's Tilt ratings are purple, so the dashboard's purple first ticket moves to the end of the order
op28.TKC = ['#d98a1c', '#13a39a', '#c23f8e', '#7b4fd6'];
const ME1 = 'ME-1', ME2 = 'ME-2', NE2 = 'NE-2';
let memo = { key: '', out: null };
const cand = (cands, party, name) => cands.find((c) => c.party === party && c.name === name);
const json = (s) => { try { return JSON.parse(s); } catch (e) { return {}; } };
const homeOf = (c) => Object.keys(json(c.home))[0] || null;
function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function gauss(r) { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
const REG8 = {"AK":7,"AL":0,"AR":0,"AZ":6,"CA":7,"CO":7,"CT":4,"DC":3,"DE":3,"FL":5,"GA":5,"HI":7,"IA":2,"ID":7,"IL":1,"IN":1,"KS":2,"KY":0,"LA":0,"MA":4,"MD":3,"ME":4,"MI":1,"MN":1,"MO":2,"MS":0,"MT":7,"NC":5,"ND":2,"NE":2,"NH":4,"NJ":3,"NM":6,"NV":7,"NY":3,"OH":1,"OK":2,"OR":7,"PA":3,"RI":4,"SC":5,"SD":2,"TN":0,"TX":6,"UT":7,"VA":5,"VT":4,"WA":7,"WI":1,"WV":0,"WY":7};
function tdraw(r) { let c = 0; for (let k = 0; k < 5; k++) { const z = gauss(r); c += z * z; } return gauss(r) / Math.sqrt(c / 5) / Math.sqrt(5 / 3); }
op28.ticketReady = () => ['county_model', 'cands', 'types', 'states', 'state_extra'].every((id) => dash.data(id).status === 'ok');
const GP0 = { grid_g: 0.5, grid_L: 20, total28: 3300, state_frac: 0.95, w24: 0.45, wcomp: 0.35, w26: 0.2, comp_sd: 3.5, dx_a: 0.03, dx_b: 0.14, dx_pow: 1.5, dn_a: 0.04, dn_b: 0.10, third_of_n: 0.5, f_cap: 0.8, kappa_R: 0.134, kappa_D: 0.041, deficit_cap: 30, w_polled: 0.5, g0: 0.0165, hist_blend: 0.5, named_third_keep: 0.6, prim_pull: 0.35, fn_a: 3, fn_l: 30 };
op28.params = () => { const d = dash.data('general_params'); const o = Object.assign({}, GP0); if (d && d.status === 'ok') for (const r of d.data) if (isFinite(Number(r.value))) o[r.key] = Number(r.value); return o; };
op28.primTerm = (party, name, GP) => {
const S = op28.primShares ? op28.primShares(party) : null; if (!S) return null; const N = S.names.indexOf(name); if (N < 0) return null;
const F = S.F, K = S.names.length; const w = S.hyp[name] ? 1 : GP.w_polled;
const dxv = new Float64Array(K), dnv = new Float64Array(K);
for (let j = 0; j < K; j++) {
const sN = S.sim[j][N], sF = S.sim[j][F];
dxv[j] = w * GP.dx_b * (Math.pow(1 - sN, GP.dx_pow) - Math.pow(1 - sF, GP.dx_pow));
dnv[j] = w * GP.dn_b * (sF - sN);
}
const deficit = Math.min(GP.deficit_cap, Math.max(0, (S.tgt[F] - S.tgt[N]) * 100));
const quality = w * (party === 'R' ? GP.kappa_R : GP.kappa_D) * deficit;
return { S, dxv, dnv, quality, share: S.tgt[N], front: S.names[F], frontShare: S.tgt[F], polled: !S.hyp[name] };
};
op28.ticket = () => {
if (!op28.ticketReady()) return null;
const p = P(); const key = JSON.stringify([p.dp, p.dvp, p.rp, p.rvp, p.tp, p.tps, p.tx, p.dsh, p.rsh, (dash.data('third_model') || {}).status, (dash.data('third_county') || {}).status, (dash.data('third_pairs') || {}).status, p.tname, p.thome, p.tlanes, p.pout, p.ptgt, dash.data('prim_model').status, dash.data('general_params').status, dash.data('spending').status, (dash.data('districts') || {}).status, (dash.data('cd_xwalk') || {}).status]);
if (memo.key === key) return memo.out;
const GP = op28.params();
const cm = dash.data('county_model').data, cands = dash.data('cands').data, types = dash.data('types').data, st = dash.data('states').data, ex = dash.data('state_extra').data;
const D = cand(cands, 'D', p.dp) || cand(cands, 'D', 'Generic Democrat'), R = cand(cands, 'R', p.rp) || cand(cands, 'R', 'Vance');
const DV = p.dvp ? cand(cands, 'D', p.dvp) : null, RV = p.rvp ? cand(cands, 'R', p.rvp) : null;
const TL = op28.parseTickets(p); const T = TL.some((t) => t.key !== 'D|' + D.name && t.key !== 'R|' + R.name) ? true : null;
const ptD = op28.primTerm('D', D.name, GP), ptR = op28.primTerm('R', R.name, GP);
TRAITS = basisTraits(cm);
const g = (c) => (c ? TRAITS.map((t) => Number(c['g_' + t]) || 0) : TRAITS.map(() => 0));
const gD = g(D), gR = g(R), gDV = g(DV), gRV = g(RV);
const CCd = dash.data('cand_county'); const CC = CCd && CCd.status === 'ok' && CCd.data.length ? CCd.data : null;
const ccIx = CC ? new Map(CC.map((r, k) => [r.fips, k])) : null;
const ccKey = (c, party) => (c && CC && Object.prototype.hasOwnProperty.call(CC[0], party + '|' + c.name) ? party + '|' + c.name : null);
const kD = ccKey(D, 'D'), kR = ccKey(R, 'R'), kDV = ccKey(DV, 'D'), kRV = ccKey(RV, 'R');
const n = cm.length, two = new Float64Array(n), tot = new Float64Array(n), othS = new Float64Array(n);
// site v51: who shows up depends on the matchup. Every county's voter groups (party, race, age, college and 2024 vote)
// turn out more or less for each nominee than for a generic one, from the respondent model and anchored to the
// dashboard's matchup turnout; running mates count a quarter. The extra or missing voters keep the county's margin.
const TOd = dash.data('turnout_cty'), TCf = dash.data('turnout_coef');
const TO = TOd && TOd.status === 'ok' ? new Map(TOd.data.map((r) => [r.fips, r])) : new Map();
const TCo = TCf && TCf.status === 'ok' ? new Map(TCf.data.map((r) => [r.key, r])) : new Map();
const TDIM = ['pR', 'pI', 'rB', 'rH', 'rA', 'a3044', 'a4564', 'a65', 'col', 'nv24'];
const tco = (c, party, w) => { const r = c ? TCo.get(party + '|' + c.name) : null; return r ? [Number(r.b0) || 0, ...TDIM.map((k) => Number(r['b_' + k]) || 0)].map((x) => x * w) : null; };
const TCV = [tco(D, 'D', 1), tco(R, 'R', 1), tco(DV, 'D', 0.25), tco(RV, 'R', 0.25)].filter(Boolean);
const dT = (key) => { const r = TO.get(key); if (!r || !TCV.length) return 0; let x = 0; const v = [1, ...TDIM.map((k) => Number(r[k]) || 0)]; for (const b of TCV) for (let j = 0; j < v.length; j++) x += b[j] * v[j]; return x; };
const turnAdd = (key, base) => { const r = TO.get(key); if (!r) return 0; const E = Number(r.elig) || 0; if (!(E > 0)) return 0; const add = E * dT(key) / 100; return Math.max(-0.5 * base, Math.min(0.97 * E - base, add)); };
const lpOf = (key) => { const r = TO.get(key); const v = r ? Number(r.lp) : 1; return isFinite(v) && v > 0 ? v : 1; };
let baseVotes = 0, turnVotes = 0;
const xD = new Float64Array(n), xR = new Float64Array(n), xI = new Float64Array(n);
const ISS = ['col', 'epstein', 'iran', 'immig', 'socialism', 'trans'];
const ia = (c, f) => (c ? ISS.map((k) => f * (Number(c['a_' + k]) || 0)) : ISS.map(() => 0));
const aI = ISS.map((k, j) => ia(D, 1)[j] + ia(R, 1)[j] + ia(DV, 0.25)[j] + ia(RV, 0.25)[j]);
const LI = Number(GP.lam_issue) || 0;
let W = 0, mD = 0, mR = 0, mI = 0;
for (let i = 0; i < n; i++) {
const c = cm[i]; { const b0 = Number(c.total); const ad = turnAdd(c.fips, b0); tot[i] = b0 + ad; baseVotes += b0; turnVotes += ad; } two[i] = tot[i] * (1 - Number(c.other_share));
const prop = isFinite(Number(c.tp_prop)) && c.tp_prop !== '' ? Number(c.tp_prop) : 1;
othS[i] = Math.min(0.2, Math.max(0.002, GP.hist_blend * Number(c.other_share) + (1 - GP.hist_blend) * GP.g0 * prop)) * (T ? GP.named_third_keep : 1);
let aD = 0, aDV = 0, bR = 0, bRV = 0;
for (let k = 0; k < TRAITS.length; k++) { const z = Number(c['z_' + TRAITS[k]]); aD += gD[k] * z; aDV += gDV[k] * z; bR += gR[k] * z; bRV += gRV[k] * z; }
const cr = ccIx && ccIx.has(c.fips) ? CC[ccIx.get(c.fips)] : null;
if (cr) { if (kD) aD = Number(cr[kD]) || 0; if (kDV) aDV = Number(cr[kDV]) || 0; if (kR) bR = Number(cr[kR]) || 0; if (kRV) bRV = Number(cr[kRV]) || 0; }
const a = aD + 0.25 * aDV, b = bR + 0.25 * bRV;
let ii = 0; for (let k = 0; k < ISS.length; k++) ii += aI[k] * (Number(c['iss_' + ISS[k]]) || 0);
xD[i] = a; xR[i] = b; xI[i] = ii; W += two[i]; mD += a * two[i]; mR += b * two[i]; mI += ii * two[i];
}
mD /= W; mR /= W; mI /= W;
const hD = json(D.home), hR = json(R.home), vD = DV ? homeOf(DV) : null, vR = RV ? homeOf(RV) : null;
const pw = GP.prim_w == null ? 1 : Number(GP.prim_w);
const pD = json(D.prim || '{}'), pR = json(R.prim || '{}'); const pr = (s) => { const b = String(s).split('-')[0]; return pw * ((pD[b] || 0) + (pR[b] || 0)); };
const EL = new Float64Array(n); { let a = 0, b = 0; for (let i = 0; i < n; i++) { const v = Number(cm[i].el); EL[i] = isFinite(v) && v > 0 ? v : 1; a += EL[i] * tot[i]; b += tot[i]; } for (let i = 0; i < n; i++) EL[i] *= a > 0 ? b / a : 1; }
const byState = {}; for (let i = 0; i < n; i++) (byState[cm[i].st] || (byState[cm[i].st] = [])).push(i);
const fipsIx = new Map(cm.map((c, i) => [c.fips, i]));
const FN_A = GP.fn_a == null ? 3 : Number(GP.fn_a), FN_L = GP.fn_l == null ? 30 : Number(GP.fn_l);
const HO = new Float64Array(n), PRC = new Float64Array(n);
const spread = (C, amp) => {
if (!C) return; const hc = json(C.home_cty || '{}');
for (const [s, v] of Object.entries(amp)) { const ix = byState[s]; if (!ix || !v) continue; const h = hc[s] != null ? fipsIx.get(hc[s]) : undefined;
let sw = 0, sv = 0; const ww = ix.map((i) => { let w = EL[i]; if (h != null) { const dd = Math.hypot((Number(cm[i].cx) || 0) - (Number(cm[h].cx) || 0), (Number(cm[i].cy) || 0) - (Number(cm[h].cy) || 0)); w *= 1 + FN_A * Math.exp(-dd / FN_L); } sw += w * tot[i]; sv += tot[i]; return w; });
ix.forEach((i, k) => { HO[i] += v * ww[k] * sv / sw; }); } };
spread(D, hD); spread(R, hR);
if (DV && vD) spread(DV, { [vD]: -1.5 }); if (RV && vR) spread(RV, { [vR]: 1.5 });
const primSpread = (pt, Cn, pj) => {
const S = pt ? pt.S : null; const j = S ? S.names.indexOf(Cn.name) : -1; const K = S ? S.names.length : 0;
for (const [s, v0] of Object.entries(pj)) { const v = pw * Number(v0); const ix = byState[s]; if (!ix || !v) continue;
const sh = ix.map((i) => { if (j < 0) return NaN; const ii = S.cidx.get(cm[i].fips); return ii == null ? NaN : S.sh[ii * K + j]; });
let a = 0, b = 0; ix.forEach((i, k) => { if (isFinite(sh[k])) { a += sh[k] * tot[i]; b += tot[i]; } }); const m = b > 0 && a > 0 ? a / b : 1;
let sw = 0, sv = 0; const ww = ix.map((i, k) => { const r = isFinite(sh[k]) ? Math.max(0.25, Math.min(4, sh[k] / m)) : 1; const w = EL[i] * Math.sqrt(r); sw += w * tot[i]; sv += tot[i]; return w; });
ix.forEach((i, k) => { PRC[i] += v * ww[k] * sv / sw; }); } };
primSpread(ptD, D, pD); primSpread(ptR, R, pR);
const qual = (ptR ? -ptR.quality : 0) + (ptD ? ptD.quality : 0);
const PAd = dash.data('pair_adj'); const PA = PAd && PAd.status === 'ok' ? PAd.data : []; const pa = PA.find((r) => r.dem === D.name && r.rep === R.name);
const pairAdj = pa ? Number(pa.adj) || 0 : 0;
const natPart = Number(D.nat) + Number(R.nat) + qual + pairAdj;
const SPr = dash.data('spending'); const spRows = SPr && SPr.status === 'ok' ? SPr.data : [];
const damp = {}; const spend = {}; let tip = null;
if (spRows.length) {
const pre = {}; const addp = (s, m, w) => { const a = pre[s] || (pre[s] = [0, 0]); a[0] += m * w; a[1] += w; };
for (let i = 0; i < cm.length; i++) { const c = cm[i]; const w = Number(c.total); const m = Number(c.base_margin) + natPart * Number(c.damp0 || 1) + (hD[c.st] || 0) + (hR[c.st] || 0) + pr(c.st);
addp(c.st, m, w); if (Number(c.ne2) > 0) addp('NE-2', m, w * Number(c.ne2)); if (c.st === 'ME') addp('ME-2', m, w * (1 - Number(c.me1))); }
for (const e of ex) addp(e.st, Number(e.base_margin) + natPart, 1);
const pm = (s) => (pre[s] ? pre[s][0] / pre[s][1] : NaN);
const full = spRows.filter((r) => isFinite(pm(r.st))).sort((a, b) => pm(a.st) - pm(b.st)); let cum = 0;
for (const r of full) { cum += Number(r.ev); if (cum >= 270) { tip = r.st; break; } }
const mt = tip ? pm(tip) : 0; let cs = 0; const comp = {};
for (const r of spRows) { const unit = r.st === 'NE' ? 'NE-2' : r.st === 'ME' ? 'ME-2' : r.st; const mu = pm(unit); const evw = r.st === 'NE' || r.st === 'ME' ? 1.5 : Number(r.ev);
comp[r.st] = isFinite(mu) ? evw * Math.exp(-0.5 * ((mu - mt) / GP.comp_sd) ** 2) : 0; cs += comp[r.st]; }
for (const r of spRows) { const sh = GP.w24 * Number(r.share24) + GP.wcomp * (cs > 0 ? comp[r.st] / cs : 0) + GP.w26 * Number(r.share26);
const dol = GP.total28 * GP.state_frac * sh; const pv = dol * 1e6 / Math.max(1, Number(r.two_party_votes)); const sat = 1 - Math.exp(-pv / GP.grid_L);
damp[r.st] = 1 - GP.grid_g * sat; spend[r.st] = { dollars: dol, perVoter: pv, saturation: sat, damp: damp[r.st], share: sh, y24: Number(r.p24), y26: Number(r.m26_2wk), y20: Number(r.p20) }; }
}
const dmaDamp = {};
{ const DA = dash.data('dma_alloc'); if (DA && DA.status === 'ok' && Object.keys(spend).length) { const dd = {}, vv = {};
for (const r of DA.data) { const sp = spend[r.st]; if (!sp) continue; dd[r.dma] = (dd[r.dma] || 0) + sp.dollars * Number(r.share); vv[r.dma] = Number(r.votes); }
for (const k of Object.keys(dd)) { const pv = dd[k] * 1e6 / Math.max(1, vv[k]); dmaDamp[k] = 1 - GP.grid_g * (1 - Math.exp(-pv / GP.grid_L)); } } }
const dmp = (s, i) => (i != null && cm[i] && cm[i].dma && dmaDamp[cm[i].dma] != null ? dmaDamp[cm[i].dma] : (damp[String(s).split('-')[0]] ?? 1));
const eff = (s, i) => {
if (i == null) { let e = natPart * dmp(s, i) + (hD[s] || 0) + (hR[s] || 0) + pr(s); if (vD === s) e -= 1.5; if (vR === s) e += 1.5; return e; }
return natPart * dmp(s, i) * EL[i] + HO[i] + PRC[i] - (xD[i] - mD) + (xR[i] - mR) - LI * (xI[i] - mI);
};
const tsplit = Object.fromEntries(types.map((t) => [t.type, Number(t.d_share)]));
const TCd = dash.data('third_county'); const TCc = TCd && TCd.status === 'ok' && TCd.data.length ? TCd.data : null;
const tcIx = TCc ? new Map(TCc.map((r, k) => [r.fips, k])) : null;
const TPd = dash.data('third_pairs'); const TPr = TPd && TPd.status === 'ok' ? new Map(TPd.data.map((r) => [r.key, r])) : new Map();
let totAll = 0; for (let i = 0; i < n; i++) totAll += tot[i];
for (const e of ex) totAll += Number(e.total);
const nomKey = { ['D|' + D.name]: 1, ['R|' + R.name]: 1 };
const TK = [];
for (const t of TL) {
if (nomKey[t.key] || TK.some((x) => x.key === t.key || x.vpKey === t.key)) continue;
const [tp_, tn_] = t.key.split('|'); const custom = tp_ === 'X';
const C = custom ? op28.customCand(p) : tp_ === 'I' ? cand(cands, 'I', tn_) : cand(cands, tp_, tn_); if (!C) continue;
const row = custom ? null : op28.thirdRow(t.key);
const V = t.vp && !nomKey[t.vp] && t.vp !== t.key && !TK.some((x) => x.key === t.vp || x.vpKey === t.vp) && !TL.some((x) => x.key === t.vp) ? (() => { const [a, b] = t.vp.split('|'); return cand(cands, a, b); })() : null;
const vrow = V ? op28.thirdRow(t.vp) : null;
let s0 = row ? Number(row.share) / 100 : Number(C.third_default || 5) / 100; let o = s0 / (1 - s0);
if (row) { const mD = row['m|D|' + D.name], mR = row['m|R|' + R.name]; const a = mD == null || mD === '' ? 1 : Number(mD), b = mR == null || mR === '' ? 1 : Number(mR); if (!(a > 0) || !(b > 0)) continue; o *= a * b; }
if (vrow) o *= Math.exp(0.25 * Number(vrow.lift || 0));
const idx = new Float64Array(n), qd = new Float64Array(n); const hm = json(C.home), hv = V ? json(V.home) : {};
const kI = row && TCc && Object.prototype.hasOwnProperty.call(TCc[0], t.key + '|idx') ? t.key : null;
const kV = vrow && TCc && Object.prototype.hasOwnProperty.call(TCc[0], t.vp + '|idx') ? t.vp : null;
const draw = json(C.draw); let qs = 0, ws = 0;
for (let i = 0; i < n; i++) {
const c = cm[i]; let a = 1, q = 0.5; const cr = tcIx && tcIx.has(c.fips) ? TCc[tcIx.get(c.fips)] : null;
if (kI && cr) { a = Number(cr[kI + '|idx']) || 1; q = Number(cr[kI + '|qd']); if (!isFinite(q)) q = 0.5; }
else { let x = 0, y = 0; for (const ty of Object.keys(tsplit)) { const w = (draw[ty] || 0) * Number(c['type_' + ty]); x += w; y += w * tsplit[ty]; }
const prop = isFinite(Number(c.tp_prop)) && c.tp_prop !== '' ? Number(c.tp_prop) : 1; a = x * (Number(c.indep_open) || 1) * Math.sqrt(prop); q = x > 0 ? y / x : 0.5; }
if (kV && cr) a = 0.8 * a + 0.2 * (Number(cr[kV + '|idx']) || 1);
a *= (1 + Math.abs(hm[c.st] || 0) / 10) * (1 + 0.25 * Math.abs(hv[c.st] || 0) / 10);
idx[i] = a; qd[i] = q; qs += a * tot[i]; ws += tot[i];
}
for (let i = 0; i < n; i++) idx[i] = qs > 0 ? idx[i] * ws / qs : 1;
TK.push({ nf: row && row.new_voters !== '' && isFinite(Number(row.new_voters)) ? Number(row.new_voters) : 0.1, newV: 0, key: t.key, name: C.name, vp: V ? V.name : '', vpKey: V ? t.vp : '', label: C.name + (V ? ' and ' + V.name : ''), O: o, user: t.share != null && isFinite(t.share) ? Math.max(0, Math.min(45, t.share)) / 100 : null,
modeled: o / (1 + o), idx, qd, fromD: row ? Number(row.from_d) : null, custom });
}
const NT = TK.length;
const F = TK.map((a, k) => TK.reduce((f, b, j) => { if (j === k) return f; const r = TPr.get(a.key); const v = r ? Number(r[b.key]) : NaN; return f * (isFinite(v) && v > 0 ? Math.sqrt(v) : 1); }, 1));
const Osum = TK.reduce((a, t) => a + t.O, 0);
TK.forEach((t, k) => { t.target = t.user != null ? t.user : (t.O / (1 + Osum)) * F[k]; t.joint = (t.O / (1 + Osum)) * F[k]; });
const scl = TK.map(() => 1); const tsh = TK.map(() => new Float64Array(n));
let avgQd = TK.map(() => 0.5);
for (let it = 0; it < 5 && NT; it++) {
const got = TK.map(() => 0), gq = TK.map(() => 0);
for (let i = 0; i < n; i++) { let den = 1; for (let k = 0; k < NT; k++) den += TK[k].O * scl[k] * TK[k].idx[i];
for (let k = 0; k < NT; k++) { const v = Math.min(0.6, TK[k].O * scl[k] * TK[k].idx[i] / den * F[k]); tsh[k][i] = v; got[k] += v * tot[i]; gq[k] += v * tot[i] * TK[k].qd[i]; } }
for (let k = 0; k < NT; k++) { const exV = ex.reduce((a, e) => a + Number(e.total), 0) * TK[k].target; got[k] += exV; avgQd[k] = got[k] > exV ? gq[k] / (got[k] - exV) : 0.5;
scl[k] *= got[k] > 0 ? Math.pow(TK[k].target * totAll / got[k], 1.2) : 1; }
}
const cty = new Array(n); const agg = {};
const contrib = [];
const add = (s, d, r, t, o, w = 1, tk = null, keep = true) => { if (keep) contrib.push([s, d, r, t, o, w, tk]); const a = agg[s] || (agg[s] = { D: 0, R: 0, I: 0, O: 0, T: new Array(NT).fill(0) }); a.D += d * w; a.R += r * w; a.I += t * w; a.O += o * w; if (tk) for (let k = 0; k < NT; k++) a.T[k] += tk[k] * w; };
const consol = (pt, party, c, d, r) => {
if (!pt) return [d, r, 0]; const ii = pt.S.cidx.get(c.fips); if (ii == null) return [d, r, 0];
const K = pt.S.names.length; let ax = 0, an = 0;
for (let j = 0; j < K; j++) { const s = pt.S.sh[ii * K + j]; ax += s * pt.dxv[j]; an += s * pt.dnv[j]; }
const own = party === 'D' ? d : r; const f = Math.min(GP.f_cap, pt.S.V[ii] / Math.max(1, own)) * (GP.consol_w == null ? 1 : Number(GP.consol_w));
const mx = Math.max(-0.3, Math.min(0.3, ax * f)) * own, mn = Math.max(-0.3, Math.min(0.3, an * f)) * own;
return party === 'D' ? [d - mx - mn, r + mx, GP.third_of_n * mn] : [d + mx, r - mx - mn, GP.third_of_n * mn];
};
let pcW = 0, pcD = 0, pcR = 0;
for (let i = 0; i < n; i++) {
const c = cm[i]; const gridAdj = spRows.length ? (dmp(c.st, i) - Number(c.damp0 || 1)) * Number(c.natsw || 0) : 0; const m = Number(c.base_margin) + gridAdj + eff(c.st, i);
let o = tot[i] * othS[i]; const tw = tot[i] - o;
let d = tw * (1 - m / 100) / 2, r = tw * (1 + m / 100) / 2, t = 0;
const m0 = (r - d) / Math.max(1, r + d) * 100;
let x = consol(ptD, 'D', c, d, r); d = x[0]; r = x[1]; o += x[2]; const m1 = (r - d) / Math.max(1, r + d) * 100;
x = consol(ptR, 'R', c, d, r); d = x[0]; r = x[1]; o += x[2]; const m2 = (r - d) / Math.max(1, r + d) * 100;
const tk = NT ? new Array(NT) : null;
for (let k2 = 0; k2 < NT; k2++) { const tv = tsh[k2][i] * tot[i]; const nv = Math.min(0.5, TK[k2].nf * lpOf(c.fips)) * tv; const fd = Math.min(d, (tv - nv) * TK[k2].qd[i]), fr = Math.min(r, tv - nv - fd); d -= fd; r -= fr; tk[k2] = fd + fr + nv; t += fd + fr + nv; TK[k2].newV += nv; }
const pc = m2 - m0; pcW += d + r; pcD += (m1 - m0) * (d + r); pcR += (m2 - m1) * (d + r);
cty[i] = { fips: c.fips, st: c.st, D: d, R: r, I: t, O: o, T: tk, m: ((r - d) / Math.max(1, r + d)) * 100, eff: eff(c.st, i) - natPart * dmp(c.st, i) * EL[i], home: HO[i], primc: PRC[i], pc, cc: -(xD[i] - mD) + (xR[i] - mR), q: qual * dmp(c.st, i), damp: dmp(c.st, i), grid: Number(c.natsw || 0) * (dmp(c.st) - 1) };
add(c.st, d, r, t, o, 1, tk);
if (Number(c.ne2) > 0) add(NE2, d, r, t, o, Number(c.ne2), tk);
if (c.st === 'ME') { add(ME1, d, r, t, o, Number(c.me1), tk); add(ME2, d, r, t, o, 1 - Number(c.me1), tk); }
}
const natPC = pcW > 0 ? (pcD + pcR) / pcW : 0;
for (const e of ex) {
const m = Number(e.base_margin) + eff(e.st, null) + natPC; const tt0 = Number(e.total), tad = turnAdd(e.st, tt0), tt = tt0 + tad; baseVotes += tt0; turnVotes += tad; const o = tt * Math.min(0.2, Number(e.other_share)) * (T ? GP.named_third_keep : 1); const tw = tt - o;
let d = tw * (1 - m / 100) / 2, r = tw * (1 + m / 100) / 2, t = 0; const tk = NT ? new Array(NT) : null;
for (let k2 = 0; k2 < NT; k2++) { const tv = TK[k2].target * tt; const nv = Math.min(0.5, TK[k2].nf) * tv; const fd = Math.min(d, (tv - nv) * avgQd[k2]), fr = Math.min(r, tv - nv - fd); d -= fd; r -= fr; tk[k2] = fd + fr + nv; t += fd + fr + nv; TK[k2].newV += nv; }
add(e.st, d, r, t, o, 1, tk);
}
// site: the reader can set the Democrat's and the Republican's national share. Every county and statewide unit scales
// its Democratic and Republican vote by one national factor each, the third party tickets (or, with none, the other
// candidates) take up or give back the difference in proportion to their own vote, and every state is rebuilt as the
// sum of its counties, so the map, the simulations and the counties all carry the same numbers.
{ const tD = p.dsh === '' || p.dsh == null || !isFinite(Number(p.dsh)) ? null : Math.max(0, Math.min(95, Number(p.dsh))) / 100;
  const tR = p.rsh === '' || p.rsh == null || !isFinite(Number(p.rsh)) ? null : Math.max(0, Math.min(95, Number(p.rsh))) / 100;
  if (tD != null || tR != null) {
    const g = (d, r, t, o, tk, fD, fR) => {
      const tot = d + r + t + o; let nd = d * fD, nr = r * fR; let room = tot - o - nd - nr; let nk = tk ? tk.slice() : null, nt = t, no = o;
      if (room >= 0) { if (NT && t > 0) { const f = room / t; nk = tk.map((v) => v * f); nt = room; } else if (NT) { nk = tk.map(() => room / NT); nt = room; } else no = o + room; }
      else { const f = (tot - o) / Math.max(1, nd + nr); nd *= f; nr *= f; nt = 0; if (nk) nk = nk.map(() => 0); }
      return [nd, nr, nt, no, nk];
    };
    let fD = 1, fR = 1;
    for (let it = 0; it < 8; it++) {
      let VDn = 0, VRn = 0, VA = 0;
      for (const c of contrib) { if (String(c[0]).includes('-')) continue; const x = g(c[1], c[2], c[3], c[4], c[6], fD, fR); VDn += x[0] * c[5]; VRn += x[1] * c[5]; VA += (c[1] + c[2] + c[3] + c[4]) * c[5]; }
      if (tD != null && VDn > 0) fD *= tD * VA / VDn; if (tR != null && VRn > 0) fR *= tR * VA / VRn;
    }
    for (const k of Object.keys(agg)) delete agg[k];
    for (const c of contrib) { const x = g(c[1], c[2], c[3], c[4], c[6], fD, fR); add(c[0], x[0], x[1], x[2], x[3], c[5], x[4], false); }
    for (let i = 0; i < n; i++) { const c = cty[i]; if (!c) continue; const x = g(c.D, c.R, c.I, c.O, c.T, fD, fR); c.D = x[0]; c.R = x[1]; c.I = x[2]; c.O = x[3]; c.T = x[4]; c.m = ((c.R - c.D) / Math.max(1, c.R + c.D)) * 100; }
  } }
const DSd = dash.data('districts'), DXd = dash.data('cd_xwalk'); const dist = [];
if (DSd && DSd.status === 'ok' && DXd && DXd.status === 'ok') {
const ci = new Map(cm.map((c, i) => [c.fips, i])); const acc = {};
for (const x of DXd.data) { const i = ci.get(x.fips); if (i == null) continue; const w = Number(x.share_c); const c = cty[i]; const a = acc[x.cd] || (acc[x.cd] = [0, 0, 0, 0, new Array(NT).fill(0)]); a[0] += c.D * w; a[1] += c.R * w; a[2] += c.I * w; a[3] += c.O * w; for (let k = 0; k < NT; k++) a[4][k] += (c.T ? c.T[k] : 0) * w; }
const lg = (m) => { const v = Math.max(-99.5, Math.min(99.5, m)) / 100; return Math.log((1 - v) / (1 + v)); };
const ilg = (x) => Math.max(-99.5, Math.min(99.5, (1 - 2 / (1 + Math.exp(-x))) * 100));
for (const r of DSd.data) {
const so = Number(r.state_only) === 1; const a = so ? agg[r.st] : acc[r.cd]; if (!a) continue;
const ma = ((a.R ?? a[1]) - (a.D ?? a[0])) / Math.max(1, (a.R ?? a[1]) + (a.D ?? a[0])) * 100; const m0 = Number(r.m24), x0 = Number(r.xw_m24);
const m = r.st === 'AK' ? ma : 0.5 * (m0 + ma - x0) + 0.5 * ilg(lg(m0) + lg(ma) - lg(x0));
const tt = (a.D ?? a[0]) + (a.R ?? a[1]) + (a.I ?? a[2]) + (a.O ?? a[3]);
const tks = a.T ?? a[4]; dist.push({ cd: r.cd, st: r.st, m, m24: m0, iS: tt > 0 ? (a.I ?? a[2]) / tt : 0, iK: TK.map((_, k) => (tt > 0 ? tks[k] / tt : 0)), oS: tt > 0 ? (a.O ?? a[3]) / tt : 0, win: [0, 0, 0] });
}
}
// site: Alaska and Connecticut are state rows in the model; spread each over its counties by the county's lean and
// turnout share, solving one shift so the counties add exactly to the state
for (const s of ['AK', 'CT']) {
const a = agg[s]; const rows = AKCT.filter((r) => r[1] === s); if (!a || !rows.length) continue;
const two = Math.max(1e-9, a.D + a.R), pD0 = Math.min(1 - 1e-6, Math.max(1e-6, a.D / two)), L0 = Math.log(pD0 / (1 - pD0)); const ws = rows.reduce((x, r) => x + r[2], 0), ow = rows.reduce((x, r) => x + r[2] * r[4], 0);
let lo = -6, hi = 6;
for (let it = 0; it < 60; it++) { const mid = (lo + hi) / 2; let sv = 0; for (const r of rows) sv += (r[2] / ws) / (1 + Math.exp(-(L0 + mid + r[3]))); if (sv > pD0) hi = mid; else lo = mid; }
const dl = (lo + hi) / 2; let sD = 0; const tmp = rows.map((r) => { const tp = two * r[2] / ws; const d = tp / (1 + Math.exp(-(L0 + dl + r[3]))); sD += d; return [r, tp, d]; });
for (const [r, tp, d0] of tmp) { const d = sD > 0 ? d0 * a.D / sD : 0, rr_ = Math.max(0, tp - d);
cty.push({ fips: r[0], st: s, D: d, R: rr_, I: a.I * r[2] / ws, T: a.T.map((v) => v * r[2] / ws), O: a.O * r[2] * r[4] / ow, m: ((rr_ - d) / Math.max(1, rr_ + d)) * 100, eff: 0, pc: 0, q: 0, damp: dmp(s), grid: 0, alloc: true }); }
}
const cwin = new Float64Array(cty.length * 3); const rcn = rng(9028); let cN = 0;
const rd = rng(2814);
const meta = Object.fromEntries(st.map((r) => [r.st, r]));
const keys = Object.keys(agg).filter((s) => meta[s] && Number(meta[s].ev) > 0);
const sdS = keys.map((s) => { const r = meta[s]; return Math.max(1.5, Math.sqrt(Math.max(0, ((Number(r.p90) - Number(r.p10)) / 2.563) ** 2 - 4.6 ** 2 - 1.5 ** 2))); });
const rr = rng(2028); const ev = keys.map((s) => Number(meta[s].ev));
const win = keys.map(() => [0, 0, 0]); const share = keys.map(() => [0, 0, 0, 0]); const winK = keys.map(() => new Array(NT).fill(0)); const shK = keys.map(() => new Array(NT).fill(0));
const tW = TK.map(() => 0), tEV = TK.map(() => 0);
let wD = 0, wR = 0, wI = 0, none = 0, evD = 0, evR = 0, evI = 0; const hist = new Array(28).fill(0);
for (let s = 0; s < N; s++) {
let chi = 0; for (let j = 0; j < 6; j++) { const z = gauss(rr); chi += z * z; }
const nat = 3.8 * gauss(rr) / Math.sqrt(chi / 6); const fI = Math.exp(0.35 * gauss(rr) - 0.06); const fO = Math.exp(0.3 * gauss(rr) - 0.045);
const fK = TK.map((_, k) => (k === 0 ? fI : Math.exp(0.35 * gauss(rr) - 0.06))); const eK = TK.map(() => 0);
let eD = 0, eR = 0, eI = 0, neW = 1; const stN = {}, regN = {};
for (let j = 0; j < keys.length; j++) {
const s0 = keys[j], base = s0.split('-')[0]; const a = agg[s0]; const total = a.D + a.R + a.I + a.O;
const rg = REG8[base] ?? -1; const sn = stN[base] ?? (stN[base] = (regN[rg] ?? (regN[rg] = 1.0 * gauss(rr))) + 1.12 * gauss(rr) + sdS[j] * tdraw(rr));
const zI = Math.exp(0.2 * gauss(rr));
const IK = TK.map((_, k) => a.T[k] * fK[k] * zI); let I = NT ? IK.reduce((x, y) => x + y, 0) : Math.min(total * 0.7, a.I * fI * zI);
if (I > total * 0.7) { const f = total * 0.7 / I; for (let k = 0; k < NT; k++) IK[k] *= f; I = total * 0.7; }
const O = Math.min(total * 0.25, a.O * fO); const tw = total - I - O;
const m = ((a.R - a.D) / Math.max(1, a.R + a.D)) * 100 + nat * dmp(s0) + sn;
const d = tw * (1 - m / 100) / 2, r = tw * (1 + m / 100) / 2;
let kb = -1, Ib = 0; for (let k = 0; k < NT; k++) if (IK[k] > Ib) { Ib = IK[k]; kb = k; }
if (!NT) Ib = I;
const w = d >= r && d >= Ib ? 0 : r >= Ib ? 1 : 2;
win[j][w]++; share[j][0] += d / total; share[j][1] += r / total; share[j][2] += I / total; share[j][3] += O / total;
for (let k = 0; k < NT; k++) shK[j][k] += IK[k] / total;
if (w === 0) eD += ev[j]; else if (w === 1) eR += ev[j]; else { eI += ev[j]; if (kb >= 0) { winK[j][kb]++; eK[kb] += ev[j]; } }
if (s0 === 'NE') neW = w;
}
for (const x of dist) { const sn = stN[x.st] ?? 0; const m = x.m + nat * dmp(x.st) + sn + 3.0 * gauss(rd); const I = Math.min(0.7, NT ? x.iK.reduce((a, v, k) => a + v * fK[k], 0) : x.iS * fI); const tw = 1 - I - Math.min(0.25, x.oS * fO);
const Ib = NT ? Math.max(...x.iK.map((v, k) => v * fK[k])) : I;
const d = tw * (1 - m / 100) / 2, r = tw * (1 + m / 100) / 2; x.win[d >= r && d >= Ib ? 0 : r >= Ib ? 1 : 2]++; }
// site: every county in the same runs, a quarter of them, its own 3 point error on top of the state's
if (s % 4 === 0) { cN++;
for (let i = 0; i < cty.length; i++) { const c = cty[i]; if (!c) continue; const m = c.m + nat * c.damp + (stN[c.st] ?? 0) + 3.0 * gauss(rcn);
if (c.I > 0) { const tt = c.D + c.R + c.I + c.O; const IK = NT && c.T ? c.T.map((v, k) => Math.min(0.7, (v / tt) * fK[k])) : [Math.min(0.7, (c.I / tt) * fI)]; const I = IK.reduce((x, y) => x + y, 0); const Ib = Math.max(...IK); const tw = 1 - I - c.O / tt; const d = tw * (1 - m / 100) / 2, r = tw * (1 + m / 100) / 2; cwin[i * 3 + (d >= r && d >= Ib ? 0 : r >= Ib ? 1 : 2)]++; }
else cwin[i * 3 + (m < 0 ? 0 : 1)]++; } }
eR += 1; if (neW === 0) eD += 1; else if (neW === 2) eI += 1; else eR += 1;
let kw = -1; for (let k = 0; k < NT; k++) { tEV[k] += eK[k]; if (eK[k] >= 270) kw = k; }
if (eD >= 270) wD++; else if (eR >= 270) wR++; else if (kw >= 0 || (!NT && eI >= 270)) { wI++; if (kw >= 0) tW[kw]++; } else none++;
evD += eD; evR += eR; evI += eI; hist[Math.min(27, Math.floor(eD / 20))]++;
}
for (let i = 0; i < cty.length; i++) if (cty[i]) { cty[i].pD = cwin[i * 3] / Math.max(1, cN); cty[i].pR = cwin[i * 3 + 1] / Math.max(1, cN); cty[i].pI = cwin[i * 3 + 2] / Math.max(1, cN); }
const states = {};
keys.forEach((s, j) => { const a = agg[s]; states[s] = { D: a.D, R: a.R, I: a.I, O: a.O, ev: ev[j], m: ((a.R - a.D) / Math.max(1, a.R + a.D)) * 100,
pD: win[j][0] / N, pR: win[j][1] / N, pI: win[j][2] / N, sD: share[j][0] / N, sR: share[j][1] / N, sI: share[j][2] / N, sO: share[j][3] / N,
T: a.T.slice(), tk: TK.map((_, k) => ({ v: a.T[k], s: shK[j][k] / N, p: winK[j][k] / N })) }; });
const districts = {}; for (const x of dist) districts[x.cd] = { st: x.st, m: x.m, m24: x.m24, pD: x.win[0] / N, pR: x.win[1] / N, pI: x.win[2] / N };
let VD = 0, VR = 0, VI = 0, VO = 0; const VK = TK.map(() => 0); for (const s of Object.keys(agg)) if (!s.includes('-')) { VD += agg[s].D; VR += agg[s].R; VI += agg[s].I; VO += agg[s].O; for (let k = 0; k < NT; k++) VK[k] += agg[s].T[k]; }
const tickets = TK.map((t, k) => ({ newV: t.newV, nf: t.nf, color: op28.TKC[k % op28.TKC.length], key: t.key, name: t.name, vp: t.vp, label: t.label, votes: VK[k], modeled: t.modeled, joint: t.joint, target: t.target, user: t.user, fromD: t.fromD, custom: t.custom, pWin: tW[k] / N, ev: tEV[k] / N }));
const pinfo = (pt, party, nat) => (pt ? { share: pt.share, front: pt.front, frontShare: pt.frontShare, quality: party === 'R' ? -pt.quality : pt.quality, consol: nat, polled: pt.polled } : null);
const stE = {}; for (const r of TO.values()) stE[r.st] = (stE[r.st] || 0) + (Number(r.elig) || 0);
const turnout = { elig: Object.values(stE).reduce((a, b) => a + b, 0), base: baseVotes, matchup: turnVotes, newT: TK.reduce((a, t) => a + t.newV, 0), stE };
const out = { turnout, D: D.name, R: R.name, T: NT ? TK.map((t) => t.label).join(' + ') : null, tickets, pD: wD / N, pR: wR / N, pI: wI / N, pNone: none / N, evD: evD / N, evR: evR / N, evI: evI / N,
VD, VR, VI, VO, states, districts, cty, hist, keys, spend, tip, prim: { D: pinfo(ptD, 'D', pcW > 0 ? pcD / pcW : 0), R: pinfo(ptR, 'R', pcW > 0 ? pcR / pcW : 0) } };
memo = { key, out };
return out;
};
})();

  return {
    ticket(p) { PARAMS = Object.assign({}, p); return op28.ticket(); },
    primShares(party, p) { PARAMS = Object.assign({}, p || {}); return op28.primShares(party); },
    /** the v45 official primary: the whole field in every state at once; p = { pparty, pout } */
    prim(p) { PARAMS = Object.assign({}, p || {}); return op28.prim(); },
    rows(id) { return DATA[id] || []; },
  };
}
/** engine.json stores each dataset as columns and rows; the engine reads row objects with blanks as empty strings */
export function expand(E) {
  const out = {};
  for (const [id, t] of Object.entries(E)) out[id] = t.rows.map((r) => { const o = {}; t.cols.forEach((c, i) => { o[c] = r[i] == null ? '' : r[i]; }); return o; });
  return out;
}
