import fs from "node:fs";
import path from "node:path";
import Link from "@/app/components/Link";
import { seo } from "@/app/lib/seo";
import { STATE_NAME } from "@/app/lib/opp";
import Article, { Fig } from "../Article";
import { articleBySlug } from "../lib";

const a = articleBySlug("2028-first-look");
export const metadata = seo({ title: a.title, description: a.dek, path: `/analysis/${a.slug}`, type: "article", published: a.published, modified: a.modified });

type St = { m: number; p10: number; p90: number; pD: number; ev: number; tip: number; ph?: Record<string, number> };
type Hub = { built: string; sims: { general: number; primary: number };
  general: { p_D_win: number; mean_D_EV: number; p10_EV: number; p90_EV: number; nat_margin: number; nat_p10: number; nat_p90: number; p_split_D_pop_R_ec: number; p_split_R_pop_D_ec: number };
  states: Record<string, St>; prim: Record<"dem" | "gop", { nomination: Record<string, number> }> };

const pct = (x: number) => `${Math.round(x * 100)} percent`;
const lead = (m: number) => (Math.abs(m) < 0.05 ? "even" : m < 0 ? `D +${Math.abs(m).toFixed(1)}` : `R +${m.toFixed(1)}`);

export default function Page() {
  const H = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/forecast/2028/hub.json"), "utf8")) as Hub;
  const G = H.general;
  const tip = Object.entries(H.states).filter(([k]) => !k.includes("-")).sort((x, y) => y[1].tip - x[1].tip).slice(0, 8);
  const top6 = tip.slice(0, 6), tipShare = top6.reduce((s, [, v]) => s + v.tip, 0);
  const dn = Object.entries(H.prim.dem.nomination).sort((x, y) => y[1] - x[1]).slice(0, 5);
  const rn = Object.entries(H.prim.gop.nomination).sort((x, y) => y[1] - x[1]).slice(0, 4);
  const pa = H.states.PA, tx = H.states.TX;
  return (
    <Article a={a} sources={[{ label: "The 2028 forecast map and primaries", href: "/forecast/2028" }, { label: "2028 primary polls", href: "/polls/2028" }, { label: "Forecast methodology", href: "/forecast/methodology" }]}>
      <p>
        Two years out is early, and any forecast this far ahead is mostly a statement about the starting position. That is still worth stating carefully, because the
        starting position after a midterm tells you a lot about what each side has to do. The first On Point presidential forecast runs the 2028 election {H.sims.general.toLocaleString("en-US")} times
        on a national environment built from our polling, every state&apos;s presidential history and the electorate that turned out in 2026. Here is where it begins.
      </p>

      <h2>The top line</h2>
      <p>
        Against a generic Republican nominee, the Democratic nominee wins <b>{pct(G.p_D_win)}</b> of the simulations, with an average of <b>{Math.round(G.mean_D_EV)} electoral votes</b>.
        The middle 80 percent of outcomes runs from {G.p10_EV} to {G.p90_EV} Democratic electoral votes, so a narrow Republican win is well inside what the model considers possible.
        The national popular vote averages {lead(G.nat_margin)}, with an 80 percent range from {lead(Math.max(G.nat_p10, G.nat_p90))} to {lead(Math.min(G.nat_p10, G.nat_p90))}.
      </p>
      <p>
        That is a strong position, and it mostly reflects the year Democrats just had. Our final 2026 poll and the national House vote both put Democrats ahead by about
        thirteen points. Midterm waves fade, and the model already assumes a large part of this one does: the presidential environment it starts from is roughly half
        the size of the 2026 margin. The question for 2028 is how much more of it fades.
      </p>

      <h2>The same six states decide it</h2>
      <p>
        The model measures how often each state casts the deciding electoral vote. {top6.map(([k]) => STATE_NAME[k]).slice(0, -1).join(", ")} and {STATE_NAME[top6[5][0]]} together
        are the tipping point in {pct(tipShare)} of simulations. That is the 2024 battleground almost unchanged, which is itself a finding: the 2026 wave did not redraw the map,
        it moved the whole map toward Democrats.
      </p>
      <Fig title="The states most likely to decide 2028" head={["State", "Electoral votes", "Model margin", "Democratic chance", "Tipping point chance"]}
        rows={tip.map(([k, v]) => [STATE_NAME[k] ?? k, v.ev, lead(v.m), pct(v.pD), `${(v.tip * 100).toFixed(1)}%`])}
        note="Generic Democrat against generic Republican. Margins are the model's expected result in each state." />
      <p>
        Pennsylvania sits at the center again. The model has it at {lead(pa.m)} and gives it a {(pa.tip * 100).toFixed(0)} percent chance of being the decisive state on its own.
        {tx ? <> Further out, Texas at {lead(tx.m)} is the largest state that could plausibly move into play, which is why our 2026 miss there matters so much for how we model it.</> : null}
      </p>

      <h2>The split result risk</h2>
      <p>
        Because Democrats run up large margins in big states they already win, they can lose the electoral college while winning the popular vote. The model puts that at
        about {(G.p_split_D_pop_R_ec * 100).toFixed(0)} percent, against {(G.p_split_R_pop_D_ec * 100).toFixed(1)} percent for the reverse. A Democratic popular vote lead of a couple of points is not
        enough on its own. The battleground states have to come along.
      </p>

      <h2>The primaries</h2>
      <p>
        The forecast also simulates both nomination fights, state by state, with real delegate rules and candidates dropping out when they fall behind.
      </p>
      <Fig title="Chance of winning the nomination" head={["Democrats", "Chance", "Republicans", "Chance"]}
        rows={Array.from({ length: Math.max(dn.length, rn.length) }, (_, i) => [dn[i]?.[0] ?? "", dn[i] ? pct(dn[i][1]) : "", rn[i]?.[0] ?? "", rn[i] ? pct(rn[i][1]) : ""])}
        note="From the On Point primary simulation. Candidates not shown have under one percent." />
      <p>
        On the Democratic side, {dn[0][0]} starts as a clear front runner, leading the simulated primary in most states, with {dn[1][0]} and {dn[2][0]} the most likely
        alternatives. Front runner status this early is fragile: name recognition explains a large share of early primary polling, and it fades once voters meet the rest of the field.
        On the Republican side, {rn[0][0]} leads {rn[1][0]}, with {rn[2][0]} a distant third.
      </p>

      <h2>What would change the picture</h2>
      <ul>
        <li><b>How far the wave fades.</b> Every point the national environment moves toward Republicans shifts the battleground roughly one for one. A return to a 2024 style environment would put Republicans back in front in the battleground.</li>
        <li><b>Who turns out.</b> The 2026 wave brought out millions of voters who rarely vote in midterms, while some reliable presidential voters stayed home. Which of them show up in 2028 is the subject of <Link href="/analysis/who-votes-in-2028">who votes in 2028</Link>.</li>
        <li><b>The nominees.</b> Candidates matter at the margins. The <Link href="/forecast/2028">2028 forecast page</Link> lets you set any pairing and see each candidate&apos;s state by state effect.</li>
        <li><b>A third party.</b> A credible independent pulls votes unevenly by state, which can matter more than the national share suggests.</li>
      </ul>
      <p>
        We will update this forecast as primary polling arrives and as the field takes shape. The model, its assumptions and every revision are published on the site.
      </p>
    </Article>
  );
}
