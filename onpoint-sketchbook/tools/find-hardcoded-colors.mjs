// Lists hardcoded colors in your CSS and TSX so you can swap them for --sk-* tokens.
// Run from the repo root:  node onpoint-sketchbook/tools/find-hardcoded-colors.mjs app
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
const root = process.argv[2] || 'app';
const RX = /#(?:[0-9a-fA-F]{3}){1,2}\b|rgba?\([^)]*\)/g;
const SWAP = { '#fff': 'var(--sk-ink) on paper, or #f3eff8 on .sk-dark', '#ffffff': 'var(--sk-ink)', '#000': 'var(--sk-ink)', '#3d7bff': 'var(--sk-d)', '#ff3b5c': 'var(--sk-r)', '#9b5cff': 'var(--sk-purple-2)', '#0a0711': 'var(--sk-black)' };
let total = 0;
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f); if (statSync(p).isDirectory()) { if (!/node_modules|\.next/.test(p)) walk(p); continue; }
    if (!['.css', '.tsx', '.ts', '.jsx'].includes(extname(p))) continue;
    readFileSync(p, 'utf8').split('\n').forEach((line, i) => { const m = line.match(RX); if (m) { total += m.length; console.log(`${p}:${i + 1}  ${[...new Set(m)].map(c => SWAP[c.toLowerCase()] ? `${c}  try ${SWAP[c.toLowerCase()]}` : c).join('   ')}`); } });
  }
})(root);
console.log(`\n${total} hardcoded colors found under ${root}`);
