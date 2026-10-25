// /brasil/[state]: the runoff forecast for one state, with every municipality, in English with a Portuguese version.
import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/app/components/JsonLd";
import { getBr, brStates, brSeo, brPageLd } from "../data";
import StateExplorer from "../StateExplorer";
import { T } from "../i18n";
import { fmt, ratingStyle, slugOf, UF_ORDER, type Fmt } from "../lib";

export const dynamicParams = false;
export function generateStaticParams() { return brStates().map((s) => ({ slug: slugOf(s.name) })); }
const find = (slug: string) => brStates().find((s) => slugOf(s.name) === slug);
const EN = fmt("en"), PT = fmt("pt");
const B = (f: (x: Fmt) => React.ReactNode) => <T en={f(EN)} pt={f(PT)} />;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const s = find((await params).slug); if (!s) return {};
  const lead = s.margin > 0 ? `Flávio Bolsonaro leads in ${s.name} with ${EN.nf(s.flavio)}% of the projected valid vote` : `Lula leads in ${s.name} with ${EN.nf(s.lula)}% of the projected valid vote`;
  return brSeo({
    title: `${s.name} Runoff Forecast by Municipality: Flávio vs Lula`, pt: `2º turno ${PT.inState(s.uf, s.name)}`,
    description: `${lead}. The On Point Politics forecast for every municipality ${EN.ofState(s.uf, s.name)}, against the first round and 2022. Previsão por município ${PT.ofState(s.uf, s.name)}.`,
    path: `/brasil/${slugOf(s.name)}`,
    keywords: [`${s.name} election`, `${s.name} runoff`, `eleição ${s.name}`, `segundo turno ${s.name}`, `resultado ${s.name} 2026`, `pesquisa ${s.name} segundo turno`],
  });
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const s = find((await params).slug); if (!s) notFound();
  const b = getBr(), all = brStates();
  const net = s.fv - s.lv, natNet = b.national.valid * (b.national.margin / 100);
  const leader = s.margin > 0 ? "Flávio" : "Lula", strong = Math.max(s.p, 1 - s.p) >= 0.65, big = Math.abs(net) / Math.abs(natNet) >= 0.2;
  const path = `/brasil/${slugOf(s.name)}`;
  const sgn = (v: number, x: Fmt) => `${v >= 0 ? "+" : "−"}${x.nf(Math.abs(v))}`;
  return (
    <div className="br-wrap">
      <JsonLd data={brPageLd({ name: `${s.name} runoff forecast by municipality`, description: `Brazil 2026 runoff forecast ${EN.inState(s.uf, s.name)}, municipality by municipality.`, path, crumbs: [["Home", "/"], ["Brazil 2026", "/brasil"], ["States", "/brasil/estados"], [s.name, path]] })} />
      <nav className="br-crumb" aria-label="Breadcrumb">{B((x) => <><Link href="/brasil">{x.t("Brazil 2026", "Brasil 2026")}</Link><span>/</span><Link href="/brasil/estados">{x.t("States", "Estados")}</Link><span>/</span><span>{s.name}</span></>)}</nav>

      <section className="br-hero" style={{ gridTemplateColumns: "minmax(0,1.1fr) minmax(0,1fr)" }}>
        <div>
          <div className="br-eye">{B((x) => `${x.region(s.region)} · ${s.uf} · ${x.t("2026 runoff", "2º turno 2026")}`)}</div>
          <h1>{s.name}</h1>
          <p>{B((x) => x.lang === "pt"
            ? `${leader} é ${strong ? "o favorito" : "um leve favorito"} ${x.inState(s.uf, s.name)}, com ${x.pct(Math.max(s.flavio, s.lula))} dos votos válidos previstos e ${x.pct(100 * Math.max(s.p, 1 - s.p), 0)} de chance de vencer no estado. Isso representa um saldo de ${x.compact(Math.abs(net))} de votos para ${leader}, ${big ? "uma fatia relevante da disputa nacional" : `num total previsto de ${x.compact(s.valid)} votos válidos`}.`
            : `${leader} is ${strong ? "the favorite" : "a slight favorite"} ${x.inState(s.uf, s.name)}, with ${x.pct(Math.max(s.flavio, s.lula))} of the projected valid vote and a ${x.pct(100 * Math.max(s.p, 1 - s.p), 0)} chance of carrying the state. That is a net ${x.compact(Math.abs(net))} votes for ${leader}, ${big ? "a real share of the national race" : `out of about ${x.compact(s.valid)} projected valid votes`}.`)}</p>
          <div className="meta">
            <span className="br-rt" style={{ ...ratingStyle(s.rating), padding: "6px 12px", fontSize: 12.5 }}>{B((x) => x.rating(s.rating))}</span>
            <Link href={`/brasil/resultados/${slugOf(s.name)}`} className="br-chip gold">{B((x) => x.t(`Live results ${x.inState(s.uf, s.name)}`, `Apuração ao vivo ${x.inState(s.uf, s.name)}`))}</Link>
          </div>
        </div>
        <div className="br-duel">
          <div className="who">
            <div className="c f"><small>Flávio Bolsonaro</small><span className="p">{B((x) => `${x.nf(s.flavio)}%`)}</span></div>
            <div className="vs">{B((x) => x.t("vs", "x"))}</div>
            <div className="c l r"><small>Lula</small><span className="p">{B((x) => `${x.nf(s.lula)}%`)}</span></div>
          </div>
          <div className="br-prob"><i className="f" style={{ width: `${s.flavio}%` }} /><i className="l" style={{ width: `${s.lula}%` }} /><span className="mid" /></div>
          <div className="cap">{B((x) => x.t(`Projected valid vote · in 8 of 10 simulations Flávio lands between ${x.pct(s.p10)} and ${x.pct(s.p90)}`, `Votos válidos previstos · em 8 de cada 10 simulações, Flávio fica entre ${x.pct(s.p10)} e ${x.pct(s.p90)}`))}</div>
        </div>
      </section>

      <section className="br-kpis">
        <div className="br-kpi">{B((x) => <><small>{x.t("Projected margin", "Margem prevista")}</small><b className={s.margin > 0 ? "fl" : "lu"}>{x.mg(s.margin)}</b><span>{x.t(`Flávio has a ${x.pct(100 * s.p, 0)} chance`, `Flávio tem ${x.pct(100 * s.p, 0)} de chance`)}</span></>)}</div>
        <div className="br-kpi">{B((x) => <><small>{x.t("Projected valid votes", "Votos válidos previstos")}</small><b>{x.compact(s.valid)}</b><span>{x.nint(s.valid)}</span></>)}</div>
        <div className="br-kpi">{B((x) => <><small>{x.t("Flávio, first round", "Flávio no 1º turno")}</small><b>{x.pct(s.r1)}</b><span>{x.t(`Flávio and Lula votes only · ${sgn(s.sw1, x)} pts now`, `Só os votos de Flávio e Lula · ${sgn(s.sw1, x)} pts agora`)}</span></>)}</div>
        <div className="br-kpi">{B((x) => <><small>{x.t("Bolsonaro in 2022", "Bolsonaro em 2022")}</small><b>{x.pct(s.r22)}</b><span>{x.t(`Runoff against Lula · ${sgn(s.sw22, x)} pts now`, `2º turno contra Lula · ${sgn(s.sw22, x)} pts agora`)}</span></>)}</div>
      </section>

      <StateExplorer uf={s.uf} name={s.name} />

      <section>
        <div className="br-eye">{B((x) => x.t("Other states", "Outros estados"))}</div>
        <div className="br-pick" style={{ marginTop: 10 }}>
          {UF_ORDER.map((uf) => { const o = all.find((y) => y.uf === uf)!; return <Link key={uf} href={`/brasil/${slugOf(o.name)}`} aria-current={uf === s.uf ? "page" : undefined} title={o.name}>{uf}</Link>; })}
        </div>
      </section>
    </div>
  );
}
