import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/app/components/Link";
import { seo } from "@/app/lib/seo";
import { STATES, bySlug, last, mg, pc, stateModel } from "../data27";
import { Field, Matchups, Others } from "../Parts27";
import StateView from "../State27";
import { stateData } from "@/app/2028/data28";
import "@/onpoint-sketchbook/styles/sketchbook.css";
import "@/app/2028/h28.css";
import "../g27.css";

export const dynamicParams = false;
export function generateStaticParams() { return STATES.map((s) => ({ st: s.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ st: string }> }): Promise<Metadata> {
  const { st } = await params; const s = bySlug(st); if (!s) return {};
  const S = stateModel(s.code), top = S.pairs[0];
  return seo({
    title: `${s.name} governor 2027 forecast`,
    description: `The On Point model for ${s.name}'s 2027 governor race: Republicans win ${pc(S.pR)} of 20,000 runs, ${mg(S.margin)} in the middle run${top ? `, and the likeliest matchup is ${top.r} against ${top.d}` : ""}. Every primary candidate, every matchup and every county.`,
    path: `/2027/${s.slug}`, type: "article",
    keywords: [`${s.name} governor 2027`, `${s.name} governor race`, `${s.name} governor polls`, "2027 governor forecast", ...(top ? [`${top.r} ${top.d}`] : [])],
  });
}

export default async function State27({ params }: { params: Promise<{ st: string }> }) {
  const { st } = await params; const s = bySlug(st); if (!s) notFound();
  const S = stateModel(s.code);
  const unit = s.code === "LA" ? "Parish" : "County";
  const L = S.lean;
  const geo = stateData(s.code);
  const idx = new Map(S.counties.map((c, i) => [c.fips, i]));
  const counties = geo.counties.map((c) => { const i = idx.get(c.f); const g = i != null ? S.counties[i] : null; const m: Record<string, number> = {}; if (i != null) for (const p of S.pairs) m[p.id] = p.cty[i]; return { f: c.f, n: g?.name ?? c.n, d: c.d, votes: g?.votes ?? 0, m24: g?.m24 ?? c.m24 ?? null, m }; });
  const pairs = S.pairs.map((p) => ({ id: p.id, r: p.r, d: p.d, p: p.p, pR: p.pR, margin: p.margin }));
  const prim = S.code === "LA"
    ? { R: S.jungle.filter((c) => c.party === "R").map((c) => ({ name: c.name, win: c.win, party: c.party })), D: S.jungle.filter((c) => c.party === "D").map((c) => ({ name: c.name, win: c.win, party: c.party })) }
    : { R: S.R.map((c) => ({ name: c.name, win: c.win, party: c.party })), D: S.D.map((c) => ({ name: c.name, win: c.win, party: c.party })) };
  return (
    <main className="h28-page g27">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/forecast">Forecast</Link><span className="sep">/</span><Link href="/2027">2027 governors</Link><span className="sep">/</span><span aria-current="page">{s.name}</span></nav>
      <StateView name={s.name} code={s.code} general={S.meta.general} incumbent={S.meta.incumbent} outline={geo.outline} box={geo.box as [number, number, number, number]} counties={counties} pairs={pairs} spread={(S.p90 - S.p10) / 2} prim={prim} unit={unit} />
      <div className="g27-two one">
        <section className="s28-card g27-how">
          <h2>How the race is built</h2>
          <dl>
            <div><dt>National environment, 2027</dt><dd>{mg(S.env)}</dd></div>
            <div><dt>{s.name} for president, its lean</dt><dd>{mg(L.presidential_lean)}</dd></div>
            <div><dt>2026 Senate lean</dt><dd>{mg(L.senate_2026_lean)}</dd></div>
            <div><dt>Governor races, lean</dt><dd>{mg(L.governor_history_lean)}</dd></div>
            <div><dt>Down ballot lean</dt><dd>{mg(L.down_ballot_lean)}</dd></div>
          </dl>
          <p className="g27-mute">Governor races in {s.name} have run far closer than its presidential vote. The model starts from how the state has voted for governor, moves it with the 2027 environment, then builds the electorate up from the L2 voter file, {unit.toLowerCase()} by {unit.toLowerCase()}. {S.N.toLocaleString("en-US")} runs, built {S.built}.</p>
        </section>
      </div>
      <Matchups S={S} />
      {S.code === "LA" ? (
        <div className="g27-fields one">
          <Field jungle title="The October open primary" sub={`Every candidate on one ballot. Someone wins outright in ${pc(S.outright ?? 0)} of runs, a Republican in ${pc(S.outrightR ?? 0)}; otherwise the top two meet in the ${S.meta.runoff} runoff. The bar is the chance of winning the governorship.`} cands={S.jungle} />
        </div>
      ) : (
        <div className="g27-fields">
          <Field title="Republican primary" sub={S.runoffR ? `A runoff in ${pc(S.runoffR)} of runs. The bar is the chance of the nomination.` : `${S.meta.primary}. The bar is the chance of the nomination.`} cands={S.R} />
          <Field title="Democratic primary" sub={S.runoffD ? `A runoff in ${pc(S.runoffD)} of runs. The bar is the chance of the nomination.` : `${S.meta.primary}. The bar is the chance of the nomination.`} cands={S.D} />
        </div>
      )}
      <Others code={S.code} />
      <p className="g27-foot">Early model, built {S.built}. Candidates, money and announcements as reported; a name with less than a full chance of running is weighted by how likely it is to file. Matchups are the general election between each possible pair of nominees: {S.pairs.slice(0, 3).map((p) => `${last(p.r)} v ${last(p.d)}`).join(", ")} and more.</p>
    </main>
  );
}
