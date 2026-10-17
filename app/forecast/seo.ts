// Search metadata and structured data for every forecast page, written from the model output so
// the title, the description and the Dataset record always carry the current numbers.
import type { Metadata } from "next";
import { getModel, isInd, type FRace } from "@/app/lib/forecastData";
import { raceHref, STATE_NAME } from "@/app/lib/opp";
import { crumbsLd, datasetLd, graph, pageLd, seo } from "@/app/lib/seo";
import { dbHref, getDownballot, type DBRace } from "./statewide/data";
import { getStatehouse, slHref, type SLChamber } from "./legislatures/data";
import { bmHref, getMeasures, type Measure } from "./measures/data";

const pc = (p: number) => (p > 0.99 ? "more than 99%" : p < 0.01 ? "less than 1%" : `${Math.round(p * 100)}%`);
/** "a 61%" or "an 80%", read the way the number is spoken. */
const aPc = (p: number) => { const t = pc(p); return /^(8|11%|18%)/.test(t) ? `an ${t}` : `a ${t}`; };
const day = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const pts = (m: number) => Math.abs(m).toFixed(1);

// ---------- federal and governor races ----------

function raceWords(r: FRace) {
  const office = r.office === "senate" ? "Senate" : r.office === "governor" ? "governor" : "House";
  const where = r.office === "house" ? `${r.name} District` : `${r.state} ${office}`;
  const m = r.stages.rate;
  const pR = r.est?.prob ?? 0;
  const ind = isInd(r);
  const uncontested = Math.abs(m) >= 99;
  const leader = m < 0 ? r.dem : r.gop;
  const trailer = m < 0 ? r.gop : r.dem;
  const pLead = m < 0 ? 1 - pR : pR;
  const tag = (name: string) => (name === r.dem ? (ind ? "independent" : "Democrat") : "Republican");
  return { office, where, m, pR, ind, uncontested, leader, trailer, pLead, tag };
}

export function raceMeta(r: FRace): Metadata {
  const w = raceWords(r);
  const updated = getModel().meta.updated;
  const title = w.uncontested ? `${w.where} 2026 forecast: ${w.leader} unopposed` : `${w.where} forecast 2026: ${r.dem} vs ${r.gop}`;
  const description = w.uncontested
    ? `${w.leader} faces no major party opponent in the 2026 ${w.where} race. The On Point Politics forecast, county results and history, updated ${day(updated)}.`
    : `${w.tag(w.leader)} ${w.leader} has ${aPc(w.pLead)} chance to win the 2026 ${w.where} race against ${w.trailer} in the On Point Politics forecast, with a projected margin of ${pts(w.m)} points. County by county simulations, ratings and every poll, updated ${day(updated)}.`;
  return seo({ ownImage: true, title, description, path: raceHref(r.id), modified: updated, keywords: [`${w.where} race 2026`, `${w.where} polls`, r.dem, r.gop, `${r.state} election 2026`] });
}

export function raceLd(r: FRace) {
  const w = raceWords(r);
  const updated = getModel().meta.updated;
  const path = raceHref(r.id);
  const d = w.uncontested
    ? `Forecast for the 2026 ${w.where} race, where ${w.leader} is unopposed by a major party.`
    : `Forecast for the 2026 ${w.where} race between ${r.dem} and ${r.gop}. ${w.leader} wins ${pc(w.pLead)} of ${getModel().meta.sims.toLocaleString()} simulated elections with a projected margin of ${pts(w.m)} points.`;
  const section: [string, string] = r.office === "house" ? ["House", "/forecast?office=house"] : r.office === "senate" ? ["Senate", "/forecast?office=senate"] : ["Governor", "/forecast?office=governor"];
  return graph(
    crumbsLd([["Home", "/"], ["Forecast", "/forecast"], section, [w.where, path]]),
    pageLd({ name: `${w.where} forecast 2026`, description: d, path, modified: updated, about: "dataset" }),
    datasetLd({
      name: `${w.where} 2026 election forecast`, description: d, path, modified: updated, place: r.state,
      keywords: [`${w.where} 2026`, r.dem, r.gop, "election forecast", "win probability"],
      measured: ["Win probability", "Projected vote margin", "County simulated margin"], file: "/forecast/model.json",
    }),
  );
}

// ---------- statewide down ballot offices ----------

export function dbMeta(r: DBRace): Metadata {
  const updated = getDownballot().meta.updated;
  const office = r.officeLabel.toLowerCase();
  const pD = 1 - r.est.prob;
  const lead = r.est.margin < 0 ? r.dem : r.gop;
  const trail = r.est.margin < 0 ? r.gop : r.dem;
  const pLead = r.est.margin < 0 ? pD : 1 - pD;
  const title = r.uncontested ? `${r.state} ${office} 2026: uncontested` : `${r.state} ${office} forecast 2026: ${r.dem} vs ${r.gop}`;
  const description = r.uncontested || !lead || !trail
    ? `The 2026 ${r.state} ${office} race is uncontested. On Point Politics forecast page with results history.`
    : `${lead} has ${aPc(pLead)} chance to win the 2026 ${r.state} ${office} race against ${trail}, with a projected margin of ${pts(r.est.margin)} points. County by county On Point Politics forecast, updated ${day(updated)}.`;
  return seo({ ownImage: true, title, description, path: dbHref(r), modified: updated, keywords: [`${r.state} ${office} 2026`, r.dem ?? "", r.gop ?? ""].filter(Boolean) });
}

export function dbLd(r: DBRace) {
  const updated = getDownballot().meta.updated;
  const office = r.officeLabel.toLowerCase();
  const path = dbHref(r);
  const d = r.uncontested ? `The 2026 ${r.state} ${office} race, uncontested.` : `County by county forecast for the 2026 ${r.state} ${office} race between ${r.dem} and ${r.gop}, from the On Point Politics model.`;
  return graph(
    crumbsLd([["Home", "/"], ["Forecast", "/forecast"], ["Statewide offices", "/forecast/statewide"], [`${r.state} ${office}`, path]]),
    pageLd({ name: `${r.state} ${office} forecast 2026`, description: d, path, modified: updated, about: "dataset" }),
    datasetLd({ name: `${r.state} ${office} 2026 election forecast`, description: d, path, modified: updated, place: r.state, measured: ["Win probability", "Projected vote margin"], file: "/forecast/downballot.json" }),
  );
}

// ---------- state legislative chambers ----------

export function chamberMeta(c: SLChamber): Metadata {
  const updated = getStatehouse().meta.updated;
  const fav = c.demControl >= c.gopControl ? "Democrats" : "Republicans";
  const p = Math.max(c.demControl, c.gopControl);
  const title = `${c.name} forecast 2026: odds of control`;
  const description = `${fav} have ${aPc(p)} chance to control the ${c.name} after the 2026 election in the On Point Politics forecast. District by district odds for all ${c.up} seats on the ballot, a seat map and the 80% range of ${c.p10} to ${c.p90} Democratic seats, updated ${day(updated)}.`;
  return seo({ ownImage: true, title, description, path: slHref(c), modified: updated, keywords: [`${c.name} 2026`, `${c.state} legislature election 2026`, "state legislative forecast"] });
}

export function chamberLd(c: SLChamber) {
  const updated = getStatehouse().meta.updated;
  const path = slHref(c);
  const d = `District by district forecast for the 2026 ${c.name} election: chance of Democratic control ${pc(c.demControl)}, Republican control ${pc(c.gopControl)}, ${c.up} of ${c.seats} seats on the ballot.`;
  return graph(
    crumbsLd([["Home", "/"], ["Forecast", "/forecast"], ["State legislatures", "/forecast/legislatures"], [c.name, path]]),
    pageLd({ name: `${c.name} forecast 2026`, description: d, path, modified: updated, about: "dataset" }),
    datasetLd({ name: `${c.name} 2026 forecast`, description: d, path, modified: updated, place: c.state, measured: ["Chance of chamber control", "District win probability", "Projected seats"], file: "/forecast/statehouse.json" }),
  );
}

// ---------- ballot measures ----------

export function measureMeta(m: Measure): Metadata {
  const updated = getMeasures().meta.updated;
  const st = STATE_NAME[m.st] ?? m.st;
  const title = `${st} ${m.label} 2026 forecast: will it pass?`;
  const description = `${st} ${m.label}, ${m.title}: On Point Politics gives it ${aPc(m.est.prob)} chance to pass, with Yes projected at ${m.est.yes.toFixed(1)}% against the ${Math.round(m.threshold * 1000) / 10}% it needs. County by county forecast and every poll, updated ${day(updated)}.`;
  return seo({ ownImage: true, title, description, path: bmHref(m), modified: updated, keywords: [`${st} ${m.label}`, `${st} ballot measures 2026`, m.title] });
}

export function measureLd(m: Measure) {
  const updated = getMeasures().meta.updated;
  const st = STATE_NAME[m.st] ?? m.st;
  const path = bmHref(m);
  const d = `County by county forecast for ${st} ${m.label}, ${m.title}, on the November 3, 2026 ballot. Chance to pass ${pc(m.est.prob)}; projected Yes ${m.est.yes.toFixed(1)}%.`;
  return graph(
    crumbsLd([["Home", "/"], ["Forecast", "/forecast"], ["Ballot measures", "/forecast/measures"], [`${st} ${m.label}`, path]]),
    pageLd({ name: `${st} ${m.label} forecast`, description: d, path, modified: updated, about: "dataset" }),
    datasetLd({ name: `${st} ${m.label} 2026 ballot measure forecast`, description: d, path, modified: updated, place: st, measured: ["Chance to pass", "Projected Yes share", "County Yes share"], file: "/forecast/measures.json" }),
  );
}

// ---------- section pages ----------

export function hubNumbers() {
  const model = getModel();
  const ch = model.chambers;
  const sl = getStatehouse();
  const ms = getMeasures();
  const favD = sl.chambers.filter((c) => c.demControl > c.gopControl).length;
  const pass = ms.measures.filter((m) => m.est.prob > 0.5).length;
  return { model, ch, sl, ms, favD, pass, updated: model.meta.updated };
}

export function hubMeta(): Metadata {
  const { ch, sl, ms, favD, pass, updated } = hubNumbers();
  const senD = ch.senate.demControl >= 0.5, houseD = ch.house.demControl >= 0.5;
  const sen = senD ? `Democrats have ${aPc(ch.senate.demControl)} chance to win the Senate` : `Republicans have ${aPc(ch.senate.gopControl)} chance to hold the Senate`;
  const houseTail = houseD ? `${aPc(ch.house.demControl)} chance to win the House` : `${aPc(ch.house.gopControl)} chance to hold the House`;
  const house = senD === houseD ? houseTail : `${houseD ? "Democrats" : "Republicans"} have ${houseTail}`;
  return seo({ ownImage: true,
    title: "2026 midterm election forecast: Senate, House and governors",
    description: `${sen} and ${house} in the On Point Politics 2026 midterm forecast, updated ${day(updated)}. Every governor race, all ${sl.chambers.length} state legislative chambers with Democrats favored in ${favD}, and ${ms.measures.length} ballot measures with ${pass} favored to pass.`,
    path: "/forecast",
    modified: updated,
    keywords: ["2026 midterm forecast", "2026 Senate forecast", "2026 House forecast", "2026 governor forecast", "who will win the Senate 2026", "who will win the House 2026"],
  });
}

export function hubLd() {
  const { ch, updated } = hubNumbers();
  const d = `The On Point Politics 2026 midterm forecast: chance of Democratic control of the Senate ${pc(ch.senate.demControl)}, of the House ${pc(ch.house.demControl)}, with an average of ${ch.senate.demSeats.toFixed(0)} Democratic Senate seats and ${ch.house.demSeats.toFixed(0)} Democratic House seats across ${getModel().meta.sims.toLocaleString()} simulations.`;
  return graph(
    crumbsLd([["Home", "/"], ["Forecast", "/forecast"]]),
    pageLd({ name: "2026 midterm election forecast", description: d, path: "/forecast", modified: updated, about: "dataset" }),
    datasetLd({
      name: "2026 midterm election forecast", description: d, path: "/forecast", modified: updated,
      keywords: ["2026 midterms", "Senate forecast", "House forecast", "governor forecast", "election model"],
      measured: ["Chance of Senate control", "Chance of House control", "Race win probability", "Projected vote margin"], file: "/forecast/model.json",
    }),
  );
}

export function legislaturesMeta(): Metadata {
  const sl = getStatehouse();
  const favD = sl.chambers.filter((c) => c.demControl > c.gopControl).length;
  return seo({ ownImage: true,
    title: "2026 state legislative forecast: every chamber, every district",
    description: `District by district On Point Politics forecasts for all ${sl.chambers.length} partisan state legislative chambers on the 2026 ballot, ${sl.meta.seatsUp.toLocaleString()} seats in all. Democrats are favored to control ${favD} chambers and Republicans ${sl.chambers.length - favD}. Updated ${day(sl.meta.updated)}.`,
    path: "/forecast/legislatures",
    modified: sl.meta.updated,
    keywords: ["state legislature forecast 2026", "state house forecast", "state senate forecast", "legislative elections 2026"],
  });
}

export function legislaturesLd() {
  const sl = getStatehouse();
  const d = `Forecasts for all ${sl.chambers.length} partisan state legislative chambers on the 2026 ballot, ${sl.meta.seatsUp.toLocaleString()} seats in ${sl.meta.districts.toLocaleString()} districts, each simulated ${sl.meta.sims.toLocaleString()} times.`;
  return graph(
    crumbsLd([["Home", "/"], ["Forecast", "/forecast"], ["State legislatures", "/forecast/legislatures"]]),
    pageLd({ name: "2026 state legislative forecast", description: d, path: "/forecast/legislatures", modified: sl.meta.updated, about: "dataset", type: "CollectionPage" }),
    datasetLd({ name: "2026 state legislative forecast", description: d, path: "/forecast/legislatures", modified: sl.meta.updated, measured: ["Chance of chamber control", "District win probability"], file: "/forecast/statehouse.json" }),
    { "@type": "ItemList", name: "State legislative chambers", numberOfItems: sl.chambers.length, itemListElement: sl.chambers.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, url: `https://onpointpolitics.com${slHref(c)}` })) },
  );
}

export function measuresMeta(): Metadata {
  const ms = getMeasures();
  const pass = ms.measures.filter((m) => m.est.prob > 0.5).length;
  return seo({ ownImage: true,
    title: "2026 ballot measure forecast: every statewide question",
    description: `County by county On Point Politics forecasts for all ${ms.measures.length} statewide ballot measures in ${ms.meta.states} states on the November 3, 2026 ballot, with the chance each one passes. ${pass} are favored to pass. Updated ${day(ms.meta.updated)}.`,
    path: "/forecast/measures",
    modified: ms.meta.updated,
    keywords: ["ballot measures 2026", "2026 ballot initiatives", "constitutional amendments 2026", "ballot measure forecast"],
  });
}

export function measuresLd() {
  const ms = getMeasures();
  const d = `Forecasts for ${ms.measures.length} statewide ballot measures on the November 3, 2026 ballot, with a chance to pass and a projected Yes share for each, county by county.`;
  return graph(
    crumbsLd([["Home", "/"], ["Forecast", "/forecast"], ["Ballot measures", "/forecast/measures"]]),
    pageLd({ name: "2026 ballot measure forecast", description: d, path: "/forecast/measures", modified: ms.meta.updated, about: "dataset", type: "CollectionPage" }),
    datasetLd({ name: "2026 ballot measure forecast", description: d, path: "/forecast/measures", modified: ms.meta.updated, measured: ["Chance to pass", "Projected Yes share"], file: "/forecast/measures.json" }),
    { "@type": "ItemList", name: "Statewide ballot measures", numberOfItems: ms.measures.length, itemListElement: ms.measures.map((m, i) => ({ "@type": "ListItem", position: i + 1, name: `${STATE_NAME[m.st] ?? m.st} ${m.label}: ${m.title}`, url: `https://onpointpolitics.com${bmHref(m)}` })) },
  );
}

export function statewideLd() {
  const db = getDownballot();
  const d = `County by county forecasts for ${db.races.length} statewide down ballot races in 2026: lieutenant governor, attorney general, secretary of state, treasurer, auditor and more.`;
  return graph(
    crumbsLd([["Home", "/"], ["Forecast", "/forecast"], ["Statewide offices", "/forecast/statewide"]]),
    pageLd({ name: "2026 statewide offices forecast", description: d, path: "/forecast/statewide", modified: db.meta.updated, about: "dataset", type: "CollectionPage" }),
    datasetLd({ name: "2026 statewide offices forecast", description: d, path: "/forecast/statewide", modified: db.meta.updated, measured: ["Win probability", "Projected vote margin"], file: "/forecast/downballot.json" }),
  );
}

export function methodologyLd() {
  const updated = getModel().meta.updated;
  return graph(
    crumbsLd([["Home", "/"], ["Forecast", "/forecast"], ["Methodology", "/forecast/methodology"]]),
    {
      "@type": "TechArticle",
      "@id": "https://onpointpolitics.com/forecast/methodology#article",
      headline: "How the On Point Politics 2026 forecast works",
      description: "Fundamentals, the polling average, candidate effects, 2,000 correlated simulations, county and district models, and how chamber odds and ratings are set.",
      url: "https://onpointpolitics.com/forecast/methodology",
      dateModified: `${updated}T08:00:00-04:00`,
      author: { "@id": "https://onpointpolitics.com/#organization" },
      publisher: { "@id": "https://onpointpolitics.com/#organization" },
      isPartOf: { "@id": "https://onpointpolitics.com/#website" },
      about: ["Election forecasting", "Polling average", "Monte Carlo simulation"],
      inLanguage: "en-US",
      image: "https://onpointpolitics.com/opengraph-image.png",
    },
  );
}
