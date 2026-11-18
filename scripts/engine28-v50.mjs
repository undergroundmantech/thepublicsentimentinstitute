// On Point 2028 site engine update, v50. Run once from the repo root:
//   node scripts/engine28-v50.mjs
// It edits app/2028/engine28.js in place so Build a ticket places every ticket effect county by county, as the dashboard
// does: national candidate effects by each county's elasticity, home state edges strongest around the home county, running
// mates the same, and each state's primary term by the nominee's own primary vote in each county. Nothing is uniform across
// a state any more. It checks every edit first and changes nothing if one does not fit.
import fs from 'node:fs';
const F = 'app/2028/engine28.js';
let t = fs.readFileSync(F, 'utf8');
if (t.includes('const primSpread = ')) { console.log('already updated'); process.exit(0); }
const R = [
[
"    const pD = json(D.prim || '{}'), pR = json(R.prim || '{}'); const pr = (s) => { const b = String(s).split('-')[0]; return pw * ((pD[b] || 0) + (pR[b] || 0)); };",
"    const pD = json(D.prim || '{}'), pR = json(R.prim || '{}'); const pr = (s) => { const b = String(s).split('-')[0]; return pw * ((pD[b] || 0) + (pR[b] || 0)); };\n    // v50: every ticket effect county by county, none uniform across a state.\n    //  elasticity  each county's own (county_model el: 0.7 its Gallup party ID move, 0.3 its vote history, the blend the 2026\n    //              Senate counties chose), vote weighted mean 1; national candidate effects move each county by it\n    //  home state  strongest around the candidate's home county and in the counties that move most: elasticity x\n    //              (1 + fn_a x exp(-distance / fn_l)), scaled so the state's total stays the researched edge; running mates\n    //              the same at their 1.5 points\n    //  primaries   each state's primary term goes to its counties by elasticity and by how the nominee ran in each\n    //              county's primary\n    const EL = new Float64Array(n); { let a = 0, b = 0; for (let i = 0; i < n; i++) { const v = Number(cm[i].el); EL[i] = isFinite(v) && v > 0 ? v : 1; a += EL[i] * tot[i]; b += tot[i]; } for (let i = 0; i < n; i++) EL[i] *= a > 0 ? b / a : 1; }\n    const byState = {}; for (let i = 0; i < n; i++) (byState[cm[i].st] || (byState[cm[i].st] = [])).push(i);\n    const fipsIx = new Map(cm.map((c, i) => [c.fips, i]));\n    const FN_A = GP.fn_a == null ? 3 : Number(GP.fn_a), FN_L = GP.fn_l == null ? 30 : Number(GP.fn_l);\n    const HO = new Float64Array(n), PRC = new Float64Array(n);\n    const spread = (C, amp) => {\n      if (!C) return; const hc = json(C.home_cty || '{}');\n      for (const [s, v] of Object.entries(amp)) { const ix = byState[s]; if (!ix || !v) continue; const h = hc[s] != null ? fipsIx.get(hc[s]) : undefined;\n        let sw = 0, sv = 0; const ww = ix.map((i) => { let w = EL[i]; if (h != null) { const dd = Math.hypot((Number(cm[i].cx) || 0) - (Number(cm[h].cx) || 0), (Number(cm[i].cy) || 0) - (Number(cm[h].cy) || 0)); w *= 1 + FN_A * Math.exp(-dd / FN_L); } sw += w * tot[i]; sv += tot[i]; return w; });\n        ix.forEach((i, k) => { HO[i] += v * ww[k] * sv / sw; }); } };\n    spread(D, hD); spread(R, hR);\n    if (DV && vD) spread(DV, { [vD]: -1.5 }); if (RV && vR) spread(RV, { [vR]: 1.5 });\n    const primSpread = (pt, Cn, pj) => {\n      const S = pt ? pt.S : null; const j = S ? S.names.indexOf(Cn.name) : -1; const K = S ? S.names.length : 0;\n      for (const [s, v0] of Object.entries(pj)) { const v = pw * Number(v0); const ix = byState[s]; if (!ix || !v) continue;\n        const sh = ix.map((i) => { if (j < 0) return NaN; const ii = S.cidx.get(cm[i].fips); return ii == null ? NaN : S.sh[ii * K + j]; });\n        let a = 0, b = 0; ix.forEach((i, k) => { if (isFinite(sh[k])) { a += sh[k] * tot[i]; b += tot[i]; } }); const m = b > 0 && a > 0 ? a / b : 1;\n        let sw = 0, sv = 0; const ww = ix.map((i, k) => { const r = isFinite(sh[k]) ? Math.max(0.25, Math.min(4, sh[k] / m)) : 1; const w = EL[i] * Math.sqrt(r); sw += w * tot[i]; sv += tot[i]; return w; });\n        ix.forEach((i, k) => { PRC[i] += v * ww[k] * sv / sw; }); } };\n    primSpread(ptD, D, pD); primSpread(ptR, R, pR);"
],
[
"    const eff = (s, i) => {\n      let e = natPart * dmp(s, i) + (hD[s] || 0) + (hR[s] || 0) + pr(s);\n      if (vD === s) e -= 1.5; if (vR === s) e += 1.5;\n      if (i != null) e += -(xD[i] - mD) + (xR[i] - mR) - LI * (xI[i] - mI);\n      return e;\n    };",
"    const eff = (s, i) => {\n      if (i == null) { let e = natPart * dmp(s, i) + (hD[s] || 0) + (hR[s] || 0) + pr(s); if (vD === s) e -= 1.5; if (vR === s) e += 1.5; return e; }\n      return natPart * dmp(s, i) * EL[i] + HO[i] + PRC[i] - (xD[i] - mD) + (xR[i] - mR) - LI * (xI[i] - mI);\n    };"
],
[
"eff: eff(c.st, i) - natPart * dmp(c.st, i),",
"eff: eff(c.st, i) - natPart * dmp(c.st, i) * EL[i], home: HO[i], primc: PRC[i],"
],
[
"prim_pull: 0.35 };",
"prim_pull: 0.35, fn_a: 3, fn_l: 30 };"
]
];
for (const [a] of R) { const n = t.split(a).length - 1; if (n !== 1) { console.error('engine28.js did not match, nothing changed:', a.slice(0, 80), n); process.exit(1); } }
for (const [a, b] of R) t = t.replace(a, () => b);
fs.writeFileSync(F, t); console.log('engine28.js updated,', R.length, 'edits');
