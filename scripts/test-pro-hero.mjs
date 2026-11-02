// The race hero's numbers. Pro Dark, Pro Light and Theme read one set of explicit outcomes built by heroOdds.ts from the
// published forecast files, so these checks run the same builders the pages call against every race, office, chamber
// and measure. Nothing here re-derives a forecast: each chance must be the file's own value.
// Run: node --test scripts/test-pro-hero.mjs   (REPO=<tree> checks another worktree)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.env.REPO || process.cwd();
const read = (p) => readFileSync(join(root, p), "utf8");
const json = (p) => JSON.parse(read(p));
const H = await import(pathToFileURL(join(root, "app/components/opp/heroOdds.ts")).href);
const { isDistribution, fmtChance, squares, leaders, raceHero, statewideHero, chamberHero, measureOdds, HERO_IND } = H;

const model = json("public/forecast/model.json").races;
const statewide = json("public/forecast/downballot.json").races;
const chambers = json("public/forecast/statehouse.json").chambers;
const measures = json("public/forecast/measures.json").measures;
const race = (id) => model.find((r) => r.id === id) ?? assert.fail(`no ${id} in model.json`);
const sum = (o) => o.reduce((s, x) => s + x.p, 0);

test("formatting never rounds a live chance to 0 or a non-certainty to 100, and squares always total 100", () => {
  assert.equal(fmtChance(0.004), "<1%");
  assert.equal(fmtChance(0.996), ">99%");
  assert.equal(fmtChance(0), "0%");
  assert.equal(fmtChance(1), "100%");
  assert.equal(fmtChance(0.505), "51%");
  for (const ps of [[0.583, 0.204, 0.213], [0.3333, 0.3333, 0.3334], [0.995, 0.005], [0.0105, 0.9895]])
    assert.equal(squares(ps.map((p, i) => ({ key: String(i), name: "", color: "", p }))).reduce((a, b) => a + b, 0), 100);
  assert.equal(isDistribution([{ key: "a", name: "", color: "", p: 0.6 }]), false, "one outcome is not a distribution");
  assert.equal(isDistribution([{ key: "a", name: "", color: "", p: 0.6 }, { key: "b", name: "", color: "", p: 0.3 }]), false, "missing mass");
  assert.equal(isDistribution(null), false);
});

test("every contested race shows the model's own probability for exactly its two simulated slots", () => {
  let n = 0;
  for (const r of model) {
    const h = raceHero(r, r.stages.rate);
    if (Math.abs(r.stages.rate) >= 99) continue;
    n++;
    assert.ok(isDistribution(h.odds), r.id);
    assert.deepEqual(h.odds.map((o) => o.key), ["dem", "gop"], r.id);
    assert.equal(h.odds[1].p, r.est.prob, `${r.id}: the Republican slot keeps est.prob exactly`);
    assert.equal(h.odds[0].p, 1 - r.est.prob, `${r.id}: the other slot is its complement in the same simulation`);
    // a card carries a chance only when its name is the slot's exact name; nobody else is keyed
    for (const c of h.cands) assert.equal(c.name, c.key === "dem" ? r.dem : r.gop, r.id);
    for (const c of h.others) assert.equal(c.key, undefined, `${r.id}: ${c.name} has no modeled chance`);
  }
  assert.ok(n > 400, `only ${n} contested races`);
});

test("uncontested and same-party seats get no probability at all", () => {
  const unc = model.filter((r) => Math.abs(r.stages.rate) >= 99);
  assert.ok(unc.length >= 10, `expected the uncontested House seats, found ${unc.length}`);
  for (const r of unc) {
    const h = raceHero(r, r.stages.rate);
    assert.equal(h.contested, false, r.id);
    assert.equal(h.odds, null, r.id);
  }
});

test("independents and three-way races: slots are matched by name, not party or color", () => {
  // Rhode Island governor: an independent holds the Republican slot; the Republican nominee is a third candidate
  const ri = raceHero(race("gov-RI"), race("gov-RI").stages.rate);
  assert.equal(ri.cands.find((c) => c.key === "gop").name, "Ken Block");
  assert.equal(ri.cands.find((c) => c.key === "gop").label, "Independent");
  assert.equal(ri.cands.find((c) => c.key === "gop").color, HERO_IND);
  const guck = ri.others.find((c) => c.name === "Aaron Guckian");
  assert.ok(guck && guck.label === "Republican" && guck.pct > 10, "the Republican nominee is listed with a share");
  assert.equal(ri.odds.find((o) => o.name === "Guckian"), undefined, "and no invented chance");
  // Montana Senate: an independent in the Democratic slot, the Democrat third
  const mt = raceHero(race("sen-MT"), race("sen-MT").stages.rate, true);
  assert.equal(mt.cands.find((c) => c.key === "dem").label, "Independent");
  assert.ok(mt.others.some((c) => c.name === "Alani Bankhead" && c.label === "Democrat"));
  // Nebraska Senate: the independent is the model's Democratic slot and is colored as an independent
  const ne = raceHero(race("sen-NE"), race("sen-NE").stages.rate, true);
  assert.equal(ne.odds[0].name, "Osborn");
  assert.equal(ne.odds[0].color, HERO_IND);
  // Alaska Senate: two Dan Sullivans; only the exact slot name gets the Republican card and chance
  const ak = raceHero(race("sen-AK"), race("sen-AK").stages.rate);
  assert.equal(ak.cands.find((c) => c.key === "gop").name, "Dan S. Sullivan");
  assert.ok(ak.others.some((c) => c.name === "Dan J. Sullivan"));
  assert.equal(ak.cands.length, 2);
});

test("statewide offices: chances only with both nominees, others pooled with their real share or no share", () => {
  for (const r of statewide) {
    if (r.uncontested) continue;
    const h = statewideHero(r, r.votes, r.est.margin);
    assert.equal(h.contested, !!r.dem && !!r.gop && Math.abs(r.est.margin) < 99, r.id);
    if (h.odds) { assert.ok(isDistribution(h.odds), r.id); assert.equal(h.odds[1].p, r.est.prob, r.id); }
    const v = r.votes && r.votes.total > 0 ? r.votes : null;
    for (const c of h.cands) {
      if (v) assert.equal(c.votes, c.key === "dem" ? v.dem : v.rep, r.id);
      else { assert.equal(c.pct, null, `${r.id}: no share without vote totals`); assert.ok(!c.votes, `${r.id}: no zero vote total`); }
    }
    if ((r.others ?? []).length && v) assert.equal(h.others.length, 1, `${r.id}: others share one pooled total`);
    if ((r.others ?? []).length && !v) assert.ok(h.others.every((o) => o.pct === null), r.id);
  }
  // uncontested offices take their own page before any hero is built
  const page = read("app/forecast/statewide/[st]/[office]/page.tsx");
  assert.ok(page.indexOf("if (r.uncontested) {") < page.indexOf("statewideHero(r, v, m)"));
  const lg = statewide.find((r) => r.id === "lg-AR");
  if (lg && !lg.votes) assert.deepEqual(statewideHero(lg, lg.votes, lg.est.margin).others.map((o) => o.pct), lg.others.map(() => null));
});

test("chambers: D, tie and R control chances are each published and sum to 100 percent; nothing is a complement", () => {
  let ties = 0;
  for (const c of chambers) {
    const h = chamberHero(c);
    assert.ok(isDistribution(h.odds), `${c.id} sums to ${sum(h.odds)}`);
    assert.equal(h.odds.find((o) => o.key === "D").p, c.demControl, c.id);
    assert.equal(h.odds.find((o) => o.key === "R").p, c.gopControl, c.id);
    const tie = h.odds.find((o) => o.tie);
    if ((c.tie ?? 0) > 0) { ties++; assert.equal(tie.p, c.tie, c.id); assert.equal(tie.key, "tie"); }
    else assert.equal(tie, undefined, c.id);
    // the favourite is chosen among the parties, never the tie
    assert.notEqual(leaders(h.odds).lead.key, "tie", c.id);
  }
  assert.ok(ties >= 10, `expected even chambers with a tie chance, found ${ties}`);
  const az = chamberHero(chambers.find((c) => c.id === "sl-AZ-house"));
  assert.ok(az.odds.some((o) => o.tie), "Arizona House has a tie outcome");
});

test("chambers: Republican seats are a complement only when no third party can hold a seat", () => {
  for (const c of chambers) {
    const r = chamberHero(c).cands.find((x) => x.key === "R");
    const twoParty = Math.abs(c.demSeats + c.gopSeats - c.seats) < 0.05;
    assert.equal(r.label, twoParty ? `Median ${c.seats - c.median} seats` : `About ${Math.round(c.gopSeats)} seats expected`, c.id);
    assert.equal(r.seats, c.gopSeats, c.id);
  }
  const ak = chamberHero(chambers.find((c) => c.id === "sl-AK-house")).cands.find((x) => x.key === "R");
  assert.match(ak.label, /^About \d+ seats expected$/);
});

test("chambers: a share is labelled a vote share only with vote totals; seat share is never called a vote share", () => {
  const c = chambers.find((x) => x.votes && x.votes.total > 0);
  for (const x of chamberHero(c).cands) { assert.equal(x.share, "vote"); assert.ok(x.votes > 0); }
  const seatOnly = chamberHero({ ...c, votes: null });
  for (const x of seatOnly.cands) {
    assert.equal(x.share, "seat");
    assert.equal(x.votes, null, "no projected votes when the forecast has none");
    assert.equal(x.pct, (100 * x.seats) / c.seats);
  }
  const pro = read("app/components/opp/ProHero.tsx");
  assert.match(pro, /c\.share === "seat" \? "Projected seat share" : "Projected vote share"/);
  assert.match(pro, /\{c\.votes \? <div className="prh-st prh-vt"><dt>Projected votes/, "zero or missing votes are not shown");
  assert.match(read("app/components/opp/StageHero.tsx"), /c\.share === "seat" \? "projected seat share"/);
});

test("measures: Yes keeps est.prob exactly", () => {
  for (const m of measures) {
    const o = measureOdds(m.est.prob, "#y", "#n");
    assert.ok(isDistribution(o), m.id ?? m.slug);
    assert.equal(o[0].p, m.est.prob);
  }
});

test("one set of outcomes feeds both modes, and no page infers a chance from color, name or 100 minus", () => {
  const stage = read("app/components/opp/StageHero.tsx");
  assert.match(stage, /const dist = isDistribution\(odds\) \? odds : null;/);
  assert.match(stage, /<ProHero [^>]*odds=\{dist\}/);
  assert.match(stage, /const L = dist \? leaders\(dist\) : null;/);
  for (const f of ["app/components/opp/StageHero.tsx", "app/components/opp/ProHero.tsx", "app/forecast/[state]/[race]/page.tsx",
    "app/forecast/statewide/[st]/[office]/page.tsx", "app/forecast/legislatures/[st]/[chamber]/page.tsx", "app/forecast/measures/[st]/[slug]/page.tsx"]) {
    const s = read(f);
    assert.doesNotMatch(s, /100 - (n|favP|win)\b/, `${f} derives a chance as 100 minus another`);
    assert.doesNotMatch(s, /\b(win|lead)=\{/, `${f} still passes the old win/lead props`);
  }
  assert.match(read("app/forecast/[state]/[race]/page.tsx"), /const hero = raceHero\(r, m, ind\);/);
  assert.match(read("app/forecast/statewide/[st]/[office]/page.tsx"), /const hero = statewideHero\(r, v, m\);/);
  assert.match(read("app/forecast/legislatures/[st]/[chamber]/page.tsx"), /const hero = chamberHero\(c, DEM, GOP\);/);
});

test("Pro shows the ProHero and never the Theme stage; the hidden stage does not run its canvas", () => {
  const pro = read("app/components/opp/ProHero.tsx");
  assert.match(pro, /:root\[data-mode="themed"\] \.prh\{display:none\}/);
  assert.match(pro, /:root:not\(\[data-mode="themed"\]\) header\.sg\{display:none\}/);
  assert.doesNotMatch(pro.slice(pro.indexOf("PRO_HERO_CSS"), pro.indexOf("`;")), /gradient|--gold|#e7b341/i, "no gradients or gold in Pro");
  const px = read("app/components/opp/PixelStage.tsx");
  assert.match(px, /const themed = useSiteMode\(\) === "themed";/);
  assert.match(px, /useEffect\(\(\) => \{\n\s+if \(!themed\) return;/);
  assert.match(px, /\}, \[paths, fills, beam, side, focus, themed\]\);/);
  assert.match(read("app/components/opp/Ambient.tsx"), /themed/);
});
