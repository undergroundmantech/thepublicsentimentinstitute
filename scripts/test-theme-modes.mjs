// Three appearance modes (Pro Dark, Pro Light, Theme): storage, pre-paint script and attribute contract.
// Run: node --test scripts/test-theme-modes.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { CHROME, MODES, THEME_EVENT, THEME_INIT_SCRIPT, THEME_KEY, getMode, getTheme, isMode, schemeOf, setMode, setTheme, toggleTheme } from "../app/lib/theme.ts";

const ROOT = new URL("../", import.meta.url).pathname;

function fakeDom(stored, { throws = false, meta = true } = {}) {
  const store = new Map(stored == null ? [] : [[THEME_KEY, stored]]);
  const metaEl = { content: "#110019", setAttribute(k, v) { if (k === "content") this.content = v; } };
  const root = { dataset: { theme: "dark", mode: "dark" }, style: {} };
  const events = [];
  return {
    root, metaEl, events, store,
    document: { documentElement: root, querySelector: (s) => (meta && s === 'meta[name="theme-color"]' ? metaEl : null) },
    localStorage: {
      getItem: (k) => { if (throws) throw new Error("SecurityError"); return store.has(k) ? store.get(k) : null; },
      setItem: (k, v) => { if (throws) throw new Error("SecurityError"); store.set(k, v); },
    },
    window: { dispatchEvent: (e) => events.push(e) },
  };
}
const runInit = (dom) => new Function("document", "localStorage", THEME_INIT_SCRIPT)(dom.document, dom.localStorage);

test("init script: each stored mode sets mode, scheme, color-scheme and browser chrome", () => {
  for (const [stored, scheme] of [["dark", "dark"], ["light", "light"], ["themed", "dark"]]) {
    const dom = fakeDom(stored); runInit(dom);
    assert.equal(dom.root.dataset.mode, stored);
    assert.equal(dom.root.dataset.theme, scheme);
    assert.equal(dom.root.dataset.opaTheme, scheme);
    assert.equal(dom.root.style.colorScheme, scheme);
    assert.equal(dom.metaEl.content, CHROME[stored]);
  }
});

test("init script: nothing stored, an unknown value or blocked storage leaves the Pro Dark default", () => {
  for (const dom of [fakeDom(null), fakeDom("sepia"), fakeDom("THEMED"), fakeDom("light", { throws: true })]) {
    assert.doesNotThrow(() => runInit(dom));
    assert.equal(dom.root.dataset.mode, "dark");
    assert.equal(dom.root.dataset.theme, "dark");
    assert.equal(dom.metaEl.content, "#110019");
  }
  const noMeta = fakeDom("light", { meta: false });
  assert.doesNotThrow(() => runInit(noMeta));
  assert.equal(noMeta.root.dataset.theme, "light");
});

test("init script never consults the operating system preference", () => {
  assert.doesNotMatch(THEME_INIT_SCRIPT, /matchMedia|prefers-color-scheme/);
  assert.doesNotMatch(readFileSync(join(ROOT, "app/lib/theme.ts"), "utf8"), /matchMedia|prefers-color-scheme/);
});

test("the scheme attribute is only ever dark or light", () => {
  assert.deepEqual([...MODES], ["dark", "light", "themed"]);
  assert.deepEqual(MODES.map(schemeOf), ["dark", "light", "dark"]);
  assert.ok(isMode("themed") && !isMode("auto") && !isMode(null));
});

test("setMode writes every attribute, persists, and announces the mode; persist=false does not store", () => {
  const dom = fakeDom(null);
  globalThis.document = dom.document; globalThis.localStorage = dom.localStorage; globalThis.window = dom.window;
  globalThis.CustomEvent ??= class extends Event { constructor(t, o) { super(t); this.detail = o?.detail; } };
  try {
    setMode("themed");
    assert.equal(dom.root.dataset.mode, "themed");
    assert.equal(dom.root.dataset.theme, "dark");
    assert.equal(dom.store.get(THEME_KEY), "themed");
    assert.equal(dom.metaEl.content, CHROME.themed);
    assert.equal(dom.events.at(-1).type, THEME_EVENT);
    assert.equal(dom.events.at(-1).detail, "themed");
    assert.equal(getMode(), "themed"); assert.equal(getTheme(), "dark");

    setMode("light", false);
    assert.equal(dom.root.dataset.theme, "light");
    assert.equal(dom.store.get(THEME_KEY), "themed", "a non-persisted change keeps the saved choice");

    // two-mode callers still work
    setTheme("dark");
    assert.equal(dom.root.dataset.mode, "dark");
    assert.equal(toggleTheme(), "light");
    assert.equal(dom.root.dataset.mode, "light");
    assert.equal(dom.store.get(THEME_KEY), "light");
  } finally {
    delete globalThis.document; delete globalThis.localStorage; delete globalThis.window;
  }
});

test("setMode survives blocked storage", () => {
  const dom = fakeDom(null, { throws: true });
  globalThis.document = dom.document; globalThis.localStorage = dom.localStorage; globalThis.window = dom.window;
  try {
    assert.doesNotThrow(() => setMode("light"));
    assert.equal(dom.root.dataset.mode, "light");
  } finally {
    delete globalThis.document; delete globalThis.localStorage; delete globalThis.window;
  }
});

function* walk(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(css|tsx?|jsx?)$/.test(n)) yield p;
  }
}

test("no stylesheet or component selects a themed colour scheme", () => {
  const bad = [];
  for (const f of walk(join(ROOT, "app"))) {
    const src = readFileSync(f, "utf8");
    if (/\[\s*data-theme\s*[~|^$*]?=\s*\\?["']?themed|dataset\.theme\s*[!=]==?\s*["']themed|getAttribute\(\s*["']data-theme["']\s*\)\s*[!=]==?\s*["']themed/.test(src)) bad.push(f.slice(ROOT.length));
  }
  assert.deepEqual(bad, []);
});

test("Pro modes hide only decorative Pointy cameos", () => {
  const css = readFileSync(join(ROOT, "app/modes.css"), "utf8");
  assert.match(css, /:root:not\(\[data-mode="themed"\]\) \.pty-cameo:not\(\.essential\) \{ display: none; \}/);
  // only the 404 and the early-vote benchmark explainer are essential
  const essential = ["app/not-found.tsx", "app/maps/early-vote/Benchmarks.tsx"];
  for (const f of essential) assert.match(readFileSync(join(ROOT, f), "utf8"), /<Pointy[^>]*className="[^"]*\bessential\b/, f);
  // a speaking cameo keeps its words as a note in Pro modes; the figure goes
  assert.match(readFileSync(join(ROOT, "app/components/home/Mascot.tsx"), "utf8"), /data-say=\{say \? "" : undefined\}/);
  assert.match(css, /\.pty-cameo\[data-say\]:not\(\.essential\):not\(\.quip\) \.pty-fig \{ display: none; \}/);
  assert.match(readFileSync(join(ROOT, "app/layout.tsx"), "utf8"), /data-theme="dark" data-mode="dark"/);
});
