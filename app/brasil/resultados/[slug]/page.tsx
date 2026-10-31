// /brasil/resultados/[state]: archived runoff results for one state, municipality by municipality.
import React from "react";
import Link from "@/app/components/Link";
import { notFound } from "next/navigation";
import JsonLd from "@/app/components/JsonLd";
import { brStates, brSeo, brPageLd } from "../../data";
import LiveState from "../LiveState";
import { T } from "../../i18n";
import { fmt, slugOf, UF_ORDER, type Fmt } from "../../lib";

export const dynamicParams = false;
export function generateStaticParams() { return brStates().map((s) => ({ slug: slugOf(s.name) })); }
const find = (slug: string) => brStates().find((s) => slugOf(s.name) === slug);
const EN = fmt("en"), PT = fmt("pt");
const B = (f: (x: Fmt) => React.ReactNode) => <T en={f(EN)} pt={f(PT)} />;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const s = find((await params).slug); if (!s) return {};
  return brSeo({
    title: `${s.name} Runoff Results (Archive): Brazil 2026 by Municipality`, pt: `Resultado ${PT.inState(s.uf, s.name)} (arquivo)`,
    description: `Archived results of Brazil's October 25, 2026 runoff ${EN.inState(s.uf, s.name)}: Flávio Bolsonaro's and Lula's votes in every municipality from the provider's last count, against the On Point Politics forecast. Resultado do 2º turno ${PT.inState(s.uf, s.name)}, arquivado.`,
    path: `/brasil/resultados/${slugOf(s.name)}`,
    keywords: [`${s.name} election results`, `${s.name} runoff results`, `apuração ${s.name}`, `resultado ${s.name}`, `resultado segundo turno ${s.name}`, `quem ganhou ${PT.inState(s.uf, s.name)}`],
  });
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const s = find((await params).slug); if (!s) notFound();
  const all = brStates(), path = `/brasil/resultados/${slugOf(s.name)}`;
  return (
    <div className="br-wrap">
      <JsonLd data={brPageLd({ name: `${s.name} runoff results (archive)`, description: `Archived Brazil 2026 runoff results ${EN.inState(s.uf, s.name)}`, path,
        crumbs: [["Home", "/"], ["Brazil 2026", "/brasil"], ["Results", "/brasil/resultados"], [s.name, path]] })} />
      <nav className="br-crumb" aria-label="Breadcrumb">{B((x) => <><Link href="/brasil/resultados">{x.t("Results", "Resultados")}</Link><span>/</span><span>{s.name}</span><span>·</span><Link href={`/brasil/${slugOf(s.name)}`}>{x.t("See the forecast", "Ver a previsão")}</Link></>)}</nav>
      <section>
        <div className="br-eye">{B((x) => `${x.region(s.region)} · ${s.uf} · ${x.t("runoff count, archived", "apuração do 2º turno, arquivada")}`)}</div>
        <h1 className="br-h2" style={{ fontSize: "clamp(28px,3vw,46px)" }}>{B((x) => `${s.name}: Flávio Bolsonaro ${x.t("vs", "x")} Lula`)}</h1>
      </section>
      <LiveState s={s} />
      <section>
        <div className="br-eye">{B((x) => x.t("Other states", "Outros estados"))}</div>
        <div className="br-pick" style={{ marginTop: 10 }}>
          {UF_ORDER.map((uf) => { const o = all.find((y) => y.uf === uf)!; return <Link key={uf} href={`/brasil/resultados/${slugOf(o.name)}`} aria-current={uf === s.uf ? "page" : undefined} title={o.name}>{uf}</Link>; })}
        </div>
        <p className="br-note">{B((x) => x.t("Source: Brazil's Superior Electoral Court, the TSE, through civicAPI: the provider's last update, saved by On Point Politics. Official results are those certified by the TSE.", "Fonte da apuração: Tribunal Superior Eleitoral, via civicAPI: a última atualização do provedor, salva pela On Point Politics. Os resultados oficiais são os certificados pelo TSE."))} <Link href="/brasil/arquivo">{B((x) => x.t("About the archive", "Sobre o arquivo"))}</Link></p>
      </section>
    </div>
  );
}
