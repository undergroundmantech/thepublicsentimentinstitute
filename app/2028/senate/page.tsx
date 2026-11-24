import type { Metadata } from "next";
import fs from "node:fs";
import path from "node:path";
import { seo } from "@/app/lib/seo";
import { nomination } from "../data28";
import type { GenFile } from "../lib";
import Senate28, { type SenFile, type SenPair } from "./Senate28";
import "../h28.css";
import "./sen28.css";

// Nov 24 2026: the 2028 Senate model. Each class 3 race is the presidential margin in its state for the chosen matchup plus a split
// ticket offset fit on the 2016 and 2024 Senate classes (scratchpad s28/model.py writes public/forecast/2028/senate.json).
export const metadata: Metadata = seo({
  title: "2028 Senate forecast: every race, with the split ticket effect",
  description: "The 34 Senate seats up in 2028, forecast on top of the presidential race. Pick the presidential matchup, move the national environment and see how far each Senate race runs ahead of or behind the top of the ticket.",
  path: "/2028/senate",
  keywords: ["2028 Senate forecast", "2028 Senate map", "2028 Senate races", "split ticket voting", "Senate control 2028"],
});

const R = (f: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "forecast", "2028", f), "utf8"));

export default function SenatePage() {
  const sen = R("senate.json") as SenFile;
  const G = R("x/gen.json") as GenFile;
  const nom = nomination();
  const D = [...nom.D.slice(0, 5).map((x) => x.name), "Generic Democrat"];
  const Rr = [...nom.R.slice(0, 3).map((x) => x.name), "Generic Republican"];
  const pairs: SenPair[] = G.pairs.filter((p) => D.includes(p[0]) && Rr.includes(p[1]))
    .map((p) => ({ d: p[0], r: p[1], pD: p[2], m: p[11].map((x) => (x ? Math.round(x[0] * 10) / 10 : 0)) }));
  const odds = Object.fromEntries([...nom.D, ...nom.R].map((x) => [x.name, x.p]));
  const sig = G.keys.map((k) => G.sig[k] ?? 5.5);
  const ev = G.keys.map((k) => G.ev[k] ?? 0);
  return (
    <main className="h28-page sn28">
      <Senate28 sen={sen} pairs={pairs} keys={G.keys} sig={sig} ev={ev} D={D} R={Rr} odds={odds} />
    </main>
  );
}
