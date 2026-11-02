// The /forecast hero: title block, closest-race card and the four fact cards are separate grid areas, and the
// masthead hands over to the burger before the desktop nav can overflow. REPO=<tree> checks another worktree.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.env.REPO || process.cwd();
const read = (p) => readFileSync(join(root, p), "utf8");
const tsx = read("app/forecast/ForecastConsole.tsx");
const css = read("app/forecast/console.css");
const head = tsx.slice(tsx.indexOf('<header className="fcx-head">'), tsx.indexOf("</header>"));

test("hero has a title block, a closest-race link and the fact list, in that order", () => {
  const i = ["fcx-title", "fcx-closest", "fcx-meta"].map((c) => head.indexOf(`className="${c}"`));
  assert.ok(i.every((x) => x > 0), `missing hero part: ${i}`);
  assert.deepEqual([...i].sort((a, b) => a - b), i);
  assert.match(head, /<Link href=\{top\.href\} className="fcx-closest">/);
  assert.doesNotMatch(head, /pty-side|say=\{/, "Pointy must not carry the closest race as a speech bubble");
});

test("hero CSS places each part in a named area and stacks on phones", () => {
  assert.match(css, /\.fcx-head \{[^}]*grid-template-areas: "close title" "meta meta"/);
  assert.match(css, /\.fcx-meta \{[^}]*grid-auto-flow: column; grid-auto-columns: minmax\(0, 1fr\)/);
  assert.match(css, /@media \(max-width: 760px\) \{\s*\.fcx-head \{[^}]*grid-template-areas: "title" "close" "meta"/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /:root:not\(\[data-mode="themed"\]\) \.fcx-closest \.pty-cameo \{ display: none; \}/);
  assert.doesNotMatch(css, /\.fcx-head \.fcx-pty/);
});

test("masthead switches to the burger at 1120 and drops the gold button by 1400", () => {
  const chrome = read("app/chrome.css");
  assert.match(chrome, /@media \(max-width: 1120px\) \{ \.opp \.nav\.mmenu \{ display: none; \}/);
  assert.match(chrome, /@media \(max-width: 1400px\) \{ \.opp \.top \.right \.btn\.gold \{ display: none; \} \}/);
  assert.doesNotMatch(chrome, /max-width: 1060px\) \{ \.opp \.nav\.mmenu/);
});
