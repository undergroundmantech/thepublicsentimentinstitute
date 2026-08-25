// Throwaway: reproduces the SC panel's blend against the live feed, to confirm
// the probability moves and still starts at the published prior.
const SC = { graham: 50.86, norman: 49.14, marginSd: 8.5 };
const MATCH = { graham: "graham", norman: "norman" };
const clampPct = (n) => Math.min(Math.max(n, 0), 100);
const phi = (z) => {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
};

const model = (total, votes, repPct) => {
  const pct = clampPct(repPct) / 100;
  const prior = { graham: SC.graham, norman: SC.norman };
  const shares = { ...prior };
  if (total > 0) {
    for (const k of ["graham", "norman"]) {
      shares[k] = (votes[k] / total) * 100 * pct + prior[k] * (1 - pct);
    }
    const sum = shares.graham + shares.norman;
    for (const k of ["graham", "norman"]) shares[k] = (shares[k] / sum) * 100;
  }
  const margin = shares.graham - shares.norman;
  const sd = Math.max(SC.marginSd * Math.sqrt(Math.max(0, 1 - pct)), 0.1);
  return { shares, margin, sd, p: phi(margin / sd) * 100 };
};

console.log("--- synthetic ---");
const z = model(0, { graham: 0, norman: 0 }, 0);
console.log("0% in            p(Graham)", z.p.toFixed(1), "margin", z.margin.toFixed(2), "sd", z.sd.toFixed(2));
for (const rep of [5, 25, 50, 90, 100]) {
  // Norman ahead 53/47 in the counted vote.
  const t = 100000;
  const m = model(t, { graham: t * 0.47, norman: t * 0.53 }, rep);
  console.log(
    `${String(rep).padStart(3)}% in, N+6 obs  p(Graham)`, m.p.toFixed(1),
    "margin", m.margin.toFixed(2), "sd", m.sd.toFixed(2),
  );
}

console.log("--- live feed ---");
const r = await fetch("https://civicapi.org/api/v2/race/87534", { cache: "no-store" });
const j = await r.json();
const all = j.candidates || [];
const total = all.reduce((s, c) => s + (Number(c.votes) || 0), 0);
const votesFor = (n) =>
  all.filter((c) => String(c.name || "").toLowerCase().includes(n))
     .reduce((s, c) => s + (Number(c.votes) || 0), 0);
const votes = { graham: votesFor(MATCH.graham), norman: votesFor(MATCH.norman) };
const PROJECTED = 279046;
const rep = Math.max(Number(j.percent_reporting) || 0, clampPct((total / PROJECTED) * 100));
console.log("counted", total, "of projected", PROJECTED);
console.log("feed percent_reporting", j.percent_reporting, "-> est. reporting", rep.toFixed(1));
console.log("votes", votes);
const m = model(total, votes, rep);
console.log("shares", m.shares.graham.toFixed(1), "/", m.shares.norman.toFixed(1));
console.log("margin", m.margin.toFixed(2), "sd", m.sd.toFixed(2), "p(Graham)", m.p.toFixed(1));
