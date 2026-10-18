// Builds /llms.txt and /llms-full.txt from the live model output. Plain text, written to be quoted:
// every number names its page, and every page is a full URL.
import { getModel, isInd, type FRace } from "@/app/lib/forecastData";
import { fmtM, raceHref, STATE_NAME } from "@/app/lib/opp";
import { SITE } from "@/app/lib/seo";
import { AGGREGATES } from "@/app/_polling/lib/aggregates";
import { avgSummary } from "@/app/polls/seo";
import { dbHref, getDownballot } from "@/app/forecast/statewide/data";
import { currentMajority, getStatehouse, slHref } from "@/app/forecast/legislatures/data";
import { bmHref, getMeasures } from "@/app/forecast/measures/data";

const U = (p: string) => `${SITE.url}${p}`;
const pc = (p: number) => (p > 0.99 ? "more than 99%" : p < 0.01 ? "less than 1%" : `${Math.round(p * 100)}%`);
const day = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const n1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

function raceLine(r: FRace) {
  const m = r.stages.rate;
  const pR = r.est?.prob ?? 0;
  const where = r.office === "house" ? `${r.name} District` : r.office === "senate" ? r.name : `${r.state} governor`;
  if (Math.abs(m) >= 99) return `* ${where}: ${m < 0 ? r.dem : r.gop} unopposed by a major party. ${U(raceHref(r.id))}`;
  const dLead = m < 0;
  const lead = dLead ? r.dem : r.gop, trail = dLead ? r.gop : r.dem;
  const party = dLead ? (isInd(r) ? "independent" : "Democrat") : "Republican";
  return `* ${where}: ${lead}, ${party}, ${pc(dLead ? 1 - pR : pR)} to win against ${trail}; projected margin ${fmtM(m, isInd(r))}. ${U(raceHref(r.id))}`;
}

const closeness = (r: FRace) => Math.abs(0.5 - (r.est?.prob ?? 0));

export function llmsText(full: boolean): string {
  const model = getModel();
  const { chambers: ch, races, meta } = model;
  const sl = getStatehouse();
  const ms = getMeasures();
  const db = getDownballot();
  const favD = sl.chambers.filter((c) => c.demControl > c.gopControl).length;
  const pass = ms.measures.filter((m) => m.est.prob > 0.5).length;
  const gb = avgSummary(AGGREGATES.find((d) => d.id === "generic-ballot")!);
  const ap = avgSummary(AGGREGATES.find((d) => d.id === "trump-approval")!);
  const L: string[] = [];
  const h = (t: string) => L.push("", `## ${t}`, "");

  L.push(
    `# ${SITE.name}`,
    "",
    `> ${SITE.name} publishes the 2026 midterm election forecast, daily polling averages and live election night results for the United States: the Senate, the House, all 36 governor races, statewide down ballot offices, every partisan state legislative chamber and every statewide ballot measure. Polling and research come from On Point Polling, formerly The Public Sentiment Institute or TPSI, the polling arm behind the site.`,
    "",
    `Forecast updated ${day(meta.updated)}. Election day is November 3, 2026, ${meta.daysOut} days after this update. Every forecast number below comes from ${meta.sims.toLocaleString()} correlated simulations of the election.`,
  );

  h("The 2026 forecast right now");
  L.push(
    `* Senate: Democrats win control in ${pc(ch.senate.demControl)} of simulations and Republicans in ${pc(ch.senate.gopControl)}. Average outcome ${ch.senate.demSeats.toFixed(0)} Democratic seats to ${ch.senate.gopSeats.toFixed(0)} Republican. ${U("/forecast?office=senate")}`,
    `* House: Democrats win control in ${pc(ch.house.demControl)} of simulations and Republicans in ${pc(ch.house.gopControl)}. Average outcome ${ch.house.demSeats.toFixed(0)} Democratic seats to ${ch.house.gopSeats.toFixed(0)} Republican; 218 is a majority. ${U("/forecast?office=house")}`,
    `* Governors: Democrats average ${ch.governor.demSeats.toFixed(0)} of 50 governorships after the election and win a majority of them in ${pc(ch.governor.demControl)} of simulations. ${U("/forecast?office=governor")}`,
    `* State legislatures: ${sl.chambers.length} partisan chambers and ${sl.meta.seatsUp.toLocaleString()} seats are on the ballot. Democrats are favored to control ${favD} chambers and Republicans ${sl.chambers.length - favD}. ${U("/forecast/legislatures")}`,
    `* Ballot measures: ${ms.measures.length} statewide measures in ${ms.meta.states} states; ${pass} are favored to pass. ${U("/forecast/measures")}`,
  );
  if (gb.a != null && gb.b != null) L.push(`* Generic congressional ballot average: Democrats ${n1(gb.a)}%, Republicans ${n1(gb.b)}%${gb.updated ? ` as of ${day(gb.updated)}` : ""}, from ${gb.polls} polls. ${U(gb.path)}`);
  if (ap.a != null && ap.b != null) L.push(`* Donald Trump job approval average: ${n1(ap.a)}% approve, ${n1(ap.b)}% disapprove${ap.updated ? ` as of ${day(ap.updated)}` : ""}, from ${ap.polls} polls. ${U(ap.path)}`);

  const sen = races.filter((r) => r.office === "senate");
  const gov = races.filter((r) => r.office === "governor");
  const house = races.filter((r) => r.office === "house");

  if (!full) {
    h("Closest Senate races");
    [...sen].sort((a, b) => closeness(a) - closeness(b)).slice(0, 12).forEach((r) => L.push(raceLine(r)));
    h("Closest governor races");
    [...gov].sort((a, b) => closeness(a) - closeness(b)).slice(0, 10).forEach((r) => L.push(raceLine(r)));
    h("Closest House races");
    [...house].filter((r) => Math.abs(r.stages.rate) < 99).sort((a, b) => closeness(a) - closeness(b)).slice(0, 15).forEach((r) => L.push(raceLine(r)));
    h("State legislative chambers in play");
    [...sl.chambers].filter((c) => c.demControl > 0.1 && c.demControl < 0.9).sort((a, b) => Math.abs(a.demControl - 0.5) - Math.abs(b.demControl - 0.5))
      .forEach((c) => L.push(`* ${c.name}: Democrats ${pc(c.demControl)} to control, Republicans ${pc(c.gopControl)}. ${U(slHref(c))}`));
    h("Closest ballot measures");
    [...ms.measures].sort((a, b) => Math.abs(a.est.prob - 0.5) - Math.abs(b.est.prob - 0.5)).slice(0, 12)
      .forEach((m) => L.push(`* ${STATE_NAME[m.st] ?? m.st} ${m.label}, ${m.title}: ${pc(m.est.prob)} chance to pass, Yes projected at ${m.est.yes.toFixed(1)}%. ${U(bmHref(m))}`));
  } else {
    h("Every Senate race");
    [...sen].sort((a, b) => a.state.localeCompare(b.state)).forEach((r) => L.push(raceLine(r)));
    h("Every governor race");
    [...gov].sort((a, b) => a.state.localeCompare(b.state)).forEach((r) => L.push(raceLine(r)));
    h("Every House race");
    [...house].sort((a, b) => a.state.localeCompare(b.state) || a.district - b.district).forEach((r) => L.push(raceLine(r)));
    h("Every statewide down ballot race");
    [...db.races].sort((a, b) => a.state.localeCompare(b.state) || a.office.localeCompare(b.office)).forEach((r) => {
      const office = r.officeLabel.toLowerCase();
      if (r.uncontested || !r.dem || !r.gop) { L.push(`* ${r.state} ${office}: uncontested. ${U(dbHref(r))}`); return; }
      const dLead = r.est.margin < 0;
      L.push(`* ${r.state} ${office}: ${dLead ? r.dem : r.gop}, ${dLead ? "Democrat" : "Republican"}, ${pc(dLead ? 1 - r.est.prob : r.est.prob)} to win against ${dLead ? r.gop : r.dem}; projected margin ${fmtM(r.est.margin)}. ${U(dbHref(r))}`);
    });
    h("Every state legislative chamber");
    [...sl.chambers].sort((a, b) => a.name.localeCompare(b.name)).forEach((c) => {
      const cur = currentMajority(c);
      L.push(`* ${c.name}: Democrats ${pc(c.demControl)} to control, Republicans ${pc(c.gopControl)}; ${c.up} of ${c.seats} seats up; ${cur ? `${cur === "D" ? "Democratic" : "Republican"} majority today` : "no majority today"}; Democratic seats 80% range ${c.p10} to ${c.p90}. ${U(slHref(c))}`);
    });
    h("Every statewide ballot measure");
    [...ms.measures].sort((a, b) => a.st.localeCompare(b.st)).forEach((m) =>
      L.push(`* ${STATE_NAME[m.st] ?? m.st} ${m.label}, ${m.title}: ${pc(m.est.prob)} chance to pass, Yes projected at ${m.est.yes.toFixed(1)}% against the ${Math.round(m.threshold * 1000) / 10}% it needs. ${U(bmHref(m))}`));
    h("Every polling average");
    const seen = new Set<string>();
    for (const d of AGGREGATES) {
      const s = avgSummary(d);
      if (seen.has(s.path) || s.path.includes("?")) continue;
      seen.add(s.path);
      if (s.a == null || s.b == null) continue;
      L.push(`* ${s.headline}: ${d.seriesA.label} ${n1(s.a)}%, ${d.seriesB.label} ${n1(s.b)}%${s.updated ? ` as of ${day(s.updated)}` : ""}, ${s.polls} polls. ${U(s.path)} JSON ${U(`/api/polls/${d.id}`)}`);
    }
  }

  h("Main pages");
  L.push(
    `* 2026 forecast hub, every forecast on one board: ${U("/forecast")}`,
    `* Swingometer, shift any group of voters and watch every race and chamber move: ${U("/forecast/swingometer")}`,
    `* Statewide offices forecast, attorney general, secretary of state and more: ${U("/forecast/statewide")}`,
    `* State legislative forecast, every chamber and district: ${U("/forecast/legislatures")}`,
    `* Ballot measure forecast: ${U("/forecast/measures")}`,
    `* Forecast methodology: ${U("/forecast/methodology")}`,
    `* Forecast changelog: ${U("/forecast/changelog")}`,
    `* Polling averages, every race and question: ${U("/polls")}`,
    `* Senate polling averages: ${U("/polls/senate")}`,
    `* Governor polling averages: ${U("/polls/governor")}`,
    `* Generic ballot average: ${U("/polls/generic-ballot")}`,
    `* Trump approval average: ${U("/polls/approval")}`,
    `* Early vote tracker, with each state against its 2022 and 2024 pace on the same day before the election: ${U("/maps/early-vote")}`,
    `* Electoral map builder: ${U("/maps/electoral")}`,
    `* Live election results: ${U("/results")}`,
    `* On Point Polling Ohio poll, October 2026, Brown 46.6 Husted 42.3 for Senate and Acton 47.9 Ramaswamy 43.1 for governor among 635 likely voters: ${U("/tpsi/polls/ohio-2026")}`,
    `* On Point Polling poll releases: ${U("/tpsi/polls")}`,
    `* On Point Polling methodology: ${U("/tpsi/methodology")}`,
    `* About On Point Polling: ${U("/tpsi")}`,
  );

  h("Data that can be cited");
  L.push(
    `* Forecast model output, every Senate, House and governor race: ${U("/forecast/model.json")}`,
    `* Statewide down ballot forecast: ${U("/forecast/downballot.json")}`,
    `* State legislative forecast: ${U("/forecast/statehouse.json")}`,
    `* Ballot measure forecast: ${U("/forecast/measures.json")}`,
    `* Every polling average as JSON, with an index of ids: ${U("/api/polls/index")}`,
    `* Sitemap of every page: ${U("/sitemap.xml")}`,
  );
  if (!full) L.push(`* Every race, chamber, measure and average in one file: ${U("/llms-full.txt")}`);

  h("How the forecast works, in brief");
  L.push(
    "* Every Senate, governor and House race is rebuilt county by county from three legs: fundamentals built from presidential approval and the national environment, each county's certified 2024 result moved to the 2026 environment, and each county's own voting history set to the polling average.",
    "* Polls are averaged by sample size, age, voter screen and pollster grade; races with 8 or more polls use a LOWESS trend. The polling leg gains weight with more independent pollsters and as Election Day nears.",
    "* Candidate effects include each incumbent's measured personal vote and party unity read from the 2026 primaries.",
    `* ${meta.sims.toLocaleString()} simulations share a national shock, demographic shocks, state shocks and county shocks, so related races move together. Chamber odds are the share of simulations each party wins. Full detail: ${U("/forecast/methodology")}`,
    "* State legislative districts start from their 2024 presidential vote, move with the state House forecast and the generic ballot, and use district and statewide legislative polls.",
    "* Ballot measures start from how similar measures fared in 2018, 2022 and 2024, adjusted for the state, the subject and the measure type, then blended with public polls.",
  );

  h("How to cite");
  L.push(
    `* Cite as: ${SITE.name} 2026 forecast, updated ${day(meta.updated)}, with the race page URL.`,
    `* Polling averages: ${SITE.name} polling average, with the date and the average page URL.`,
    "* Win chances are probabilities from simulations, not vote share predictions. A 70% favorite loses about three times in ten.",
  );

  return L.join("\n") + "\n";
}
