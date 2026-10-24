// /brasil/resultados/[estado]: live runoff results for one state, municipality by municipality.
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/app/components/JsonLd";
import { brStates, brSeo, brPageLd } from "../../data";
import LiveState from "../LiveState";
import { inState, slugOf, UF_ORDER } from "../../lib";

export const dynamicParams = false;
export function generateStaticParams() { return brStates().map((s) => ({ slug: slugOf(s.name) })); }
const find = (slug: string) => brStates().find((s) => slugOf(s.name) === slug);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const s = find((await params).slug); if (!s) return {};
  return brSeo({
    title: `Apuração ${inState(s.uf, s.name)} ao vivo: resultado do 2º turno por município`,
    description: `Resultado do 2º turno de 2026 ${inState(s.uf, s.name)}, ao vivo: votos de Flávio Bolsonaro e Lula em cada município, comparados com a previsão do On Point Politics.`,
    path: `/brasil/resultados/${slugOf(s.name)}`,
    keywords: [`apuração ${s.name}`, `resultado ${s.name}`, `resultado segundo turno ${s.name}`, `quem ganhou ${inState(s.uf, s.name)}`],
  });
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const s = find((await params).slug); if (!s) notFound();
  const all = brStates(), path = `/brasil/resultados/${slugOf(s.name)}`;
  return (
    <div className="br-wrap">
      <JsonLd data={brPageLd({ name: `Apuração ${inState(s.uf, s.name)} ao vivo`, description: `Resultado do 2º turno ${inState(s.uf, s.name)}`, path,
        crumbs: [["Início", "/"], ["Brasil 2026", "/brasil"], ["Resultados", "/brasil/resultados"], [s.name, path]] })} />
      <nav className="br-crumb" aria-label="Você está em"><Link href="/brasil/resultados">Resultados ao vivo</Link><span>/</span><span>{s.name}</span><span>·</span><Link href={`/brasil/${slugOf(s.name)}`}>Ver a previsão</Link></nav>
      <section>
        <div className="br-eye">{s.region} · {s.uf} · apuração do 2º turno</div>
        <h1 className="br-h2" style={{ fontSize: "clamp(28px,3vw,46px)" }}>{s.name}: Flávio Bolsonaro x Lula</h1>
      </section>
      <LiveState s={s} />
      <section>
        <div className="br-eye">Outros estados</div>
        <div className="br-pick" style={{ marginTop: 10 }}>
          {UF_ORDER.map((uf) => { const o = all.find((x) => x.uf === uf)!; return <Link key={uf} href={`/brasil/resultados/${slugOf(o.name)}`} aria-current={uf === s.uf ? "page" : undefined} title={o.name}>{uf}</Link>; })}
        </div>
        <p className="br-note">Fonte da apuração: Tribunal Superior Eleitoral, via civicAPI. Os resultados oficiais são os divulgados pelo TSE.</p>
      </section>
    </div>
  );
}
