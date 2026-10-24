"use client";
// /brasil/resultados: the national count, the On Point projection, the state map and the table of every state.
import React, { useMemo, useState } from "react";
import Link from "next/link";
import BrMap from "../BrMap";
import { useBrLive } from "../useBrLive";
import { Cards, ProjBand, Reporting, SimBanner, Status, swingColor } from "../LiveBits";
import { marginColor, mg, nf, nint, pct, slugOf, type BrState } from "../lib";

type Color = "res" | "vs";

export default function LiveNational({ states, nat }: { states: BrState[]; nat: { flavio: number; p_flavio: number; p10: number; p90: number; valid: number } }) {
  const { live, err, sim } = useBrLive();
  const [color, setColor] = useState<Color>("res");
  const by = useMemo(() => Object.fromEntries(states.map((s) => [s.uf, s])), [states]);
  const n = live?.nat;
  const proj = n && n.proj.counted > 0 ? n.proj : { f: nat.flavio, lo: nat.p10, hi: nat.p90, p: nat.p_flavio, total: nat.valid, counted: 0, call: null, swing: null };
  const counted = (n?.fv ?? 0) + (n?.lv ?? 0);
  const st = (uf: string) => live?.st[uf];
  const share = (uf: string) => { const x = st(uf); const t = (x?.fv ?? 0) + (x?.lv ?? 0); return t > 0 ? (100 * x!.fv) / t : null; };
  const fill = (uf: string) => {
    const f = share(uf);
    if (f == null) return marginColor(by[uf]?.margin, 0.22);
    return color === "res" ? marginColor(2 * f - 100) : swingColor(f - by[uf].flavio);
  };
  const rows = [...states].sort((a, b) => b.valid - a.valid);
  const qs = sim ? "?simular=1" : "";
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <SimBanner sim={sim} />
      <section className="br-live-top">
        <div className="br-card">
          <Status t={live?.t} counted={counted} err={err} />
          <Cards fv={n?.fv ?? 0} lv={n?.lv ?? 0} call={proj.call} />
          <Reporting pr={n?.pr ?? 0} counted={counted} total={proj.total} />
          <p className="br-note">Percentuais sobre os votos válidos já apurados pelo TSE. Brancos e nulos não entram na conta.</p>
        </div>
        <div className="br-card"><ProjBand proj={proj} /></div>
      </section>

      <section className="br-mapgrid">
        <div className="br-card">
          <div className="br-card-h">
            <h3>{color === "res" ? "Quem lidera em cada estado" : "Cada estado contra o esperado"}</h3>
            <div className="br-tabs" role="group" aria-label="Cor do mapa">
              <button type="button" aria-pressed={color === "res"} onClick={() => setColor("res")}>Resultado</button>
              <button type="button" aria-pressed={color === "vs"} onClick={() => setColor("vs")}>Contra a previsão</button>
            </div>
          </div>
          <BrMap states={states} fill={fill} href={(uf) => `/brasil/resultados/${slugOf(by[uf].name)}${qs}`} glow={(uf) => !!st(uf)?.proj.call}
            tip={(uf) => { const s = by[uf], x = st(uf), f = share(uf); return (
              <>
                <h4>{s.name}</h4>
                {f == null ? <p style={{ margin: 0 }}>Ainda sem votos apurados. Previsão: {mg(s.margin)}.</p> : <>
                  <div className="row"><span className="fl">Flávio</span><b>{pct(f, 2)}</b></div>
                  <div className="row"><span className="lu">Lula</span><b>{pct(100 - f, 2)}</b></div>
                  <div className="row"><span>Apurado</span><b>{pct(x!.pr, 1)}</b></div>
                  <div className="row"><span>Previsão para o estado</span><b>{pct(s.flavio)}</b></div>
                  <div className="row"><span>Projeção final</span><b>{mg(2 * x!.proj.f - 100)}</b></div>
                  {x!.proj.call && <small>Projeção: {x!.proj.call === "F" ? "Flávio" : "Lula"} vence no estado</small>}
                </>}
              </>
            ); }} />
          {color === "res"
            ? <div className="br-legend"><span>Lula +40</span><i /><span>Flávio +40</span></div>
            : <div className="br-legend"><span>Lula acima do previsto</span><i style={{ background: "linear-gradient(90deg, rgb(224,50,60), rgba(224,50,60,.12) 49%, rgba(47,111,227,.12) 51%, rgb(47,111,227))" }} /><span>Flávio acima</span></div>}
          <p className="br-note">Estados em tom claro ainda não têm votos apurados e mostram a previsão.</p>
        </div>
        <div className="br-card">
          <div className="br-card-h"><h3>Como ler a noite</h3><span>17h de Brasília</span></div>
          <ul className="br-close" style={{ gap: 10 }}>
            <li style={{ fontSize: 13.5, color: "var(--ink2)", lineHeight: 1.55 }}>O TSE divulga os primeiros números logo depois das 17h. Norte e Nordeste costumam apurar mais rápido; São Paulo e Minas Gerais demoram mais, por causa do tamanho.</li>
            <li style={{ fontSize: 13.5, color: "var(--ink2)", lineHeight: 1.55 }}>Por isso o placar do começo da noite pode enganar. A projeção corrige isso: compara cada município apurado com a previsão e estima o que falta em cada estado.</li>
            <li style={{ fontSize: 13.5, color: "var(--ink2)", lineHeight: 1.55 }}>Só apontamos um vencedor quando a diferença projetada fica grande demais para os votos que faltam. O resultado oficial é sempre o do TSE.</li>
          </ul>
          <Link href={`/brasil/monitor${qs}`} className="br-more" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>Abrir a Sala de situação em tela cheia</Link>
        </div>
      </section>

      <section className="br-card">
        <div className="br-card-h"><h3>Todos os estados</h3><span>Atualiza a cada 30 segundos</span></div>
        <div className="br-tbl-w">
          <table className="br-tbl">
            <thead><tr><th>Estado</th><th className="n">Apurado</th><th className="n">Flávio</th><th className="n">Lula</th><th className="n">Previsão</th><th className="n">Diferença</th><th className="n">Projeção</th><th>Situação</th></tr></thead>
            <tbody>
              {rows.map((s) => {
                const x = st(s.uf), f = share(s.uf), d = f == null ? null : f - s.flavio;
                return (
                  <tr key={s.uf}>
                    <td><Link href={`/brasil/resultados/${slugOf(s.name)}${qs}`}>{s.name}</Link></td>
                    <td className="n">{x ? pct(x.pr, 1) : "0,0%"}</td>
                    <td className="n fl">{f == null ? "" : nf(f, 2)}</td><td className="n lu">{f == null ? "" : nf(100 - f, 2)}</td>
                    <td className="n">{nf(s.flavio)}</td>
                    <td className={`n ${d == null ? "" : d > 0 ? "fl" : "lu"}`}>{d == null ? "" : `${d > 0 ? "+" : "−"}${nf(Math.abs(d))}`}</td>
                    <td className="n">{x && f != null ? mg(2 * x.proj.f - 100) : mg(s.margin)}</td>
                    <td>{x?.proj.call ? <span className={`br-call ${x.proj.call === "F" ? "f" : "l"}`}>{x.proj.call === "F" ? "Flávio vence" : "Lula vence"}</span> : f != null ? <span className="br-status on" style={{ letterSpacing: ".06em" }}><i />Em apuração</span> : <span className="br-status">Aguardando</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="br-note">Flávio e Lula: percentual dos votos válidos apurados. Previsão: o percentual de Flávio no modelo. Diferença: quanto Flávio está acima ou abaixo da previsão nos votos já contados. Votos contados: {nint(counted)}.</p>
      </section>
    </div>
  );
}
