import type { Metadata } from "next";
import Link from "@/app/components/Link";
import { seo } from "@/app/lib/seo";
import { STATES, last, mg, pc, stateModel } from "./data27";
import { Hist } from "./Parts27";
import { Slab3D } from "@/onpoint-sketchbook/react/SketchMap";
import { stateData } from "@/app/2028/data28";
import { RATE, rateOf } from "@/app/2028/rate28";
import "@/onpoint-sketchbook/styles/sketchbook.css";
import "@/app/2028/h28.css";
import "./g27.css";

export const metadata: Metadata = seo({
  title: "2027 governor forecast: Kentucky, Mississippi and Louisiana",
  description: "The On Point model for the three 2027 governor races: the chance each party wins, every primary candidate, every possible matchup and every county, from 20,000 runs per state.",
  path: "/2027", type: "article",
  keywords: ["2027 governor races", "2027 governor forecast", "Kentucky governor 2027", "Mississippi governor 2027", "Louisiana governor 2027"],
});

export default function Gov27() {
  const all = STATES.map((s) => stateModel(s.code));
  return (
    <main className="h28-page g27">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/forecast">Forecast</Link><span className="sep">/</span><span aria-current="page">2027 governors</span></nav>
      <header className="h28-board g27-board g27-hub">
        <div className="h28-board-top"><p className="h28-count"><i />Three races · November 2, 2027 · Louisiana's runoff November 20</p></div>
        <div className="g27-mid">
          <h1 className="h28-h1">The <em>2027</em> governors</h1>
          <p className="g27-inc">Kentucky's open seat after Andy Beshear, Mississippi's open seat after Tate Reeves, and Jeff Landry in Louisiana. The first races of the 2028 cycle, modeled from the primaries to the counties.</p>
        </div>
      </header>
      <div className="g27-cards">
        {all.map((S) => { const top = S.pairs[0]; const g = stateData(S.code); const [x, y, w, h] = g.box as number[]; const pd = Math.max(w, h) * 0.06; const rt = RATE[rateOf(top?.margin ?? S.margin)]; return (
          <Link key={S.code} href={`/2027/${S.slug}`} className="s28-card g27-card">
            <span className="h28-party">{S.name}</span>
            <div className="g27-slab"><Slab3D d={g.outline} viewBox={`${x - pd} ${y - pd} ${w + 2 * pd} ${h + 2 * pd}`} fill={rt.color} /><span className="s28-stamp" style={{ color: rt.text ?? rt.color }}>{rt.label}</span></div>
            <div className="g27-cn"><b className="r">R {pc(S.pR)}</b><b className="d">D {pc(1 - S.pR)}</b></div>
            <p className="g27-inc">{S.meta.incumbent}</p>
            {top ? <p className="g27-top">Likeliest: <b>{last(top.r)}</b> v <b>{last(top.d)}</b>, <span className={top.margin > 0 ? "r" : "d"}>{mg(top.margin)}</span></p> : null}
            <Hist h={S.hist} />
            <span className="g27-go">Open {S.name}</span>
          </Link>
        ); })}
      </div>
      <p className="g27-foot">Early model, built {all[0].built}. Each state is 20,000 runs with a 2027 national environment of {mg(all[0].env)}, the state's own lean in governor, Senate and presidential races, and an electorate built from the L2 voter file.</p>
    </main>
  );
}
