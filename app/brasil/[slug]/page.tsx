// /brasil/[estado]: the runoff forecast for one state, with every municipality.
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/app/components/JsonLd";
import { getBr, brStates, brSeo, brPageLd } from "../data";
import StateExplorer from "../StateExplorer";
import { compact, inState, mg, nf, nint, pct, ratingPt, ratingStyle, slugOf, UF_ORDER } from "../lib";

export const dynamicParams = false;
export function generateStaticParams() { return brStates().map((s) => ({ slug: slugOf(s.name) })); }
const find = (slug: string) => brStates().find((s) => slugOf(s.name) === slug);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const s = find((await params).slug); if (!s) return {};
  const lead = s.margin > 0 ? `Flávio Bolsonaro lidera ${inState(s.uf, s.name)} com ${nf(s.flavio)}% dos votos válidos previstos` : `Lula lidera ${inState(s.uf, s.name)} com ${nf(s.lula)}% dos votos válidos previstos`;
  return brSeo({
    title: `2º turno ${inState(s.uf, s.name)}: previsão por município, Flávio x Lula`,
    description: `${lead}. Veja a previsão do On Point Politics para cada município ${s.uf === "DF" ? "do Distrito Federal" : inState(s.uf, s.name).replace(/^(em|no|na) /, (m) => ({ "em ": "de ", "no ": "do ", "na ": "da " } as Record<string, string>)[m])}, a comparação com o 1º turno e com 2022.`,
    path: `/brasil/${slugOf(s.name)}`,
    keywords: [`eleição ${s.name}`, `segundo turno ${s.name}`, `resultado ${s.name} 2026`, `pesquisa ${s.name} segundo turno`],
  });
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const s = find((await params).slug); if (!s) notFound();
  const b = getBr(), all = brStates();
  const net = s.fv - s.lv, natNet = b.national.valid * (b.national.margin / 100);
  const leader = s.margin > 0 ? "Flávio" : "Lula";
  const path = `/brasil/${slugOf(s.name)}`;
  const desc = `Previsão do 2º turno ${inState(s.uf, s.name)}, município por município.`;
  return (
    <div className="br-wrap">
      <JsonLd data={brPageLd({ name: `2º turno ${inState(s.uf, s.name)}: previsão por município`, description: desc, path, crumbs: [["Início", "/"], ["Brasil 2026", "/brasil"], ["Estados", "/brasil/estados"], [s.name, path]] })} />
      <nav className="br-crumb" aria-label="Você está em"><Link href="/brasil">Brasil 2026</Link><span>/</span><Link href="/brasil/estados">Estados</Link><span>/</span><span>{s.name}</span></nav>

      <section className="br-hero" style={{ gridTemplateColumns: "minmax(0,1.1fr) minmax(0,1fr)" }}>
        <div>
          <div className="br-eye">{s.region} · {s.uf} · 2º turno 2026</div>
          <h1>{s.name}</h1>
          <p>{leader} é {Math.max(s.p, 1 - s.p) < 0.65 ? "um leve favorito" : "o favorito"} {inState(s.uf, s.name)}, com {pct(Math.max(s.flavio, s.lula))} dos votos válidos previstos e {pct(100 * Math.max(s.p, 1 - s.p), 0)} de chance de vencer no estado. {Math.abs(net) > 0 && `Isso representa um saldo de ${compact(Math.abs(net))} de votos para ${leader}, ${Math.abs(net) / Math.abs(natNet) >= 0.2 ? "uma fatia relevante da disputa nacional" : "num total previsto de " + compact(s.valid) + " votos válidos"}.`}</p>
          <div className="meta">
            <span className="br-rt" style={{ ...ratingStyle(s.rating), padding: "6px 12px", fontSize: 12.5 }}>{ratingPt(s.rating)}</span>
            <Link href={`/brasil/resultados/${slugOf(s.name)}`} className="br-chip gold">Apuração ao vivo {inState(s.uf, s.name)}</Link>
          </div>
        </div>
        <div className="br-duel">
          <div className="who">
            <div className="c f"><small>Flávio Bolsonaro</small><span className="p">{nf(s.flavio)}%</span></div>
            <div className="vs">x</div>
            <div className="c l r"><small>Lula</small><span className="p">{nf(s.lula)}%</span></div>
          </div>
          <div className="br-prob"><i className="f" style={{ width: `${s.flavio}%` }} /><i className="l" style={{ width: `${s.lula}%` }} /><span className="mid" /></div>
          <div className="cap">Votos válidos previstos · em 8 de cada 10 simulações, Flávio fica entre {pct(s.p10)} e {pct(s.p90)}</div>
        </div>
      </section>

      <section className="br-kpis">
        <div className="br-kpi"><small>Margem prevista</small><b className={s.margin > 0 ? "fl" : "lu"}>{mg(s.margin)}</b><span>Flávio tem {pct(100 * s.p, 0)} de chance</span></div>
        <div className="br-kpi"><small>Votos válidos previstos</small><b>{compact(s.valid)}</b><span>{nint(s.valid)}</span></div>
        <div className="br-kpi"><small>Flávio no 1º turno</small><b>{pct(s.r1)}</b><span>Só os votos de Flávio e Lula · {s.sw1 >= 0 ? "+" : "−"}{nf(Math.abs(s.sw1))} pts agora</span></div>
        <div className="br-kpi"><small>Bolsonaro em 2022</small><b>{pct(s.r22)}</b><span>2º turno contra Lula · {s.sw22 >= 0 ? "+" : "−"}{nf(Math.abs(s.sw22))} pts agora</span></div>
      </section>

      <StateExplorer uf={s.uf} name={s.name} />

      <section>
        <div className="br-eye">Outros estados</div>
        <div className="br-pick" style={{ marginTop: 10 }}>
          {UF_ORDER.map((uf) => { const o = all.find((x) => x.uf === uf)!; return <Link key={uf} href={`/brasil/${slugOf(o.name)}`} aria-current={uf === s.uf ? "page" : undefined} title={o.name}>{uf}</Link>; })}
        </div>
      </section>
    </div>
  );
}
