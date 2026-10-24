// /brasil/resultados: live results of the 2026 Brazilian presidential runoff, from civicAPI, with the On Point projection.
import Link from "next/link";
import JsonLd from "@/app/components/JsonLd";
import { brStates, brSeo, brPageLd, getBr } from "../data";
import LiveNational from "./LiveNational";
import { slugOf, UF_ORDER } from "../lib";

const DESC = "Apuração ao vivo do 2º turno de 2026 entre Flávio Bolsonaro e Lula: votos por estado e por município, comparação com a previsão e a projeção do resultado final, atualizada a cada 30 segundos.";
export const metadata = brSeo({ title: "Apuração ao vivo do 2º turno 2026: resultado Lula x Flávio Bolsonaro", description: DESC, path: "/brasil/resultados",
  keywords: ["apuração ao vivo", "resultado do segundo turno", "quem ganhou a eleição", "apuração TSE", "resultado eleição presidente 2026"] });

export default function Page() {
  const b = getBr(), states = brStates(), n = b.national;
  return (
    <div className="br-wrap">
      <JsonLd data={brPageLd({ name: "Apuração ao vivo do 2º turno 2026", description: DESC, path: "/brasil/resultados", crumbs: [["Início", "/"], ["Brasil 2026", "/brasil"], ["Resultados", "/brasil/resultados"]],
        faq: [["Que horas sai o resultado do 2º turno?", "As urnas fecham às 17h de Brasília em todo o país e o TSE começa a divulgar a apuração em seguida. Nas últimas eleições, a maior parte dos votos foi totalizada nas duas primeiras horas."],
          ["Como funciona a projeção do On Point Politics?", "A cada atualização, comparamos o resultado de cada município apurado com a nossa previsão para ele e usamos essa diferença para estimar os votos que ainda faltam em cada estado. A projeção só aponta um vencedor quando a diferença fica grande demais para ser revertida."]] })} />
      <section>
        <div className="br-eye">Domingo, 25 de outubro · 2º turno</div>
        <h1 className="br-h2" style={{ fontSize: "clamp(28px,3vw,46px)" }}>Apuração ao vivo: Flávio Bolsonaro x Lula</h1>
        <p className="br-lede">Os números do TSE, estado por estado e município por município, comparados com a previsão do On Point Politics. A página se atualiza sozinha a cada 30 segundos.</p>
      </section>
      <LiveNational states={states} nat={{ flavio: n.flavio, p_flavio: n.p_flavio, p10: n.p10, p90: n.p90, valid: n.valid }} />
      <section>
        <div className="br-eye">Resultados por estado</div>
        <div className="br-pick" style={{ marginTop: 10 }}>
          {UF_ORDER.map((uf) => { const s = b.states[uf]; return <Link key={uf} href={`/brasil/resultados/${slugOf(s.name)}`} title={s.name}>{uf}</Link>; })}
        </div>
        <p className="br-note">Fonte da apuração: Tribunal Superior Eleitoral, via civicAPI. Os resultados oficiais são os divulgados pelo TSE.</p>
      </section>
    </div>
  );
}
