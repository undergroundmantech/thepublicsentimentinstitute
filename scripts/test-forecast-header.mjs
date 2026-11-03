// The /forecast hero: the title on the left, the generic ballot and projected turnout on the right, then a quiet strip with
// the closest race; the masthead hands over to the burger before the desktop nav can overflow. REPO=<tree> checks another worktree.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.env.REPO || process.cwd();
const read = (p) => readFileSync(join(root, p), "utf8");
const tsx = read("app/forecast/ForecastConsole.tsx");
const css = read("app/forecast/console.css");
const head = tsx.slice(tsx.indexOf('<header className="fcx-head">'), tsx.indexOf("</header>"));

test("hero has the title, the key numbers and the meta strip with the closest race, in that order", () => {
  const i = ["fcx-title", "fcx-key", "fcx-meta", "fcx-closest"].map((c) => head.indexOf(`className="${c}"`));
  assert.ok(i.every((x) => x > 0), `missing hero part: ${i}`);
  assert.deepEqual([...i].sort((a, b) => a - b), i);
  assert.match(head, />Generic ballot</);
  assert.match(head, />Projected turnout</);
  assert.match(head, /<Link href=\{top\.href\} className="fcx-closest">/);
  assert.doesNotMatch(head, /pty-side|say=\{/, "Pointy must not carry the closest race as a speech bubble");
});

test("hero CSS places each part in a named area and stacks below 1100", () => {
  assert.match(css, /\.fcx-head \{[^}]*grid-template-areas: "title key" "meta meta"/);
  assert.match(css, /\.fcx-key \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 1100px\) \{[^@]*\.fcx-head \{[^}]*grid-template-areas: "title" "key" "meta"/);
  assert.match(css, /:root:not\(\[data-mode="themed"\]\) \.fcx-key \.pty-cameo \{ display: none; \}/);
});

test("only The Weighting Room nav button carries the gold gradient", () => {
  const nav = read("app/components/Navbar.tsx");
  assert.equal((nav.match(/className="btn gold wr"/g) ?? []).length, 2);
  assert.match(read("app/opp.css"), /\.opp \.btn\.gold\.wr\{background:linear-gradient/);
});

test("masthead switches to the burger at 1120 and drops the gold button by 1400", () => {
  const chrome = read("app/chrome.css");
  assert.match(chrome, /@media \(max-width: 1120px\) \{ \.opp \.nav\.mmenu \{ display: none; \}/);
  assert.match(chrome, /@media \(max-width: 1400px\) \{ \.opp \.top \.right \.btn\.gold \{ display: none; \} \}/);
  assert.doesNotMatch(chrome, /max-width: 1060px\) \{ \.opp \.nav\.mmenu/);
});
