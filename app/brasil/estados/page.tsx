// /brasil/estados: the forecast for every state and every municipality in one explorer.
import Link from "next/link";
import JsonLd from "@/app/components/JsonLd";
import { brStates, brSeo, brPageLd, getBr } from "../data";
import NationExplorer from "../NationExplorer";
import { mg, nf, nint, pct, ratingPt, ratingStyle, slugOf } from "../lib";

const DESC = "Explore a previsão do 2º turno de 2026 em todos os 27 estados e nos mais de 5.500 municípios do Brasil: quem deve vencer em cada cidade, a margem prevista e a comparação com o 1º turno.";
export const metadata = brSeo({ title: "2º turno 2026 por estado e por município: mapa da previsão", description: DESC, path: "/brasil/estados",
  keywords: ["mapa eleição 2026 por município", "resultado por cidade", "previsão por estado", "mapa eleitoral Brasil"] });

export default function Page() {
  const states = brStates(), b = getBr();
  const rows = [...states].sort((a, c) => c.margin - a.margin);
  return (
    <div className="br-wrap">
      <JsonLd data={brPageLd({ name: "2º turno 2026 por estado e por município", description: DESC, path: "/brasil/estados", crumbs: [["Início", "/"], ["Brasil 2026", "/brasil"], ["Estados", "/brasil/estados"]] })} />
      <section>
        <div className="br-eye">Explorar a previsão</div>
        <h1 className="br-h2" style={{ fontSize: "clamp(28px,3vw,44px)" }}>O Brasil em mais de 5.500 municípios</h1>
        <p className="br-lede">A previsão nacional de {pct(b.national.flavio)} para Flávio e {pct(b.national.lula)} para Lula, distribuída estado por estado e cidade por cidade, a partir do voto de cada município no 1º turno. Escolha um estado para aproximar e abra a página dele para ver a tabela completa.</p>
      </section>
      <NationExplorer states={states} />
      <section className="br-card">
        <div className="br-card-h"><h3>Todos os estados</h3><span>Do mais favorável a Flávio ao mais favorável a Lula</span></div>
        <div className="br-tbl-w">
          <table className="br-tbl">
            <thead><tr><th>Estado</th><th>Classificação</th><th className="n">Flávio</th><th className="n">Lula</th><th className="n">Margem</th><th className="n">Chance de Flávio</th><th className="n">Votos válidos</th><th className="n">1º turno</th><th className="n">2022</th></tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.uf}>
                  <td><Link href={`/brasil/${slugOf(s.name)}`}>{s.name}</Link></td>
                  <td><span className="br-rt" style={ratingStyle(s.rating)}>{ratingPt(s.rating)}</span></td>
                  <td className="n fl">{nf(s.flavio)}</td><td className="n lu">{nf(s.lula)}</td>
                  <td className={`n ${s.margin > 0 ? "fl" : "lu"}`}>{mg(s.margin)}</td>
                  <td className="n">{pct(100 * s.p, 0)}</td><td className="n">{nint(s.valid)}</td><td className="n">{nf(s.r1)}</td><td className="n">{nf(s.r22)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="br-note">1º turno: percentual de Flávio nos votos dados a ele e a Lula. 2022: percentual de Jair Bolsonaro no 2º turno contra Lula.</p>
      </section>
    </div>
  );
}
