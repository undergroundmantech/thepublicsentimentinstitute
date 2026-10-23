import type { Metadata } from "next";
import Link from "next/link";
import { getPeople } from "../data";
import { Pointy } from "@/app/components/home/Mascot";
import PeopleIndex from "./PeopleIndex";
import "./people.css";

export const metadata: Metadata = {
  title: "People files",
  description: "A Watchdog file on every sitting member of Congress, every governor and every 2026 House, Senate and governor nominee: who funds them, the decisions on their desk, and the sources.",
};

export default function Page() {
  const d = getPeople();
  const deep = d.people.filter((p) => p.hand);
  return (
    <>
      <header className="wd-hero">
        <div>
          <div className="eye gold">Watchdog · People files</div>
          <h1>A file on <em>everyone on the ballot.</em></h1>
          <p className="lede">{d.n.toLocaleString()} people: every sitting member of Congress and governor and every 2026 nominee for House, Senate and governor. Each file holds the race, the committees, the decisions the office controls and who cares about them, and for the {d.hand} researched in full, where the money comes from, line by line, with its source.</p>
        </div>
        <Pointy className="pf-pty keep" pose="think" prop="magnifier" size={116} look={-1} flip detective say={<>Start with the money, then look at what is on their desk next year.</>} />
      </header>
      <section className="pf-deep" aria-label="Researched in full">
        <div className="pf-deep-h"><span className="eye">Researched in full</span><span className="pf-mute">Governor races in Georgia, Michigan, Arizona, Pennsylvania, Ohio and Wisconsin, plus Florida&apos;s Byron Donalds</span></div>
        <div className="pf-cards">
          {deep.map((p) => (
            <Link key={p.id} href={`/watchdog/people/${p.id}`} className={`pf-card ${p.party.toLowerCase()}`}>
              <span className="k">{p.office} · {p.st}</span><b>{p.name}</b><small>{p.edges} money ties · {p.levers || "no"} researched decisions</small>
            </Link>
          ))}
        </div>
      </section>
      <PeopleIndex people={d.people} />
      <p className="wd-src">From the On Point Watchdog Database, compiled {d.asOf}. Researched files follow the Watchdog research protocol: every figure carries a date and a source and a status of Confirmed, Secondary, Provisional or Contested. Files marked roster and levers hold the race, committees and office decisions so far; their money comes in as the FEC pipeline runs. Check any figure against the filing before quoting it. <Link href="/watchdog/connections">See the money on the Connections map.</Link></p>
    </>
  );
}
