// /brasil: the On Point forecast for the 2026 Brazilian presidential runoff, in English with a Portuguese version.
import React from "react";
import Link from "@/app/components/Link";
import JsonLd from "@/app/components/JsonLd";
import { getBr, brStates, brSeo, brPageLd } from "./data";
import { ForecastMap, Countdown } from "./HubClient";
import { T } from "./i18n";
import { FL, LU, fmt, marginColor, ratingStyle, slugOf, type BrState, type Fmt } from "./lib";

const DESC = "On Point Politics forecast for Brazil's 2026 presidential runoff between Flávio Bolsonaro and Lula: win probability, projected valid vote, maps by state and municipality, and the polling average. Previsão do 2º turno em português.";
export const metadata = brSeo({ title: "Brazil 2026 Runoff Forecast: Flávio Bolsonaro vs Lula", pt: "Previsão do 2º turno", description: DESC, path: "/brasil",
  keywords: ["Brazil runoff forecast", "Lula chance of winning", "Flavio Bolsonaro chance of winning", "previsão segundo turno", "chance de vitória Lula", "modelo eleitoral Brasil"] });

const EN = fmt("en"), PT = fmt("pt");
/** the same block in both languages; the reader's choice shows one */
const B = (f: (x: Fmt) => React.ReactNode) => <T en={f(EN)} pt={f(PT)} />;
const REGIONS = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"];
const day = (iso: string, x: Fmt) => { const [y, m, d] = iso.split("-"); return x.lang === "pt" ? `${d}/${m}` : new Date(`${y}-${m}-${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }); };

function faq(n: ReturnType<typeof getBr>["national"], x: Fmt): [string, string][] {
  return x.lang === "pt" ? [
    ["Quem está na frente no 2º turno de 2026?", `Pela previsão do On Point Politics, Flávio Bolsonaro tem ${x.nf(n.flavio)}% dos votos válidos previstos contra ${x.nf(n.lula)}% de Lula. Em 40 mil simulações, Flávio vence em ${x.nf(100 * n.p_flavio)}% e Lula em ${x.nf(100 * n.p_lula)}%. É uma vantagem, não uma certeza: a faixa provável vai de ${x.nf(n.p10)}% a ${x.nf(n.p90)}% para Flávio.`],
    ["Que horas fecham as urnas no domingo?", "A votação vai das 8h às 17h pelo horário de Brasília, no mesmo horário em todo o país. O TSE só começa a divulgar a apuração depois das 17h, quando todas as seções estão fechadas."],
    ["Quando sai o resultado do 2º turno?", "A urna eletrônica permite uma apuração rápida. Nas últimas eleições, a maior parte dos votos foi totalizada nas duas primeiras horas depois do fechamento, e o vencedor costuma ser conhecido ainda no início da noite."],
    ["O que são votos válidos?", "São os votos dados a um dos dois candidatos, sem contar brancos e nulos. O TSE calcula o percentual de cada candidato sobre os votos válidos, e quem tiver mais da metade deles vence a eleição."],
    ["Como funciona a previsão do On Point Politics?", "O modelo combina três fontes: a média das pesquisas de 2º turno, com peso de 65%; uma estimativa estrutural feita a partir do voto de cada estado no 1º turno, redistribuindo os eleitores dos candidatos eliminados, com peso de 35%; e o comportamento de cada estado no 2º turno de 2022. Depois, roda 40 mil simulações com erros nacionais, regionais e estaduais."],
    ["Onde acompanhar a apuração ao vivo?", "Na página Resultados ao vivo do On Point Politics, com os números do TSE por estado e por município, comparados com o que o modelo esperava, e uma projeção do resultado final atualizada a cada 30 segundos."],
  ] : [
    ["Who is ahead in Brazil's 2026 runoff?", `In the On Point Politics forecast, Flávio Bolsonaro is projected to win ${x.nf(n.flavio)}% of the valid vote to Lula's ${x.nf(n.lula)}%. Across 40,000 simulations Flávio wins ${x.nf(100 * n.p_flavio)}% of the time and Lula ${x.nf(100 * n.p_lula)}%. That is an edge, not a certainty: the likely range for Flávio runs from ${x.nf(n.p10)}% to ${x.nf(n.p90)}%.`],
    ["When do the polls close on Sunday?", "Voting runs from 8 AM to 5 PM Brasília time, the same hours across the whole country, which is 4 PM Eastern. The electoral court, the TSE, starts releasing the count only after 5 PM, once every polling place has closed."],
    ["When will the result be known?", "Brazil votes on electronic machines, so the count is fast. In recent elections most of the vote was tallied within two hours of the polls closing, and the winner was usually clear early in the evening."],
    ["What are valid votes?", "Votes cast for one of the two candidates, leaving out blank and spoiled ballots. The TSE reports each candidate's share of the valid vote, and whoever wins more than half of it wins the election."],
    ["How does the On Point forecast work?", "The model blends three sources: the average of runoff polls, weighted 65%; a structural estimate built from each state's first round vote, with the eliminated candidates' voters reassigned, weighted 35%; and how each state moved in the 2022 runoff. It then runs 40,000 simulations with national, regional and state errors."],
    ["Where can I follow the count live?", "On the On Point Politics live results page, with the TSE's numbers by state and municipality against what the model expected, and a projection of the final result updated every 30 seconds."],
  ];
}

function Dist({ mean, p10, p90, x }: { mean: number; p10: number; p90: number; x: Fmt }) {
  const sd = (p90 - p10) / 2.563, W = 760, H = 200, x0 = 44, x1 = 58, pad = 28;
  const X = (v: number) => pad + ((v - x0) / (x1 - x0)) * (W - 2 * pad);
  const pdf = (v: number) => Math.exp(-((v - mean) ** 2) / (2 * sd * sd));
  const Y = (p: number) => H - 30 - p * (H - 60);
  const pts: [number, number][] = []; for (let v = x0; v <= x1 + 1e-9; v += 0.05) pts.push([v, pdf(v)]);
  const area = (a: number, b: number) => { const ps = pts.filter(([v]) => v >= a && v <= b); return `M${X(ps[0][0])},${Y(0)} ` + ps.map(([v, p]) => `L${X(v).toFixed(1)},${Y(p).toFixed(1)}`).join(" ") + ` L${X(ps[ps.length - 1][0])},${Y(0)} Z`; };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={x.t(`Simulated distribution of Flávio Bolsonaro's vote, centered on ${x.nf(mean)}%`, `Distribuição simulada do voto de Flávio Bolsonaro, centrada em ${x.nf(mean)}%`)}>
      <rect x={X(p10)} y={18} width={X(p90) - X(p10)} height={H - 48} fill="rgba(var(--line-rgb),.05)" rx={6} />
      <path d={area(x0, 50)} fill={LU} opacity={0.75} />
      <path d={area(50, x1)} fill={FL} opacity={0.8} />
      <line x1={X(50)} x2={X(50)} y1={10} y2={H - 30} stroke="var(--hi)" strokeDasharray="3 4" opacity={0.7} />
      <line x1={X(mean)} x2={X(mean)} y1={Y(1) - 4} y2={H - 30} stroke="var(--hi)" strokeWidth={2} />
      <text x={X(mean) + 8} y={Y(1) + 10} className="lab">{x.nf(mean)}%</text>
      <text x={X(50) - 8} y={22} textAnchor="end" className="lab">{x.t("Lula wins", "Lula vence")}</text>
      <text x={X(50) + 8} y={22} className="lab">{x.t("Flávio wins", "Flávio vence")}</text>
      <line x1={pad} x2={W - pad} y1={H - 30} y2={H - 30} className="ax" />
      {[44, 46, 48, 50, 52, 54, 56, 58].map((v) => <text key={v} x={X(v)} y={H - 10} textAnchor="middle">{v}%</text>)}
      <text x={X(p10)} y={H - 36} textAnchor="middle" style={{ fontSize: 10 }}>{x.nf(p10)}</text>
      <text x={X(p90)} y={H - 36} textAnchor="middle" style={{ fontSize: 10 }}>{x.nf(p90)}</text>
    </svg>
  );
}

function NetVotes({ states, zz, x }: { states: BrState[]; zz?: BrState; x: Fmt }) {
  const rows = [...states, ...(zz ? [zz] : [])].map((s) => ({ s, net: s.fv - s.lv })).sort((a, b) => b.net - a.net);
  const max = Math.max(...rows.map((r) => Math.abs(r.net)));
  return (
    <div className="br-net" role="list">
      {rows.map(({ s, net }) => {
        const w = `${(100 * Math.abs(net)) / max}%`;
        const inner = (<>
          <span className="uf">{s.uf === "ZZ" ? x.t("ABR", "EXT") : s.uf}</span>
          <span className="side l">{net < 0 && <i style={{ width: w }} />}</span>
          <span className="side f">{net > 0 && <i style={{ width: w }} />}</span>
          <span className={`val ${net > 0 ? "fl" : "lu"}`}>{net > 0 ? "+" : "−"}{x.compact(Math.abs(net))}</span>
        </>);
        return s.uf === "ZZ" ? <div key={s.uf} role="listitem" className="nr" title={x.t("Voters abroad", "Eleitores no exterior")}>{inner}</div>
          : <Link key={s.uf} href={`/brasil/${slugOf(s.name)}`} role="listitem" className="nr" title={`${s.name}: ${x.mg(s.margin)}`}>{inner}</Link>;
      })}
    </div>
  );
}

export default function Page() {
  const b = getBr(), n = b.national, states = brStates(), zz = b.states.ZZ;
  const close = [...states].sort((a, c) => Math.abs(a.margin) - Math.abs(c.margin)).slice(0, 9);
  const avgPolls = n.legs.polling_avg_flavio;
  const polls = [...n.polls].sort((a, c) => c.field_mid.localeCompare(a.field_mid));
  const wmax = Math.max(...polls.map((p) => p.weight));
  const netNat = n.valid * (n.margin / 100);
  const flWins = states.filter((s) => s.margin > 0).length;
  const gold = { color: "var(--gold)" };
  return (
    <div className="br-wrap">
      <JsonLd data={brPageLd({ name: "Brazil 2026 runoff forecast: Flávio Bolsonaro vs Lula", description: DESC, path: "/brasil", crumbs: [["Home", "/"], ["Brazil 2026", "/brasil"]], faq: faq(n, EN) })} />

      <section className="br-hero">
        <div>
          <div className="br-eye">{B((x) => x.t("Presidential election 2026 · Runoff · Sunday, October 25", "Eleição presidencial 2026 · 2º turno · domingo, 25 de outubro"))}</div>
          <h1>{B((x) => x.lang === "pt" ? <>Quem vence o <em>2º turno</em>: Flávio Bolsonaro ou Lula?</> : <>Who wins Brazil&rsquo;s <em>runoff</em>: Flávio Bolsonaro or Lula?</>)}</h1>
          <p>{B((x) => x.lang === "pt"
            ? `Flávio Bolsonaro chega ao domingo como favorito, mas a disputa segue apertada. O modelo do On Point Politics projeta ${x.pct(n.flavio)} dos votos válidos para Flávio e ${x.pct(n.lula)} para Lula, uma diferença de cerca de ${x.compact(Math.abs(netNat))} de votos. Em 40 mil simulações, Flávio vence em ${Math.round(n.p_flavio * 10)} de cada 10.`
            : `Flávio Bolsonaro goes into Sunday as the favorite, but the race is close. The On Point Politics model projects ${x.pct(n.flavio)} of the valid vote for Flávio and ${x.pct(n.lula)} for Lula, a gap of about ${x.compact(Math.abs(netNat))} votes. Across 40,000 simulations, Flávio wins ${Math.round(n.p_flavio * 10)} times in 10.`)}</p>
          <div className="meta">
            <span className="br-chip gold">{B((x) => x.t(`Updated ${day(b.updated, x)} with the final polls`, `Atualizado em ${day(b.updated, x)} com as pesquisas finais`))}</span>
            <span className="br-chip">{B((x) => x.t(`${x.nint(n.valid)} projected valid votes`, `${x.nint(n.valid)} votos válidos previstos`))}</span>
            <span className="br-chip">{B((x) => x.t(`${n.polls.length} polls in the average`, `${n.polls.length} pesquisas na média`))}</span>
          </div>
        </div>
        <div className="br-duel">
          <div className="who">
            <div className="c f"><small>PL</small><b>Flávio Bolsonaro</b><span className="p">{B((x) => `${x.nf(100 * n.p_flavio)}%`)}</span></div>
            <div className="vs">{B((x) => x.t("vs", "x"))}</div>
            <div className="c l r"><small>PT</small><b>Lula</b><span className="p">{B((x) => `${x.nf(100 * n.p_lula)}%`)}</span></div>
          </div>
          <div className="br-prob" aria-label={`Flávio ${100 * n.p_flavio}%, Lula ${100 * n.p_lula}%`}>
            <i className="f" style={{ width: `${100 * n.p_flavio}%` }} /><i className="l" style={{ width: `${100 * n.p_lula}%` }} /><span className="mid" />
          </div>
          <div className="cap">{B((x) => x.t("Chance of winning", "Chance de vitória"))}</div>
          <div className="br-prob thin"><i className="f" style={{ width: `${n.flavio}%` }} /><i className="l" style={{ width: `${n.lula}%` }} /><span className="mid" /></div>
          <div className="br-vote">{B((x) => <><span className="fl">{x.pct(n.flavio)} {x.t("of valid votes", "dos válidos")}</span><span className="lu">{x.pct(n.lula)} {x.t("of valid votes", "dos válidos")}</span></>)}</div>
          <Countdown />
        </div>
      </section>

      <section className="br-card br-dist">
        <div className="br-card-h">{B((x) => <><h3>{x.t("Every possible outcome", "Todos os resultados possíveis")}</h3><span>{x.t("40,000 simulations", "40 mil simulações")}</span></>)}</div>
        {B((x) => <Dist mean={n.flavio} p10={n.p10} p90={n.p90} x={x} />)}
        <p className="br-note">{B((x) => x.t(
          `Each point on the curve is a possible result for Flávio's share of the valid vote. The blue area is where he wins; the red, where Lula wins. In 8 of 10 simulations Flávio lands between ${x.pct(n.p10)} and ${x.pct(n.p90)}.`,
          `Cada ponto da curva é um resultado possível para Flávio nos votos válidos. A área azul é onde ele vence; a vermelha, onde Lula vence. Em 8 de cada 10 simulações, Flávio fica entre ${x.pct(n.p10)} e ${x.pct(n.p90)}.`))}</p>
      </section>

      <section>
        <div className="br-eye">{B((x) => x.t("Forecast map", "Mapa da previsão"))}</div>
        <h2 className="br-h2">{B((x) => x.t(`Flávio leads in ${flWins} of the 27 federal units`, `Flávio lidera em ${flWins} das 27 unidades da federação`))}</h2>
        <p className="br-lede">{B((x) => x.t(
          "Lula dominates the Northeast; Flávio wins the South, the Center-West, São Paulo and Rio. The election turns on margins: the size of Lula's wins in Bahia and Pernambuco against the size of Flávio's in São Paulo, Paraná and Santa Catarina. Hover over a state, or click one to see every municipality.",
          "Lula domina o Nordeste com folga; Flávio vence no Sul, no Centro-Oeste, em São Paulo e no Rio. A eleição se decide nas margens: o tamanho da vitória de Lula na Bahia e em Pernambuco contra o tamanho da vitória de Flávio em São Paulo, no Paraná e em Santa Catarina. Passe o mouse sobre um estado ou clique para ver cada município."))}</p>
        <div className="br-mapgrid" style={{ marginTop: 16 }}>
          <div className="br-card"><ForecastMap states={states} /></div>
          <div className="br-card">
            <div className="br-card-h">{B((x) => <><h3>{x.t("The closest states", "Os estados mais disputados")}</h3><span>{x.t("Projected margin", "Margem prevista")}</span></>)}</div>
            <ul className="br-close">
              {close.map((s) => (
                <li key={s.uf}><Link href={`/brasil/${slugOf(s.name)}`}>
                  <span className="uf">{s.uf}</span>
                  <span className="nm">{s.name}<small>{B((x) => `${x.rating(s.rating)} · ${x.t(`Flávio ${x.pct(100 * s.p, 0)} chance`, `Flávio ${x.pct(100 * s.p, 0)} de chance`)}`)}</small>
                    <span className="br-meter"><i style={{ left: s.margin < 0 ? `${50 + s.margin * 2}%` : "50%", width: `${Math.min(50, Math.abs(s.margin) * 2)}%`, background: s.margin > 0 ? FL : LU }} /></span></span>
                  <span className={`mg ${s.margin > 0 ? "fl" : "lu"}`}>{B((x) => x.mg(s.margin))}</span>
                </Link></li>
              ))}
            </ul>
            <p className="br-note">{B((x) => x.t(
              `Minas Gerais, which has voted for the winner in every election since 1989, sits at ${x.mg(b.states.MG.margin)}.`,
              `Minas Gerais, o estado que acompanhou o vencedor em todas as eleições desde 1989, aparece com ${x.mg(b.states.MG.margin)}.`))}</p>
          </div>
        </div>
      </section>

      <section className="br-card">
        <div className="br-card-h">{B((x) => <><h3>{x.t("Where the votes come from", "De onde vêm os votos")}</h3><span>{x.t("Projected net votes by state", "Saldo previsto de votos por estado")}</span></>)}</div>
        <p className="br-lede" style={{ marginBottom: 14 }}>{B((x) => x.t(
          `With 118 million valid votes, a state's size matters as much as its margin. São Paulo alone should give Flávio a net ${x.compact(b.states.SP.fv - b.states.SP.lv)} votes; Bahia should hand Lula ${x.compact(b.states.BA.lv - b.states.BA.fv)}. Added up, the forecast gives Flávio a national edge of about ${x.compact(netNat)} votes.`,
          `Num país de 118 milhões de votos válidos, o tamanho do estado pesa tanto quanto a margem. São Paulo sozinho deve dar a Flávio um saldo de ${x.compact(b.states.SP.fv - b.states.SP.lv)} de votos; a Bahia deve devolver a Lula ${x.compact(b.states.BA.lv - b.states.BA.fv)}. Somando tudo, a previsão dá a Flávio um saldo nacional de cerca de ${x.compact(netNat)}.`))}</p>
        {B((x) => <NetVotes states={states} zz={zz} x={x} />)}
      </section>

      <section>
        <div className="br-eye">{B((x) => x.t("The polls", "As pesquisas"))}</div>
        <h2 className="br-h2">{B((x) => x.t(`Polling average: Flávio ${x.nf(avgPolls)}%, Lula ${x.nf(100 - avgPolls)}%`, `Média das pesquisas: Flávio ${x.nf(avgPolls)}%, Lula ${x.nf(100 - avgPolls)}%`))}</h2>
        <p className="br-lede">{B((x) => x.t(
          "Only each runoff poll's valid vote numbers are used. Newer polls and bigger samples count for more; no house effect adjustment is applied to any pollster.",
          "Usamos apenas os votos válidos de cada pesquisa de 2º turno. Pesquisas mais recentes e com amostras maiores pesam mais; não aplicamos nenhum ajuste de viés aos institutos."))}</p>
        <div className="br-card" style={{ marginTop: 16 }}>
          <div className="br-tbl-w">
            {B((x) => (
              <table className="br-tbl">
                <thead><tr><th>{x.t("Pollster", "Instituto")}</th><th>{x.t("Field", "Campo")}</th><th className="n">{x.t("Sample", "Amostra")}</th><th className="n">Flávio</th><th className="n">Lula</th><th className="n">{x.t("Margin", "Margem")}</th><th>{x.t("Weight", "Peso na média")}</th></tr></thead>
                <tbody>
                  {polls.map((p) => (
                    <tr key={p.pollster + p.field_mid}>
                      <td><b>{p.pollster}</b></td><td className="mono">{day(p.field_mid, x)}</td><td className="n">{x.nint(p.n)}</td>
                      <td className="n fl">{x.nf(p.flavio)}</td><td className="n lu">{x.nf(p.lula)}</td><td className={`n ${p.flavio > p.lula ? "fl" : p.flavio < p.lula ? "lu" : ""}`}>{x.mg(p.flavio - p.lula)}</td>
                      <td className="bar"><div className="br-meter" style={{ marginTop: 0 }}><i style={{ left: 0, width: `${(100 * p.weight) / wmax}%`, background: "var(--gold)" }} /></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="br-eye">{B((x) => x.t("How the forecast works", "Como a previsão é feita"))}</div>
        <h2 className="br-h2">{B((x) => x.t("Three sources, 40,000 simulations", "Três fontes, 40 mil simulações"))}</h2>
        <div className="br-legs" style={{ marginTop: 14 }}>
          <div className="br-leg">{B((x) => <><small>{x.t("Polls · 65%", "Pesquisas · 65%")}</small><b className="fl">{x.nf(n.legs.polling_avg_flavio)}%</b><p>{x.t("The average of runoff polls, weighted toward recent polls and larger samples.", "Média das pesquisas de 2º turno, com mais peso para as recentes e as de amostra maior.")}</p></>)}</div>
          <div className="br-leg">{B((x) => <><small>{x.t("First round transfer · 35%", "Transferência do 1º turno · 35%")}</small><b className="fl">{x.nf(n.legs.transfer_prior_flavio)}%</b><p>{x.t("Starts from each state's actual first round vote and reassigns the eliminated candidates' voters by each one's endorsement and profile.", "Parte do voto real de cada estado no 1º turno e redistribui os eleitores dos candidatos eliminados conforme apoio e perfil de cada um.")}</p></>)}</div>
          <div className="br-leg">{B((x) => <><small>{x.t("Final forecast", "Previsão final")}</small><b className="fl">{x.nf(n.flavio)}%</b><p>{x.t(
            `States are adjusted by how they moved in the 2022 runoff and added up with projected turnout. Flávio won ${x.nf(n.legs.r1_2026_flavio_two_way)}% against Lula in the first round; Bolsonaro won ${x.nf(n.legs.r2_2022_bolsonaro)}% in the 2022 runoff.`,
            `Os estados são ajustados pelo comportamento no 2º turno de 2022 e somados com o comparecimento previsto. Flávio teve ${x.nf(n.legs.r1_2026_flavio_two_way)}% contra Lula no 1º turno; Bolsonaro teve ${x.nf(n.legs.r2_2022_bolsonaro)}% no 2º turno de 2022.`)}</p></>)}</div>
        </div>
      </section>

      <section id="estados">
        <div className="br-eye">{B((x) => x.t("Explore by state", "Explore por estado"))}</div>
        <h2 className="br-h2">{B((x) => x.t("The forecast in every state and municipality", "A previsão em cada estado e em cada município"))}</h2>
        <div className="br-regions" style={{ marginTop: 14 }}>
          {REGIONS.map((r) => (
            <div key={r} className="br-region">
              <h3>{B((x) => x.region(r))}</h3>
              <div className="br-sgrid">
                {states.filter((s) => s.region === r).sort((a, c) => c.valid - a.valid).map((s) => (
                  <Link key={s.uf} href={`/brasil/${slugOf(s.name)}`} className="br-sc" style={{ ["--c" as string]: marginColor(s.margin) }}>
                    {B((x) => <>
                      <div className="t"><b>{s.name}</b><span className="br-rt" style={ratingStyle(s.rating)}>{x.rating(s.rating)}</span></div>
                      <div className="m"><span className={s.margin > 0 ? "fl" : "lu"}>{x.mg(s.margin)}</span><small>{x.t(`${x.pct(100 * Math.max(s.p, 1 - s.p), 0)} chance`, `${x.pct(100 * Math.max(s.p, 1 - s.p), 0)} de chance`)}</small></div>
                      <div className="br-prob thin"><i className="f" style={{ width: `${s.flavio}%` }} /><i className="l" style={{ width: `${s.lula}%` }} /><span className="mid" /></div>
                      <div className="f2"><span>2022: Bolsonaro {x.nf(s.r22)}%</span><span>{x.compact(s.valid)} {x.t("votes", "votos")}</span></div>
                    </>)}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="br-eye">{B((x) => x.t("Questions", "Perguntas frequentes"))}</div>
        <h2 className="br-h2">{B((x) => x.t("What to know about the runoff", "O que você precisa saber sobre o 2º turno"))}</h2>
        <div className="br-faq" style={{ marginTop: 14 }}>
          {B((x) => <>{faq(n, x).map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</>)}
        </div>
        <p className="br-note">{B((x) => x.lang === "pt"
          ? <>Previsão do On Point Politics, gerada em {day(b.updated, x)}. Os resultados oficiais são os do Tribunal Superior Eleitoral. Na noite da eleição, acompanhe a <Link href="/brasil/resultados" style={gold}>apuração ao vivo</Link>.</>
          : <>On Point Politics forecast, generated {day(b.updated, x)}. Official results are those of Brazil&rsquo;s Superior Electoral Court, the TSE. On election night, follow the <Link href="/brasil/resultados" style={gold}>live results</Link>.</>)}</p>
      </section>
    </div>
  );
}
