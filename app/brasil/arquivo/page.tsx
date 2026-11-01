// /brasil/arquivo: the landing page of the Brazil 2026 runoff archive. What is kept, from when, and from where: the
// On Point forecast as published before the vote, the provider's last count after it, both by state and municipality,
// and what this archive does not hold. Every number here is read from the two archived files, never typed in.
import fs from "node:fs";
import path from "node:path";
import React from "react";
import Link from "@/app/components/Link";
import JsonLd from "@/app/components/JsonLd";
import { getBr, brStates, brSeo, brPageLd, BR_ARCHIVED } from "../data";
import { T } from "../i18n";
import { fmt, slugOf, type Fmt } from "../lib";
import type { Live } from "../project";

const DESC = "The archive of On Point Politics coverage of Brazil's October 25, 2026 presidential runoff between Flávio Bolsonaro and Lula: the pre-election forecast as published, the provider's last count, every state and municipality, the methods, the dates and the sources. Arquivo do 2º turno.";
export const metadata = brSeo({ title: "Brazil 2026 Runoff Archive: Forecast and Results", pt: "Arquivo do 2º turno de 2026", description: DESC, path: "/brasil/arquivo",
  keywords: ["Brazil 2026 runoff archive", "Brazil election 2026 results", "Brazil election forecast 2026", "arquivo eleição 2026", "resultado segundo turno 2026"] });

const EN = fmt("en"), PT = fmt("pt");
const B = (f: (x: Fmt) => React.ReactNode) => <T en={f(EN)} pt={f(PT)} />;
const readJson = <X,>(p: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), p), "utf8")) as X;
type Manifest = { source: string; url: string; capturedAt: string; records: { uf: string; id: number; sha256: string }[] };
const dateOf = (iso: string, x: Fmt) => new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString(x.lang === "pt" ? "pt-BR" : "en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
const timeOf = (iso: string, x: Fmt) => new Date(iso).toLocaleTimeString(x.lang === "pt" ? "pt-BR" : "en-US", { hour: x.lang === "pt" ? "2-digit" : "numeric", minute: "2-digit", timeZone: "America/Sao_Paulo" });

export default function Page() {
  const b = getBr(), n = b.national, states = brStates();
  const live = readJson<Live>("public/brasil/archive/results.json"), a = live.archive!;
  const man = readJson<Manifest>("data/brasil-archive/2026-runoff/manifest.json");
  const tot = live.nat.fv + live.nat.lv, lula = (100 * live.nat.lv) / tot, flavio = 100 - lula;
  const towns = Object.entries(live.st).filter(([uf]) => uf !== "ZZ").reduce((s, [, v]) => s + Object.keys(v.m).length, 0);
  const share = (uf: string) => { const v = live.st[uf]; const c = v ? v.fv + v.lv : 0; return c ? (100 * v.fv) / c : null; };
  const rows = [...states].sort((p, q) => q.valid - p.valid);
  const right = rows.filter((s) => { const f = share(s.uf); return f != null && (f > 50) === (s.margin > 0); }).length;
  return (
    <div className="br-wrap">
      <JsonLd data={brPageLd({ name: "Brazil 2026 runoff archive", description: DESC, path: "/brasil/arquivo", crumbs: [["Home", "/"], ["Brazil 2026", "/brasil"], ["Archive", "/brasil/arquivo"]] })} />
      <section>
        <div className="br-eye">{B((x) => x.t("Archive · Brazil presidential election 2026 · runoff", "Arquivo · eleição presidencial 2026 · 2º turno"))}</div>
        <h1 className="br-h2" style={{ fontSize: "clamp(28px,3vw,46px)" }}>{B((x) => x.t("Brazil's 2026 runoff, as covered", "O 2º turno de 2026, como foi coberto"))}</h1>
        <p className="br-lede">{B((x) => x.t(
          `Flávio Bolsonaro and Lula met in the runoff on ${dateOf(b.election, x)}. These pages keep the On Point forecast exactly as it was published the day before the vote, and the count as the provider last reported it. Neither is updated.`,
          `Flávio Bolsonaro e Lula se enfrentaram no 2º turno em ${dateOf(b.election, x)}. Estas páginas guardam a previsão do On Point exatamente como foi publicada na véspera da votação e a apuração como o provedor a divulgou pela última vez. Nenhuma das duas é mais atualizada.`))}</p>
      </section>

      <section className="br-kpis">
        <Link href="/brasil" className="br-kpi" style={{ textDecoration: "none" }}>{B((x) => <><small>{x.t(`Forecast · published ${dateOf(b.updated, x)}`, `Previsão · publicada em ${dateOf(b.updated, x)}`)}</small><b className="fl">Flávio {x.pct(n.flavio)}</b><span>{x.t(`Lula ${x.pct(n.lula)} of the projected valid vote · Flávio's chance ${x.pct(100 * n.p_flavio)}`, `Lula ${x.pct(n.lula)} dos votos válidos previstos · chance de Flávio ${x.pct(100 * n.p_flavio)}`)}</span></>)}</Link>
        <Link href="/brasil/resultados" className="br-kpi" style={{ textDecoration: "none" }}>{B((x) => <><small>{x.t(`Count · ${x.nf(a.reporting, 1)}% of sections`, `Apuração · ${x.nf(a.reporting, 1)}% das seções`)}</small><b className={lula > 50 ? "lu" : "fl"}>{lula > 50 ? `Lula ${x.pct(lula)}` : `Flávio ${x.pct(flavio)}`}</b><span>{x.t(`${lula > 50 ? `Flávio ${x.pct(flavio)}` : `Lula ${x.pct(lula)}`} of the valid vote · ${x.nint(tot)} valid votes counted`, `${lula > 50 ? `Flávio ${x.pct(flavio)}` : `Lula ${x.pct(lula)}`} dos votos válidos · ${x.nint(tot)} votos válidos apurados`)}</span></>)}</Link>
        <Link href="/brasil/estados" className="br-kpi" style={{ textDecoration: "none" }}>{B((x) => <><small>{x.t("States", "Estados")}</small><b>{right} / {rows.length}</b><span>{x.t("states where the forecast leader also led the archived count", "estados em que o líder da previsão também liderou a apuração arquivada")}</span></>)}</Link>
        <Link href="/brasil/estados" className="br-kpi" style={{ textDecoration: "none" }}>{B((x) => <><small>{x.t("Municipalities", "Municípios")}</small><b>{x.nint(towns)}</b><span>{x.t("with votes in the archived count, each with its forecast", "com votos na apuração arquivada, cada um com a sua previsão")}</span></>)}</Link>
      </section>

      <section className="br-card">
        <div className="br-card-h">{B((x) => <><h3>{x.t("Forecast and count, state by state", "Previsão e apuração, estado por estado")}</h3><span>{x.t("Margins in points of the valid vote", "Margens em pontos dos votos válidos")}</span></>)}</div>
        <div className="br-tbl-w">
          {B((x) => (
            <table className="br-tbl">
              <thead><tr><th>{x.t("State", "Estado")}</th><th className="n">{x.t("Forecast", "Previsão")}</th><th className="n">{x.t("Archived count", "Apuração arquivada")}</th><th className="n">{x.t("Counted", "Apurado")}</th><th>{x.t("Pages", "Páginas")}</th></tr></thead>
              <tbody>
                {rows.map((s) => {
                  const f = share(s.uf), m = f == null ? null : 2 * f - 100;
                  return (
                    <tr key={s.uf}>
                      <td><b>{s.name}</b></td>
                      <td className={`n ${s.margin > 0 ? "fl" : "lu"}`}>{x.mg(s.margin)}</td>
                      <td className={`n ${m == null ? "" : m > 0 ? "fl" : "lu"}`}>{m == null ? x.t("Not available", "Indisponível") : x.mg(m)}</td>
                      <td className="n">{x.pct(live.st[s.uf]?.pr ?? 0)}</td>
                      <td><Link href={`/brasil/${slugOf(s.name)}`}>{x.t("Forecast", "Previsão")}</Link> · <Link href={`/brasil/resultados/${slugOf(s.name)}`}>{x.t("Results", "Resultado")}</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ))}
        </div>
        <p className="br-note">{B((x) => x.t("Forecast: the On Point projection published before the vote. Archived count: the provider's last update, two candidates' valid votes only.", "Previsão: a projeção do On Point publicada antes da votação. Apuração arquivada: a última atualização do provedor, apenas os votos válidos dos dois candidatos."))}</p>
      </section>

      <section className="br-card">
        <div className="br-card-h">{B((x) => <><h3>{x.t("Methods", "Métodos")}</h3><span /></>)}</div>
        <p className="br-lede">{B((x) => x.t(
          "The forecast blended the average of runoff polls (65%) with a structural estimate from each state's first round vote (35%), adjusted each state by how it moved in the 2022 runoff, and ran 40,000 simulations with national, regional and state errors. On election night, the results pages compared each counted municipality with its forecast and used that gap to estimate the votes still to come; a state or the country was projected only when the gap could no longer be overturned.",
          "A previsão combinou a média das pesquisas de 2º turno (65%) com uma estimativa estrutural a partir do voto de cada estado no 1º turno (35%), ajustou cada estado pelo comportamento no 2º turno de 2022 e rodou 40 mil simulações com erros nacionais, regionais e estaduais. Na noite da eleição, as páginas de resultado comparavam cada município apurado com a sua previsão e usavam essa diferença para estimar os votos que faltavam; um estado ou o país só era projetado quando a diferença não podia mais ser revertida."))}</p>
        <p className="br-note">{B((x) => <>{x.t("More on the forecast on the ", "Mais sobre a previsão na ")}<Link href="/brasil">{x.t("forecast page", "página da previsão")}</Link>.</>)}</p>
      </section>

      <section className="br-card">
        <div className="br-card-h">{B((x) => <><h3>{x.t("Dates and sources", "Datas e fontes")}</h3><span /></>)}</div>
        <div className="br-tbl-w">
          {B((x) => (
            <table className="br-tbl">
              <tbody>
                <tr><td>{x.t("Forecast published", "Previsão publicada")}</td><td>{dateOf(b.updated, x)}</td></tr>
                <tr><td>{x.t("Runoff held", "2º turno realizado")}</td><td>{dateOf(b.election, x)}</td></tr>
                <tr><td>{x.t("Provider's last update", "Última atualização do provedor")}</td><td>{x.t(`${dateOf(a.providerUpdated, x)}, ${timeOf(a.providerUpdated, x)} Brasília`, `${dateOf(a.providerUpdated, x)}, às ${timeOf(a.providerUpdated, x)}`)}</td></tr>
                <tr><td>{x.t("Count saved by On Point", "Apuração salva pelo On Point")}</td><td>{dateOf(a.capturedAt, x)}</td></tr>
                <tr><td>{x.t("Pages archived", "Páginas arquivadas")}</td><td>{dateOf(BR_ARCHIVED, x)}</td></tr>
                <tr><td>{x.t("Source of the count", "Fonte da apuração")}</td><td>{x.t(`${a.source}, which carries the TSE's count: national race ${a.raceIds.BR} and the 27 state races, ${man.records.length} records saved with a SHA-256 hash of each`, `${a.source}, que reproduz a apuração do TSE: disputa nacional ${a.raceIds.BR} e as 27 disputas estaduais, ${man.records.length} registros salvos com o hash SHA-256 de cada um`)}</td></tr>
              </tbody>
            </table>
          ))}
        </div>
      </section>

      <section className="br-card">
        <div className="br-card-h">{B((x) => <><h3>{x.t("What this archive does not hold", "O que este arquivo não tem")}</h3><span /></>)}</div>
        <ul className="br-lede" style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
          {B((x) => <>
            <li>{x.t(`The TSE's certified result. The count kept here is the provider's last update, at ${x.nf(a.reporting, 1)}% of sections; the official result is the one certified by the TSE.`, `O resultado certificado pelo TSE. A apuração guardada aqui é a última atualização do provedor, com ${x.nf(a.reporting, 1)}% das seções; o resultado oficial é o certificado pelo TSE.`)}</li>
            <li>{x.t("The count update by update. Only the last update is kept, so the results pages show no election night timeline.", "A apuração atualização por atualização. Só a última atualização foi guardada, por isso as páginas de resultado não mostram a linha do tempo da noite da eleição.")}</li>
            <li>{x.t("Blank and spoiled ballots and turnout. The archived pages show the two candidates' valid votes only.", "Votos brancos, nulos e comparecimento. As páginas arquivadas mostram apenas os votos válidos dos dois candidatos.")}</li>
          </>)}
        </ul>
      </section>
    </div>
  );
}
