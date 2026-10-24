"use client";
// /brasil/resultados/[estado]: one state's count, its projection and every municipality as it reports.
import React, { useEffect, useMemo, useRef, useState } from "react";
import MunMap, { useMun } from "../MunMap";
import { useBrLive } from "../useBrLive";
import { Cards, ProjBand, Reporting, SimBanner, Status, swingColor } from "../LiveBits";
import { inState, keyOf, marginColor, mg, nf, nint, pct, type BrState, type MunRow } from "../lib";

type Color = "res" | "vs";

export default function LiveState({ s }: { s: BrState }) {
  const { live, err, sim } = useBrLive();
  const rows = useMun(s.uf);
  const [color, setColor] = useState<Color>("res");
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const x = live?.st[s.uf];
  const m = x?.m ?? {};
  // municipalities that reported since the last update flash once on the map
  const prev = useRef<Record<string, number>>({});
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    const nw = new Set<string>();
    for (const [k, v] of Object.entries(m)) { const c = v[0] + v[1]; if (prev.current[k] !== undefined && c > prev.current[k]) nw.add(k); prev.current[k] = c; }
    setFresh(nw);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);
  const share = (r: MunRow) => { const v = m[keyOf(r[1])]; const t = v ? v[0] + v[1] : 0; return t > 0 ? (100 * v![0]) / t : null; };
  const fill = (r: MunRow) => {
    const f = share(r);
    if (f == null) return marginColor(r[2] == null ? null : 2 * r[2] - 100, 0.2);
    return color === "res" ? marginColor(2 * f - 100) : swingColor(r[2] == null ? null : f - r[2]);
  };
  const proj = x && x.proj.counted > 0 ? x.proj : { f: s.flavio, lo: s.p10, hi: s.p90, p: s.p, total: s.valid, counted: 0, call: null, swing: null };
  const counted = (x?.fv ?? 0) + (x?.lv ?? 0);
  const list = useMemo(() => {
    if (!rows) return [];
    const nq = q.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
    return rows.filter((r) => !nq || keyOf(r[1]).includes(nq.replace(/[^a-z]/g, "")))
      .map((r) => { const v = m[keyOf(r[1])]; return { r, v, c: v ? v[0] + v[1] : 0 }; })
      .sort((a, b) => b.c - a.c || b.r[3] - a.r[3]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, live]);
  const reported = list.filter((l) => l.c > 0).length;
  const shown = all ? list : list.slice(0, 40);
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <SimBanner sim={sim} />
      <section className="br-live-top">
        <div className="br-card">
          <Status t={live?.t} counted={counted} err={err} />
          <Cards fv={x?.fv ?? 0} lv={x?.lv ?? 0} call={proj.call} winLabel={`Vence ${inState(s.uf, s.name)}`.length > 22 ? "Vence no estado" : `Vence ${inState(s.uf, s.name)}`} />
          <Reporting pr={x?.pr ?? 0} counted={counted} total={proj.total} />
          {rows && <p className="br-note">{nint(reported)} de {nint(rows.length)} municípios com votos apurados.</p>}
        </div>
        <div className="br-card"><ProjBand proj={proj} label={`Projeção para ${s.uf === "DF" ? "o Distrito Federal" : s.name}`} scope={inState(s.uf, s.name)} /></div>
      </section>

      <section className="br-card">
        <div className="br-card-h">
          <h3>{color === "res" ? "Quem lidera em cada município" : "Cada município contra a previsão"}</h3>
          <div className="br-tabs" role="group" aria-label="Cor do mapa">
            <button type="button" aria-pressed={color === "res"} onClick={() => setColor("res")}>Resultado</button>
            <button type="button" aria-pressed={color === "vs"} onClick={() => setColor("vs")}>Contra a previsão</button>
          </div>
        </div>
        {rows ? <MunMap rows={rows} fill={fill} glow={(r) => fresh.has(keyOf(r[1]))} tip={(r) => { const f = share(r), v = m[keyOf(r[1])]; return (
          <>
            <h4>{r[1]}</h4>
            {f == null ? <p style={{ margin: 0 }}>Ainda sem votos apurados.{r[2] != null && ` Previsão: ${mg(2 * r[2] - 100)}.`}</p> : <>
              <div className="row"><span className="fl">Flávio</span><b>{pct(f, 2)}</b></div>
              <div className="row"><span className="lu">Lula</span><b>{pct(100 - f, 2)}</b></div>
              <div className="row"><span>Votos contados</span><b>{nint(v![0] + v![1])}</b></div>
              <div className="row"><span>Apurado</span><b>{pct(v![2], 0)}</b></div>
              {r[2] != null && <div className="row"><span>Previsão</span><b>{pct(r[2])}</b></div>}
            </>}
          </>
        ); }} /> : <div style={{ height: "min(72vh,720px)", display: "grid", placeItems: "center", color: "var(--mute)" }}>Carregando os municípios…</div>}
        {color === "res"
          ? <div className="br-legend"><span>Lula +40</span><i /><span>Flávio +40</span></div>
          : <div className="br-legend"><span>Lula acima do previsto</span><i style={{ background: "linear-gradient(90deg, rgb(224,50,60), rgba(224,50,60,.12) 49%, rgba(47,111,227,.12) 51%, rgb(47,111,227))" }} /><span>Flávio acima</span></div>}
        <p className="br-note">Municípios em tom claro ainda não têm votos apurados e mostram a previsão. Os que acabaram de chegar piscam no mapa.</p>
      </section>

      <section className="br-card">
        <div className="br-card-h"><h3>Municípios</h3><span>Os que já apuraram aparecem primeiro</span></div>
        <div className="br-search" style={{ marginBottom: 12 }}>
          <label htmlFor="br-q2" className="br-eye" style={{ color: "var(--mute)" }}>Buscar</label>
          <input id="br-q2" type="search" placeholder="Digite o nome do município" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="br-tbl-w" style={{ maxHeight: all ? 640 : undefined, overflowY: all ? "auto" : undefined }}>
          <table className="br-tbl">
            <thead><tr><th>Município</th><th className="n">Votos contados</th><th className="n">Apurado</th><th className="n">Flávio</th><th className="n">Lula</th><th className="n">Previsão</th><th className="n">Diferença</th></tr></thead>
            <tbody>
              {shown.map(({ r, v, c }) => {
                const f = c > 0 ? (100 * v![0]) / c : null, d = f != null && r[2] != null ? f - r[2] : null;
                return (
                  <tr key={r[0]} className={fresh.has(keyOf(r[1])) ? "on" : ""}>
                    <td><b>{r[1]}</b></td><td className="n">{nint(c)}</td><td className="n">{v ? pct(v[2], 0) : "0%"}</td>
                    <td className="n fl">{f == null ? "" : nf(f, 2)}</td><td className="n lu">{f == null ? "" : nf(100 - f, 2)}</td>
                    <td className="n">{r[2] == null ? "" : nf(r[2])}</td>
                    <td className={`n ${d == null ? "" : d > 0 ? "fl" : "lu"}`}>{d == null ? "" : `${d > 0 ? "+" : "−"}${nf(Math.abs(d))}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!all && list.length > 40 && <button type="button" className="br-more" onClick={() => setAll(true)}>Mostrar os {nint(list.length)} municípios</button>}
      </section>
    </div>
  );
}
