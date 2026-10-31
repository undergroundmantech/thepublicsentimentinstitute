import type { Metadata } from "next";
import Link from "@/app/components/Link";
import fs from "node:fs";
import path from "node:path";
import PeopleWeb, { type WebData } from "./PeopleWeb";
import "../people.css";
import "./web.css";

export const metadata: Metadata = {
  title: "People web: who is tied to whom",
  description: "The connections behind the Watchdog people files: every member of Congress, governor and 2026 nominee, tied to their opponents, committees, state delegation, donor blocs and shared donors. Put anyone at the center.",
  alternates: { canonical: "/watchdog/people/web" },
};

export default function Page() {
  const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "watchdog", "people", "web.json"), "utf8")) as WebData;
  const start = "OH-sherrod-brown";
  const donors = data.hubs.filter((h) => h.k === "m").length, coms = data.hubs.filter((h) => h.k === "c").length;
  return (
    <>
      <header className="wd-hero">
        <div>
          <div className="eye gold">Watchdog · People files · Web</div>
          <h1>Who is tied <em>to whom.</em></h1>
          <p className="lede">Every person in the people files, wired to the people they share something with: an opponent, a committee seat, a state delegation, a donor bloc or one of {donors} named donors that show up in more than one researched file. Put anyone at the center and walk the web from there.</p>
        </div>
      </header>
      <PeopleWeb data={data} start={start} />
      <p className="wd-src">{data.nodes.length.toLocaleString()} people, {data.races.length} head to head races, {coms} committees. Donor ties come from the researched files only and skip contested items; check any tie in the person&apos;s file before quoting it. Compiled {data.asOf}. <Link href="/watchdog/people">Back to the people files</Link> · <Link href="/watchdog/connections">The money map</Link></p>
    </>
  );
}
