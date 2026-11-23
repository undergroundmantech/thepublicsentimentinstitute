// "Keep exploring" at the foot of each 2028 state page: the same state's 2026 results and forecasts, its 2027 race if it
// has one, and the community tools, so a reader who lands on one state finds the rest of the site.
import fs from "node:fs";
import path from "node:path";
import Link from "@/app/components/Link";
import { getModel } from "@/app/lib/forecastData";
import { raceHref } from "@/app/lib/opp";
import { STATES as S27 } from "@/app/2027/data27";
import "@/app/components/community.css";

let ST26: Set<string> | null = null;
const results26 = () => (ST26 ??= new Set((JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/results/2026/index.json"), "utf8")).races as { st: string }[]).map((r) => r.st)));

export default function Keep28({ st, name }: { st: string; name: string }) {
  const slug = name.toLowerCase().replace(/[^a-z]+/g, "-");
  const races = getModel().races.filter((r) => r.st === st && r.office !== "house").slice(0, 3);
  const k27 = S27.find((x) => x.code === st);
  const links: { t: string; s: string; href: string }[] = [
    { t: `${name} matchups`, s: "Every likely 2028 pairing in this state", href: "/2028/general" },
    ...(results26().has(st) ? [{ t: `${name} 2026 results`, s: "The midterm count, county by county", href: `/results/2026/${slug}` }] : []),
    ...races.map((r) => ({ t: r.name, s: "The final 2026 forecast", href: raceHref(r.id) })),
    ...(k27 ? [{ t: `${k27.name} 2027 governor`, s: "Next year's race, forecast now", href: `/2027/${k27.slug}` }] : []),
    { t: "2028 polls", s: "Every 2028 poll, primary and general", href: "/polls/2028" },
    { t: "Make your own map", s: "Rate every state and share it on X", href: "/2028/map-maker" },
    { t: "This week's reader poll", s: "Vote, then see how readers split", href: "/community" },
  ];
  return (
    <nav className="h28-read keep28" aria-labelledby="keep28-h">
      <h2 id="keep28-h">Keep exploring</h2>
      <ul className="keep28-l">{links.map((l) => <li key={l.href + l.t}><Link href={l.href}><b>{l.t}</b><span>{l.s}</span></Link></li>)}</ul>
    </nav>
  );
}
