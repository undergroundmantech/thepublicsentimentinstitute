// Phase 1: candidate identity, the forecast's two sides, and REPORTED results. Numbers in brackets are the acceptance
// tests of docs/05 in the overhaul package. Provider candidate lists marked "export" are the names, parties and counts
// in the operator's own civicAPI CSV exports of election night; they are used here only to check parsing and identity.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { assignSides, candidateId, matchToForecast, nameKey, partyCanon, principals, raceRule, reported, reportedFor, sideNames, sideTags, splitSides } from "../../app/results/2026/candidates";
import { expSides, isInd, legacySides, sides, type CCand, type XIndex, type XRace } from "../../app/results/2026/live";

const ix = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "../../public/results/2026/index.json"), "utf8")) as XIndex;
const race = (id: string) => { const r = ix.races.find((x) => x.id === id); assert.ok(r, `index has ${id}`); return r as XRace; };
const cv = (rows: [string, string, number][]): CCand[] => rows.map(([n, p, v]) => [n, p, v, 0, 0, null]);
const near = (a: number | null, b: number, eps = 1e-3) => assert.ok(a != null && Math.abs(a - b) <= eps, `${a} vs ${b}`);

// export, 2026-11-04T12:46Z
const NE = cv([["Pete  Ricketts", "Republican", 370411], ["Dan  Osborn", "Independent", 321218], ["Robin  Richards", "Nebraska Working People", 18937], ["Mike  Marvin", "Legal Marijuana Now", 15848], ["Chuck  Conboy", "America First", 8846]]);

test("[1] Nebraska Senate: Osborn (IND) is the forecast's side A; none of his votes fall into Other", () => {
  const r = race("sen-NE");
  assert.deepEqual((r.c ?? []).slice(0, 2).map((x) => [x[0], x[1]]), [["Dan Osborn", "IND"], ["Pete Ricketts", "R"]], "the frozen index is unchanged");
  const s = sides(r, NE);
  assert.equal(s.a, 321218, "Osborn's votes are side A"); assert.equal(s.b, 370411); assert.equal(s.o, 18937 + 15848 + 8846); assert.equal(s.t, 735260);
  assert.equal(isInd(r), true, "IND, I and Independent are one party label"); assert.deepEqual(sideTags(r), { a: "I", b: "R" });
  assert.deepEqual([sideNames(r).a.name, sideNames(r).b.name], ["Dan Osborn", "Pete Ricketts"]);
  const e = expSides(r); assert.equal(e.a, 382233); assert.equal(e.b, 367138);
  near((100 * (e.b - e.a)) / e.t, r.m as number, 0.06);                      // the index's own margin is these two candidates
  // the defect, reproduced by the comparison flag's code path: every Osborn vote was "other"
  const old = legacySides(r, NE); assert.equal(old.a, 0); assert.equal(old.o, 321218 + 18937 + 15848 + 8846);
});

test("[1] Nebraska Senate: reported top two, margin and denominator", () => {
  const rep = reportedFor(race("sen-NE"), NE);
  assert.equal(rep.status, "OK"); assert.equal(rep.leader?.name, "Pete  Ricketts"); assert.equal(rep.runnerUp?.name, "Dan  Osborn");
  assert.equal(rep.runnerUp?.party, "IND"); assert.equal(rep.runnerUp?.partyRaw, "Independent");
  assert.equal(rep.marginVotes, 49193); assert.equal(rep.totalVotes, 735260); near(rep.marginPp, (100 * 49193) / 735260, 1e-9);
  assert.equal(rep.partyMargin, null, "no Democrat is on the ballot, so there is no D-minus-R figure");
});

test("[2] the other independent-led forecasts read the same way: SD, ID, MT, and Rhode Island's D v I", () => {
  for (const id of ["sen-SD", "sen-ID", "sen-MT"]) { const r = race(id); assert.equal(isInd(r), true, id); const e = expSides(r); near((100 * (e.b - e.a)) / e.t, r.m as number, 0.06); }
  // Idaho: a second independent is not merged with the forecast's independent
  const id = splitSides(race("sen-ID"), cv([["Jim Risch", "Republican", 387374], ["Todd Achilles", "Independent", 230487], ["Natalie M Fleming", "Independent", 40000], ["Matt Loesby", "Libertarian", 27265]]));
  assert.equal(id.a, 230487); assert.equal(id.b, 387374); assert.equal(id.o, 67265);
  // Montana: the Democrat is third in the forecast, so she is "other", not the challenger
  const mt = splitSides(race("sen-MT"), cv([["Kurt Alme", "Republican", 201399], ["Seth Bodnar", "Independent", 159468], ["Alani Bankhead", "Democratic", 49813], ["Kyle Austin", "Libertarian", 7579]]));
  assert.equal(mt.a, 159468); assert.equal(mt.b, 201399); assert.equal(mt.o, 57392);
  // Rhode Island: the forecast's second principal is an independent, the Republican is third
  const ri = race("gov-RI"); assert.deepEqual(sideTags(ri), { a: "D", b: "I" });
  const s = splitSides(ri, cv([["Helena Buonanno Foulkes", "Democratic", 202877], ["Kenneth Block", "Independent", 98586], ["Aaron C. Guckian", "Republican", 46656], ["C. D. Reynolds", "Independent", 4740]]));
  assert.equal(s.a, 202877); assert.equal(s.b, 98586, "Block, matched by name"); assert.equal(s.o, 51396, "the Republican and the other independent");
});

test("[2] reported top two is by votes, never by party: I v I, D v D, R v R, D v I, R v I", () => {
  const top = (rows: [string, string, number][]) => { const r = reported("t", rows.map(([name, party, votes]) => ({ name, party, votes }))); return [r.leader?.name, r.runnerUp?.name, r.marginVotes]; };
  assert.deepEqual(top([["A One", "Independent", 40], ["B Two", "I", 60], ["C Dem", "Democratic", 10]]), ["B Two", "A One", 20]);
  assert.deepEqual(top([["A Dem", "Democratic", 55], ["B Dem", "D", 45]]), ["A Dem", "B Dem", 10]);
  assert.deepEqual(top([["A Rep", "Republican", 30], ["B Rep", "GOP", 70], ["C Dem", "Democratic", 20]]), ["B Rep", "A Rep", 40]);
  assert.deepEqual(top([["A Dem", "D", 48], ["B Ind", "NPA", 52]]), ["B Ind", "A Dem", 4]);
  assert.deepEqual(top([["A Rep", "R", 51], ["B Ind", "Unaffiliated", 49], ["C Dem", "D", 1]]), ["A Rep", "B Ind", 2]);
  // two candidates of one party are two candidates
  const dd = reported("t", [{ name: "A Dem", party: "D", votes: 55 }, { name: "B Dem", party: "Democratic", votes: 45 }]);
  assert.notEqual(dd.candidates[0].id, dd.candidates[1].id); assert.equal(dd.partyMargin, null);
});

test("[2] party labels: spellings collapse, a blank party is unknown (not 'other'), party never changes identity", () => {
  for (const s of ["D", "Dem", "Democratic", "democratic-farmer-labor", "DFL"]) assert.equal(partyCanon(s), "D", s);
  for (const s of ["R", "GOP", "Republican"]) assert.equal(partyCanon(s), "R", s);
  for (const s of ["I", "IND", "Independent", "NPA", "Unaffiliated", "No Party Affiliation"]) assert.equal(partyCanon(s), "IND", s);
  assert.equal(partyCanon("Libertarian"), "LIB"); assert.equal(partyCanon("Legal Marijuana Now"), "OTH"); assert.equal(partyCanon("Nonpartisan"), "NP");
  assert.equal(partyCanon(""), null); assert.equal(partyCanon(null), null); assert.equal(partyCanon("  "), null);
  assert.equal(candidateId("sen-NE", "Pete  Ricketts"), candidateId("sen-NE", "PETE RICKETTS"), "spacing and case");
  assert.equal(candidateId("sen-NE", "José Peña Jr."), candidateId("sen-NE", "Jose Pena"), "accents and suffix");
  assert.equal(candidateId("x", "Dan Osborn", null, { "daniel osborn": "dan osborn" }), candidateId("x", "Daniel Osborn", null, { "daniel osborn": "dan osborn" }), "a spelling change goes through the crosswalk");
  assert.equal(candidateId("x", "Anything", 4411), "up:4411", "the provider's own id wins when it sends one");
  assert.notEqual(nameKey("Dan S. Sullivan"), nameKey("Dan J. Sullivan"), "middle initials are kept");
  const a = reported("r", [{ name: "Pat Lee", party: "Independent", votes: 5 }, { name: "Sam Roe", party: "D", votes: 3 }]);
  const b = reported("r", [{ name: "Pat Lee", party: "Republican", votes: 5 }, { name: "Sam Roe", party: "D", votes: 3 }]);
  assert.equal(a.candidates[0].id, b.candidates[0].id, "a party change does not make a new candidate");
});

test("[2] same-surname candidates are never merged, and an unresolvable name is flagged, not guessed", () => {
  // Nevada governor (export): the old code added Danielle Ford's votes to Aaron Ford's
  const nv = cv([["Aaron Ford", "Democratic", 506653], ["Joe Lombardo", "Republican", 432732], ["Danielle Ford", "No Political Party", 26666], ["None of These Candidates", "", 13997]]);
  const s = splitSides(race("gov-NV"), nv); assert.equal(s.a, 506653); assert.equal(s.b, 432732); assert.equal(s.o, 40663); assert.equal(s.ambiguous, 0);
  assert.equal(legacySides(race("gov-NV"), nv).a, 506653 + 26666, "the defect: a surname match merged two people");
  // Idaho 1st (export): "Sarah Zabel Peterson" is not Kaylee Peterson
  const idh = splitSides(race("house-ID-01"), cv([["Russ Fulcher", "Republican", 235536], ["Kaylee Peterson", "Democratic", 104452], ["Sarah Zabel Peterson", "Independent", 22050], ["Brendan Gomez", "Constitution", 3318]]));
  assert.equal(idh.a, 104452); assert.equal(idh.o, 25368);
  // two people one name cannot tell apart: flagged as ambiguous, never guessed
  const m = matchToForecast(["Mary Poole", "Sam A. Rivers", "Sam B. Rivers"], ["Mary Poole", "Sam Rivers", "Samuel B. Jr. Rivers"]);
  assert.deepEqual(m.match, [0, null, null]); assert.deepEqual(m.ambiguous, [1, 2]);
  // Alaska Senate had exactly that (the forecast's Dan S. and Dan J. Sullivan; civicAPI's "Dan Sullivan" and "Daniel J. Jr.
  // Sullivan"). The spelling table (DEFAULT_ALIASES) resolves it, so the senator's votes are his own
  const akm = matchToForecast(["Mary Peltola", "Dan S. Sullivan", "Dan J. Sullivan"], ["Mary Peltola", "Dan Sullivan", "Daniel J. Jr. Sullivan"]);
  assert.deepEqual(akm.match, [0, 1, 2]); assert.deepEqual(akm.ambiguous, []);
  const ak = splitSides(race("sen-AK"), cv([["Mary Peltola", "Democratic", 102898], ["Dan Sullivan", "Republican", 107189], ["Daniel J. Jr. Sullivan", "Nonpartisan", 3590]]));
  assert.equal(ak.a, 102898); assert.equal(ak.b + ak.o, 107189 + 3590); assert.ok(ak.b >= 107189); assert.equal(ak.ambiguous, 0);
  // unique nickname and middle-name variants still match
  assert.deepEqual(matchToForecast(["Pat Moore", "Michael Echols"], ['Patricia "Pat" Moore', "Michael Echols"]).match, [0, 1]);
});

test("[2] 3+ candidates, write-ins and blank parties", () => {
  const r = reported("t", [{ name: "A", party: "D", votes: 400 }, { name: "B", party: "R", votes: 380 }, { name: "C", party: "Green", votes: 150 }, { name: "Write-in", party: "", votes: 70 }, { name: "None of These Candidates", party: null, votes: 0 }]);
  assert.equal(r.status, "OK"); assert.equal(r.totalVotes, 1000); near(r.marginPp, 2.0, 1e-9);
  assert.equal(r.candidates.find((x) => x.name === "Write-in")?.pooled, true); assert.equal(r.candidates.find((x) => x.name === "Write-in")?.party, null);
  near(r.candidates.reduce((s, x) => s + (x.share ?? 0), 0), 100, 1e-9);
});

test("[3] a third candidate at 8%: the margin is over ALL counted votes; the D-R figure carries both denominators", () => {
  const r = reported("t", [{ name: "Dana", party: "Democratic", votes: 470 }, { name: "Ray", party: "Republican", votes: 450 }, { name: "Indy", party: "Independent", votes: 80 }]);
  near(r.marginPp, 2.0, 1e-9);                                                          // 20 / 1000, not 20 / 920
  assert.deepEqual([r.partyMargin?.dVotes, r.partyMargin?.rVotes], [470, 450]);
  near(r.partyMargin?.ppOfAllVotes ?? null, 2.0, 1e-9); near(r.partyMargin?.ppOfTwoParty ?? null, (100 * 20) / 920, 1e-9);
});

test("[4] unknown is not zero: fewer than two known counts is UNAVAILABLE, two known zeros is NO_VOTES", () => {
  assert.equal(reported("t", []).status, "UNAVAILABLE");
  const one = reported("t", [{ name: "A", party: "D", votes: 100 }, { name: "B", party: "R", votes: null }]);
  assert.equal(one.status, "UNAVAILABLE"); assert.equal(one.marginVotes, null); assert.equal(one.marginPp, null); assert.equal(one.unknownCounts, 1); assert.equal(one.totalVotes, 100);
  assert.match(one.reason ?? "", /Only one candidate/);
  const zero = reported("t", [{ name: "A", party: "D", votes: 100 }, { name: "B", party: "R", votes: 0 }]);
  assert.equal(zero.status, "OK", "a reported 0 is a count"); assert.equal(zero.marginVotes, 100);
  assert.equal(reported("t", [{ name: "A", party: "D", votes: 0 }, { name: "B", party: "R", votes: 0 }]).status, "NO_VOTES");
  const tie = reported("t", [{ name: "A", party: "D", votes: 50 }, { name: "B", party: "R", votes: 50 }]);
  assert.equal(tie.tie, true); assert.equal(tie.marginVotes, 0); assert.equal(tie.marginPp, 0); assert.equal(tie.leader?.name, "A", "ties keep the provider's order");
  for (const bad of [-5, NaN, Infinity]) assert.equal(reported("t", [{ name: "A", votes: bad }, { name: "B", votes: 9 }]).status, "UNAVAILABLE", `a ${bad} count is unknown, never votes`);
});

test("[5] a corrected, lower count is reported as corrected: nothing is smoothed or carried over", () => {
  const before = reported("t", [{ name: "A", party: "D", votes: 500 }, { name: "B", party: "R", votes: 480 }]);
  const after = reported("t", [{ name: "A", party: "D", votes: 460 }, { name: "B", party: "R", votes: 480 }]);
  assert.equal(before.leader?.name, "A"); assert.equal(after.leader?.name, "B"); assert.equal(after.marginVotes, 20); assert.equal(after.totalVotes, 940);
  assert.equal(before.candidates[0].id, after.candidates[1].id, "same candidate, same id, across the correction");
  assert.deepEqual(reported("t", [{ name: "A", party: "D", votes: 460 }, { name: "B", party: "R", votes: 480 }]), after, "a pure function of the snapshot: the same input gives the same output");
});

test("[7] measures, multi-seat contests, ranked choice and runoff states get their own handling", () => {
  const fl = { id: "m", k: "measure", st: "FL", nm: "", off: "", thr: 0.6, civ: {} } as XRace;
  const m = reportedFor(fl, cv([["Yes", "", 590], ["No", "", 410]]));
  assert.equal(m.rule, "measure"); assert.equal(m.status, "OK"); near(m.measure?.yesShare ?? null, 0.59, 1e-9); assert.equal(m.measure?.passing, false, "59% does not pass a 60% measure");
  assert.match(m.caveat ?? "", /needs 60% Yes/); assert.equal(m.partyMargin, null);
  assert.equal(reportedFor({ ...fl, thr: 0.5 }, cv([["Yes", "", 501], ["No", "", 499]])).measure?.passing, true);
  assert.deepEqual(splitSides(fl, cv([["Yes", "", 590], ["No", "", 410]])), { a: 590, b: 410, o: 0, t: 1000, ambiguous: 0, sameParty: 0 });
  const leg = ix.races.find((x) => x.k === "leg") as XRace;
  assert.equal(raceRule(leg), "multi_seat"); assert.equal(reportedFor(leg, cv([["Democrats", "Democratic", 10], ["Republicans", "Republican", 12]])).status, "NOT_APPLICABLE");
  assert.equal(raceRule(race("edb-MI-state-board-of-education")), "multi_seat", "a two-seat board listed as party slates");
  assert.equal(principals(race("edb-MI-state-board-of-education")).mode, "party");
  assert.equal(raceRule(race("sen-AK")), "ranked_choice"); assert.match(reportedFor(race("sen-AK"), cv([["Mary Peltola", "Democratic", 48], ["Dan Sullivan", "Republican", 46], ["X", "Republican", 6]])).caveat ?? "", /first-choice/);
  const ga = race("sen-GA"); assert.equal(raceRule(ga), "majority_runoff");
  assert.match(reportedFor(ga, cv([["A", "Democratic", 49], ["B", "Republican", 48], ["C", "Libertarian", 3]])).caveat ?? "", /runoff is possible/);
  assert.equal(reportedFor(ga, cv([["A", "Democratic", 52], ["B", "Republican", 48]])).caveat, null);
  assert.equal(raceRule(race("sen-NE")), "plurality");
});

test("the forecast's sides are its first two candidates: checked against every race's own published margin", () => {
  let checked = 0;
  for (const r of ix.races) {
    if (!["sen", "gov", "house"].includes(r.k) || r.m == null || principals(r).mode !== "candidate") continue;
    const e = expSides(r); if (!e.t) continue;
    near((100 * (e.b - e.a)) / (r.tot || e.t), r.m, 0.5); checked++;
  }
  assert.ok(checked > 450, `${checked} races checked`);
});

test("major-party pooling is flagged, limited to D and R, and legislative districts with a missing name still read by party", () => {
  // Louisiana 5th (export): three Republicans; the forecast names one
  const la = race("house-LA-05");
  const c = cv([['Patricia "Pat" Moore', "Democratic", 40789], ["Gabe Firment", "Republican", 60000], ["Misti Cordell", "Republican", 50815], ["Michael Echols", "Republican", 32902]]);
  const s = splitSides(la, c); assert.equal(s.a, 40789); assert.equal(s.b, 143717); assert.equal(s.sameParty, 110815, "the two unnamed Republicans are flagged");
  assert.deepEqual(assignSides(la, c).pooled, [false, true, true, false]);
  const rep = reportedFor(la, c); assert.equal(rep.leader?.name, "Gabe Firment"); assert.equal(rep.runnerUp?.name, "Misti Cordell", "the reported top two are two Republicans");
  const dist = { id: "leg-x", k: "sen", st: "XX", nm: "", off: "", c: [["", "D", 0], ["Rae Rep", "R", 0]], civ: {} } as XRace;
  assert.deepEqual(sides(dist, cv([["Dee Dem", "Democratic", 40], ["Rae Rep", "Republican", 60]])), { a: 40, b: 60, o: 0, t: 100 });
});
