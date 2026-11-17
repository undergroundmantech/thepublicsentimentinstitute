// Patch 5: a click or tap on Results goes straight to the results with no menu left open;
// a mouse hover or a held touch opens the full menu; the opening screen stays until the count is read.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (p: string) => fs.readFileSync(p, "utf8");

test("desktop tabs: a click goes to the page and closes the menu; hover (mouse only) or a held touch opens it", () => {
  const nav = read("app/components/Navbar.tsx");
  assert.match(nav, /const go = \(k: string\) => \{[^}]*hush\.current = k; setMenu\(null\);/, "a click closes the menu and keeps it closed");
  assert.match(nav, /const enter = \(k: string\) => \{ if \(hush\.current === k\) return;/, "the menu stays shut until the pointer leaves");
  assert.match(nav, /onPointerEnter=\{\(e\) => \{ if \(e\.pointerType === "mouse"\) enter\(g\.key\)/, "hover opens the menu for a mouse only");
  assert.match(nav, /onPointerLeave=\{\(e\) => \{ if \(e\.pointerType === "mouse"\) \{ if \(hush\.current === g\.key\) hush\.current = null;/);
  assert.match(nav, /matches\(":focus-visible"\)\) enter\(g\.key\)/, "focus opens it for the keyboard, not after a click");
  assert.match(nav, /onClick=\{\(e\) => tabClick\(g\.key, e\)\}/);
  assert.match(nav, /setMenu\(k\); navigator\.vibrate\?\.\(10\); \}, 450\)/, "a held touch opens the menu");
  assert.match(nav, /closest\?\.\("a\[data-held\]"\)/, "the click that ends a hold does not navigate");
});

test("phone: Results leads the tab bar; a tap enters the monitor, a hold opens the menu at Results", () => {
  const tabs = read("app/components/MobileTabs.tsx");
  assert.match(tabs, /key: "results"[^}]*href: "\/results\/monitor"/);
  assert.ok(tabs.indexOf('key: "results"') < tabs.indexOf('key: "accuracy"'), "Results is the first tab");
  assert.match(tabs, /new CustomEvent\("opp:menu", \{ detail: \{ section: "results" \} \}\)/);
  assert.match(tabs, /\}, 450\)/);
  assert.match(read("app/phone.css"), /repeat\(6,/);
  const nav = read("app/components/Navbar.tsx");
  assert.match(nav, /className="macc-go"/, "menu rows with a page go there on tap");
  assert.match(nav, /detail\?\.section|detail\.section/, "the menu opens at the section asked for");
});
