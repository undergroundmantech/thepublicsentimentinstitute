// /brasil/estados: the forecast for every state and every municipality in one explorer.
import React from "react";
import Link from "next/link";
import JsonLd from "@/app/components/JsonLd";
import { brStates, brSeo, brPageLd, getBr } from "../data";
import NationExplorer from "../NationExplorer";
import { T } from "../i18n";
import { fmt, ratingStyle, slugOf, type Fmt } from "../lib";

const DESC = "Explore the Brazil 2026 runoff forecast in all 27 states and more than 5,500 municipalities: who is projected to win each town, the margin, and the change since the first round. Previsão por estado e por município.";
export const metadata = brSeo({ title: "Brazil 2026 Runoff by State and Municipality: Forecast Map", pt: "2º turno por estado e por município", description: DESC, path: "/brasil/estados",
  keywords: ["Brazil election map by municipality", "Brazil runoff by state", "mapa eleição 2026 por município", "resultado por cidade", "previsão por estado", "mapa eleitoral Brasil"] });
const EN = fmt("en"), PT = fmt("pt");
const B = (f: (x: Fmt) => React.ReactNode) => <T en={f(EN)} pt={f(PT)} />;

export default function Page() {
  const states = brStates(), b = getBr();
  const rows = [...states].sort((a, c) => c.margin - a.margin);
  return (
    <div className="br-wrap">
      <JsonLd data={brPageLd({ name: "Brazil 2026 runoff by state and municipality", description: DESC, path: "/brasil/estados", crumbs: [["Home", "/"], ["Brazil 2026", "/brasil"], ["States", "/brasil/estados"]] })} />
      <section>
        <div className="br-eye">{B((x) => x.t("Explore the forecast", "Explorar a previsão"))}</div>
        <h1 className="br-h2" style={{ fontSize: "clamp(28px,3vw,44px)" }}>{B((x) => x.t("Brazil in more than 5,500 municipalities", "O Brasil em mais de 5.500 municípios"))}</h1>
        <p className="br-lede">{B((x) => x.t(
          `The national forecast of ${x.pct(b.national.flavio)} for Flávio and ${x.pct(b.national.lula)} for Lula, carried down state by state and town by town from each municipality's first round vote. Pick a state to zoom in, and open its page for the full table.`,
          `A previsão nacional de ${x.pct(b.national.flavio)} para Flávio e ${x.pct(b.national.lula)} para Lula, distribuída estado por estado e cidade por cidade, a partir do voto de cada município no 1º turno. Escolha um estado para aproximar e abra a página dele para ver a tabela completa.`))}</p>
      </section>
      <NationExplorer states={states} />
      <section className="br-card">
        <div className="br-card-h">{B((x) => <><h3>{x.t("Every state", "Todos os estados")}</h3><span>{x.t("Most Flávio to most Lula", "Do mais favorável a Flávio ao mais favorável a Lula")}</span></>)}</div>
        <div className="br-tbl-w">
          {B((x) => (
            <table className="br-tbl">
              <thead><tr><th>{x.t("State", "Estado")}</th><th>{x.t("Rating", "Classificação")}</th><th className="n">Flávio</th><th className="n">Lula</th><th className="n">{x.t("Margin", "Margem")}</th><th className="n">{x.t("Flávio's chance", "Chance de Flávio")}</th><th className="n">{x.t("Valid votes", "Votos válidos")}</th><th className="n">{x.t("1st round", "1º turno")}</th><th className="n">2022</th></tr></thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.uf}>
                    <td><Link href={`/brasil/${slugOf(s.name)}`}>{s.name}</Link></td>
                    <td><span className="br-rt" style={ratingStyle(s.rating)}>{x.rating(s.rating)}</span></td>
                    <td className="n fl">{x.nf(s.flavio)}</td><td className="n lu">{x.nf(s.lula)}</td>
                    <td className={`n ${s.margin > 0 ? "fl" : "lu"}`}>{x.mg(s.margin)}</td>
                    <td className="n">{x.pct(100 * s.p, 0)}</td><td className="n">{x.nint(s.valid)}</td><td className="n">{x.nf(s.r1)}</td><td className="n">{x.nf(s.r22)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
        <p className="br-note">{B((x) => x.t("First round: Flávio's share of the votes for him and Lula. 2022: Jair Bolsonaro's share in the runoff against Lula.", "1º turno: percentual de Flávio nos votos dados a ele e a Lula. 2022: percentual de Jair Bolsonaro no 2º turno contra Lula."))}</p>
      </section>
    </div>
  );
}
