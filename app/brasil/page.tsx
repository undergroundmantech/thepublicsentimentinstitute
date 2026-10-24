// /brasil: the On Point forecast for the 2026 Brazilian presidential runoff, written for Brazilian readers.
import Link from "next/link";
import JsonLd from "@/app/components/JsonLd";
import { getBr, brStates, brSeo, brPageLd } from "./data";
import { ForecastMap, Countdown } from "./HubClient";
import { FL, LU, compact, marginColor, mg, nf, nint, pct, ratingPt, ratingStyle, slugOf, type BrState } from "./lib";

const DESC = "Previsão do On Point Politics para o 2º turno de 2026 entre Flávio Bolsonaro e Lula: chance de vitória, votos válidos previstos, mapa por estado e por município e a média das pesquisas.";
export const metadata = brSeo({ title: "Previsão do 2º turno 2026: Flávio Bolsonaro x Lula", description: DESC, path: "/brasil",
  keywords: ["previsão segundo turno", "chance de vitória Lula", "chance de vitória Flávio Bolsonaro", "modelo eleitoral Brasil"] });

const REGIOES = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"];
const dm = (iso: string) => { const [, m, d] = iso.split("-"); return `${d}/${m}`; };

function faq(n: ReturnType<typeof getBr>["national"]): [string, string][] {
  return [
    ["Quem está na frente no 2º turno de 2026?", `Pela previsão do On Point Politics, Flávio Bolsonaro tem ${nf(n.flavio)}% dos votos válidos previstos contra ${nf(n.lula)}% de Lula. Em 40 mil simulações, Flávio vence em ${nf(100 * n.p_flavio)}% e Lula em ${nf(100 * n.p_lula)}%. É uma vantagem, não uma certeza: a faixa provável vai de ${nf(n.p10)}% a ${nf(n.p90)}% para Flávio.`],
    ["Que horas fecham as urnas no domingo?", "A votação vai das 8h às 17h pelo horário de Brasília, no mesmo horário em todo o país. O TSE só começa a divulgar a apuração depois das 17h, quando todas as seções estão fechadas."],
    ["Quando sai o resultado do 2º turno?", "A urna eletrônica permite uma apuração rápida. Nas últimas eleições, a maior parte dos votos foi totalizada nas duas primeiras horas depois do fechamento, e o vencedor costuma ser conhecido ainda no início da noite."],
    ["O que são votos válidos?", "São os votos dados a um dos dois candidatos, sem contar brancos e nulos. O TSE calcula o percentual de cada candidato sobre os votos válidos, e quem tiver mais da metade deles vence a eleição."],
    ["Como funciona a previsão do On Point Politics?", "O modelo combina três fontes: a média das pesquisas de 2º turno, com peso de 65%; uma estimativa estrutural feita a partir do voto de cada estado no 1º turno, redistribuindo os eleitores dos candidatos eliminados, com peso de 35%; e o comportamento de cada estado no 2º turno de 2022. Depois, roda 40 mil simulações com erros nacionais, regionais e estaduais."],
    ["Onde acompanhar a apuração ao vivo?", "Na página Resultados ao vivo e na Sala de situação do On Point Politics, com os números do TSE por estado e por município, comparados com o que o modelo esperava, e uma projeção do resultado final atualizada a cada 30 segundos."],
  ];
}

function Dist({ mean, p10, p90, p05, p95 }: { mean: number; p10: number; p90: number; p05: number; p95: number }) {
  const sd = (p90 - p10) / 2.563, W = 760, H = 200, x0 = 44, x1 = 58, pad = 28;
  const X = (v: number) => pad + ((v - x0) / (x1 - x0)) * (W - 2 * pad);
  const pdf = (v: number) => Math.exp(-((v - mean) ** 2) / (2 * sd * sd));
  const Y = (p: number) => H - 30 - p * (H - 60);
  const pts: [number, number][] = []; for (let v = x0; v <= x1 + 1e-9; v += 0.05) pts.push([v, pdf(v)]);
  const area = (a: number, b: number) => { const ps = pts.filter(([v]) => v >= a && v <= b); return `M${X(ps[0][0])},${Y(0)} ` + ps.map(([v, p]) => `L${X(v).toFixed(1)},${Y(p).toFixed(1)}`).join(" ") + ` L${X(ps[ps.length - 1][0])},${Y(0)} Z`; };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Distribuição simulada do voto de Flávio Bolsonaro, centrada em ${nf(mean)}%`}>
      <rect x={X(p10)} y={18} width={X(p90) - X(p10)} height={H - 48} fill="rgba(var(--line-rgb),.05)" rx={6} />
      <path d={area(x0, 50)} fill={LU} opacity={0.75} />
      <path d={area(50, x1)} fill={FL} opacity={0.8} />
      <line x1={X(50)} x2={X(50)} y1={10} y2={H - 30} stroke="var(--hi)" strokeDasharray="3 4" opacity={0.7} />
      <line x1={X(mean)} x2={X(mean)} y1={Y(1) - 4} y2={H - 30} stroke="var(--hi)" strokeWidth={2} />
      <text x={X(mean) + 8} y={Y(1) + 10} className="lab">{nf(mean)}%</text>
      <text x={X(50) - 8} y={22} textAnchor="end" className="lab">Lula vence</text>
      <text x={X(50) + 8} y={22} className="lab">Flávio vence</text>
      <line x1={pad} x2={W - pad} y1={H - 30} y2={H - 30} className="ax" />
      {[44, 46, 48, 50, 52, 54, 56, 58].map((v) => <text key={v} x={X(v)} y={H - 10} textAnchor="middle">{v}%</text>)}
      <text x={X(p10)} y={H - 36} textAnchor="middle" style={{ fontSize: 10 }}>{nf(p10)}</text>
      <text x={X(p90)} y={H - 36} textAnchor="middle" style={{ fontSize: 10 }}>{nf(p90)}</text>
      <title>{`90% das simulações entre ${nf(p05)}% e ${nf(p95)}%`}</title>
    </svg>
  );
}

function NetVotes({ states, zz }: { states: BrState[]; zz?: BrState }) {
  const rows = [...states, ...(zz ? [zz] : [])].map((s) => ({ s, net: s.fv - s.lv })).sort((a, b) => b.net - a.net);
  const max = Math.max(...rows.map((r) => Math.abs(r.net)));
  return (
    <div className="br-net" role="list">
      {rows.map(({ s, net }) => {
        const w = `${(100 * Math.abs(net)) / max}%`;
        const inner = (<>
          <span className="uf">{s.uf === "ZZ" ? "EXT" : s.uf}</span>
          <span className="side l">{net < 0 && <i style={{ width: w }} />}</span>
          <span className="side f">{net > 0 && <i style={{ width: w }} />}</span>
          <span className={`val ${net > 0 ? "fl" : "lu"}`}>{net > 0 ? "+" : "−"}{compact(Math.abs(net))}</span>
        </>);
        return s.uf === "ZZ" ? <div key={s.uf} role="listitem" className="nr" title="Eleitores no exterior">{inner}</div>
          : <Link key={s.uf} href={`/brasil/${slugOf(s.name)}`} role="listitem" className="nr" title={`${s.name}: ${mg(s.margin)}`}>{inner}</Link>;
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
  const FAQ = faq(n);
  return (
    <div className="br-wrap">
      <JsonLd data={brPageLd({ name: "Previsão do 2º turno 2026: Flávio Bolsonaro x Lula", description: DESC, path: "/brasil", crumbs: [["Início", "/"], ["Brasil 2026", "/brasil"]], faq: FAQ })} />

      <section className="br-hero">
        <div>
          <div className="br-eye">Eleição presidencial 2026 · 2º turno · domingo, 25 de outubro</div>
          <h1>Quem vence o <em>2º turno</em>: Flávio Bolsonaro ou Lula?</h1>
          <p>Flávio Bolsonaro chega ao domingo como favorito, mas a disputa segue apertada. O modelo do On Point Politics projeta {pct(n.flavio)} dos votos válidos para Flávio e {pct(n.lula)} para Lula, uma diferença de cerca de {compact(Math.abs(netNat))} de votos. Em 40 mil simulações, Flávio vence em {Math.round(n.p_flavio * 10)} de cada 10.</p>
          <div className="meta">
            <span className="br-chip gold">Atualizado em {dm(b.updated)} com as pesquisas finais</span>
            <span className="br-chip">{nint(n.valid)} votos válidos previstos</span>
            <span className="br-chip">{n.polls.length} pesquisas na média</span>
          </div>
        </div>
        <div className="br-duel">
          <div className="who">
            <div className="c f"><small>PL</small><b>Flávio Bolsonaro</b><span className="p">{nf(100 * n.p_flavio, 1)}%</span></div>
            <div className="vs">x</div>
            <div className="c l r"><small>PT</small><b>Lula</b><span className="p">{nf(100 * n.p_lula, 1)}%</span></div>
          </div>
          <div className="br-prob" aria-label={`Chance de vitória: Flávio ${nf(100 * n.p_flavio)}%, Lula ${nf(100 * n.p_lula)}%`}>
            <i className="f" style={{ width: `${100 * n.p_flavio}%` }} /><i className="l" style={{ width: `${100 * n.p_lula}%` }} /><span className="mid" />
          </div>
          <div className="cap">Chance de vitória</div>
          <div className="br-prob thin"><i className="f" style={{ width: `${n.flavio}%` }} /><i className="l" style={{ width: `${n.lula}%` }} /><span className="mid" /></div>
          <div className="br-vote"><span className="fl">{pct(n.flavio)} dos válidos</span><span className="lu">{pct(n.lula)} dos válidos</span></div>
          <Countdown />
        </div>
      </section>

      <section className="br-card br-dist">
        <div className="br-card-h"><h3>Todos os resultados possíveis</h3><span>40 mil simulações</span></div>
        <Dist mean={n.flavio} p10={n.p10} p90={n.p90} p05={n.p05} p95={n.p95} />
        <p className="br-note">Cada ponto da curva é um resultado possível para Flávio nos votos válidos. A área azul é onde ele vence; a vermelha, onde Lula vence. Em 8 de cada 10 simulações, Flávio fica entre {pct(n.p10)} e {pct(n.p90)}.</p>
      </section>

      <section>
        <div className="br-eye">Mapa da previsão</div>
        <h2 className="br-h2">Flávio lidera em {flWins} das 27 unidades da federação</h2>
        <p className="br-lede">Lula domina o Nordeste com folga; Flávio vence no Sul, no Centro-Oeste, em São Paulo e no Rio. A eleição se decide nas margens: o tamanho da vitória de Lula na Bahia e em Pernambuco contra o tamanho da vitória de Flávio em São Paulo, no Paraná e em Santa Catarina. Passe o mouse sobre um estado ou clique para ver cada município.</p>
        <div className="br-mapgrid" style={{ marginTop: 16 }}>
          <div className="br-card"><ForecastMap states={states} /></div>
          <div className="br-card">
            <div className="br-card-h"><h3>Os estados mais disputados</h3><span>Margem prevista</span></div>
            <ul className="br-close">
              {close.map((s) => (
                <li key={s.uf}><Link href={`/brasil/${slugOf(s.name)}`}>
                  <span className="uf">{s.uf}</span>
                  <span className="nm">{s.name}<small>{ratingPt(s.rating)} · Flávio {pct(100 * s.p, 0)} de chance</small>
                    <span className="br-meter"><i style={{ left: s.margin < 0 ? `${50 + s.margin * 2}%` : "50%", width: `${Math.min(50, Math.abs(s.margin) * 2)}%`, background: s.margin > 0 ? FL : LU }} /></span></span>
                  <span className={`mg ${s.margin > 0 ? "fl" : "lu"}`}>{mg(s.margin)}</span>
                </Link></li>
              ))}
            </ul>
            <p className="br-note">Minas Gerais, o estado que acompanhou o vencedor em todas as eleições desde 1989, aparece com {mg(b.states.MG.margin)}.</p>
          </div>
        </div>
      </section>

      <section className="br-card">
        <div className="br-card-h"><h3>De onde vêm os votos</h3><span>Saldo previsto de votos por estado</span></div>
        <p className="br-lede" style={{ marginBottom: 14 }}>Num país de 118 milhões de votos válidos, o tamanho do estado pesa tanto quanto a margem. São Paulo sozinho deve dar a Flávio um saldo de {compact(b.states.SP.fv - b.states.SP.lv)} de votos; a Bahia deve devolver a Lula {compact(b.states.BA.lv - b.states.BA.fv)}. Somando tudo, a previsão dá a Flávio um saldo nacional de cerca de {compact(netNat)}.</p>
        <NetVotes states={states} zz={zz} />
      </section>

      <section>
        <div className="br-eye">As pesquisas</div>
        <h2 className="br-h2">Média das pesquisas: Flávio {nf(avgPolls)}%, Lula {nf(100 - avgPolls)}%</h2>
        <p className="br-lede">Usamos apenas os votos válidos de cada pesquisa de 2º turno. Pesquisas mais recentes e com amostras maiores pesam mais; não aplicamos nenhum ajuste de viés aos institutos.</p>
        <div className="br-card" style={{ marginTop: 16 }}>
          <div className="br-tbl-w">
            <table className="br-tbl">
              <thead><tr><th>Instituto</th><th>Campo</th><th className="n">Amostra</th><th className="n">Flávio</th><th className="n">Lula</th><th className="n">Margem</th><th>Peso na média</th></tr></thead>
              <tbody>
                {polls.map((p) => (
                  <tr key={p.pollster + p.field_mid}>
                    <td><b>{p.pollster}</b></td><td className="mono">{dm(p.field_mid)}</td><td className="n">{nint(p.n)}</td>
                    <td className="n fl">{nf(p.flavio)}</td><td className="n lu">{nf(p.lula)}</td><td className={`n ${p.flavio > p.lula ? "fl" : p.flavio < p.lula ? "lu" : ""}`}>{mg(p.flavio - p.lula)}</td>
                    <td className="bar"><div className="br-meter" style={{ marginTop: 0 }}><i style={{ left: 0, width: `${(100 * p.weight) / wmax}%`, background: "var(--gold)" }} /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section>
        <div className="br-eye">Como a previsão é feita</div>
        <h2 className="br-h2">Três fontes, 40 mil simulações</h2>
        <div className="br-legs" style={{ marginTop: 14 }}>
          <div className="br-leg"><small>Pesquisas · 65%</small><b className="fl">{nf(n.legs.polling_avg_flavio)}%</b><p>Média das pesquisas de 2º turno, com mais peso para as recentes e as de amostra maior.</p></div>
          <div className="br-leg"><small>Transferência do 1º turno · 35%</small><b className="fl">{nf(n.legs.transfer_prior_flavio)}%</b><p>Parte do voto real de cada estado no 1º turno e redistribui os eleitores dos candidatos eliminados conforme apoio e perfil de cada um.</p></div>
          <div className="br-leg"><small>Previsão final</small><b className="fl">{nf(n.flavio)}%</b><p>Os estados são ajustados pelo comportamento no 2º turno de 2022 e somados com o comparecimento previsto. Flávio teve {nf(n.legs.r1_2026_flavio_two_way)}% contra Lula no 1º turno; Bolsonaro teve {nf(n.legs.r2_2022_bolsonaro)}% no 2º turno de 2022.</p></div>
        </div>
      </section>

      <section id="estados">
        <div className="br-eye">Explore por estado</div>
        <h2 className="br-h2">A previsão em cada estado e em cada município</h2>
        <div className="br-regions" style={{ marginTop: 14 }}>
          {REGIOES.map((r) => (
            <div key={r} className="br-region">
              <h3>{r}</h3>
              <div className="br-sgrid">
                {states.filter((s) => s.region === r).sort((a, c) => c.valid - a.valid).map((s) => (
                  <Link key={s.uf} href={`/brasil/${slugOf(s.name)}`} className="br-sc" style={{ ["--c" as string]: marginColor(s.margin) }}>
                    <div className="t"><b>{s.name}</b><span className="br-rt" style={ratingStyle(s.rating)}>{ratingPt(s.rating)}</span></div>
                    <div className="m"><span className={s.margin > 0 ? "fl" : "lu"}>{mg(s.margin)}</span><small>{pct(100 * Math.max(s.p, 1 - s.p), 0)} de chance</small></div>
                    <div className="br-prob thin"><i className="f" style={{ width: `${s.flavio}%` }} /><i className="l" style={{ width: `${s.lula}%` }} /><span className="mid" /></div>
                    <div className="f2"><span>2022: Bolsonaro {nf(s.r22)}%</span><span>{compact(s.valid)} votos</span></div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="br-eye">Perguntas frequentes</div>
        <h2 className="br-h2">O que você precisa saber sobre o 2º turno</h2>
        <div className="br-faq" style={{ marginTop: 14 }}>
          {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
        </div>
        <p className="br-note">Previsão do On Point Politics, gerada em {dm(b.updated)}. Os resultados oficiais são os do Tribunal Superior Eleitoral. Na noite da eleição, acompanhe a <Link href="/brasil/resultados" style={{ color: "var(--gold)" }}>apuração ao vivo</Link> e a <Link href="/brasil/monitor" style={{ color: "var(--gold)" }}>Sala de situação</Link>.</p>
      </section>
    </div>
  );
}
