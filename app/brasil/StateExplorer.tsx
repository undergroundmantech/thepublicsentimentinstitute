"use client";
// One state's forecast, municipality by municipality: the map, three ways to color it, and a table you can search
// and sort. Clicking a municipality on the map finds it in the table.
import React, { useMemo, useState } from "react";
import MunMap, { useMun } from "./MunMap";
import { marginColor, mg, nf, nint, pct, type MunRow } from "./lib";

type Mode = "prev" | "r1" | "var";
type Key = "name" | "valid" | "flavio" | "margin" | "r1" | "var";
const swingColor = (d: number | null) => {
  if (d == null) return "rgba(120,110,140,.3)";
  const a = Math.min(1, Math.abs(d) / 8), t = Math.pow(a, 0.8);
  return d >= 0 ? `rgba(47,111,227,${0.12 + 0.85 * t})` : `rgba(224,50,60,${0.12 + 0.85 * t})`;
};

export default function StateExplorer({ uf, name }: { uf: string; name: string }) {
  const rows = useMun(uf);
  const [mode, setMode] = useState<Mode>("prev");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<[Key, 1 | -1]>(["valid", -1]);
  const [sel, setSel] = useState<number | null>(null);
  const [all, setAll] = useState(false);
  const val = (r: MunRow, k: Key): number | string => {
    switch (k) { case "name": return r[1]; case "valid": return r[3]; case "flavio": return r[2] ?? -1; case "margin": return r[2] == null ? -999 : 2 * r[2] - 100;
      case "r1": return r[4] ?? -1; case "var": return r[2] != null && r[4] != null ? r[2] - r[4] : -999; }
  };
  const list = useMemo(() => {
    if (!rows) return [];
    const nq = q.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
    const f = nq ? rows.filter((r) => r[1].normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(nq)) : rows;
    return [...f].sort((a, b) => { const x = val(a, sort[0]), y = val(b, sort[0]); return (typeof x === "string" ? x.localeCompare(y as string, "pt-BR") : (x as number) - (y as number)) * sort[1]; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, sort]);
  const stats = useMemo(() => {
    if (!rows) return null;
    const fl = rows.filter((r) => (r[2] ?? 50) > 50).length;
    return { n: rows.length, fl, lu: rows.length - fl };
  }, [rows]);
  const fill = (r: MunRow) => mode === "prev" ? marginColor(r[2] == null ? null : 2 * r[2] - 100) : mode === "r1" ? marginColor(r[4] == null ? null : 2 * r[4] - 100) : swingColor(r[2] != null && r[4] != null ? r[2] - r[4] : null);
  const th = (k: Key, l: string, n = true) => (
    <th className={n ? "n" : ""} aria-sort={sort[0] === k ? (sort[1] > 0 ? "ascending" : "descending") : undefined}>
      <button type="button" onClick={() => setSort(([s, d]) => [k, s === k ? (d === 1 ? -1 : 1) : k === "name" ? 1 : -1])}>{l}{sort[0] === k ? (sort[1] > 0 ? " ▲" : " ▼") : ""}</button>
    </th>
  );
  const pick = (r: MunRow) => { setSel(r[0]); setQ(""); setAll(true); setTimeout(() => document.getElementById(`m${r[0]}`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 60); };
  const shown = all ? list : list.slice(0, 40);
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div className="br-card">
        <div className="br-card-h">
          <h3>{stats ? (stats.n === 1 ? `${name}, município único` : `${nint(stats.n)} municípios`) : "Carregando o mapa"}</h3>
          <div className="br-tabs" role="group" aria-label="Cor do mapa">
            <button type="button" aria-pressed={mode === "prev"} onClick={() => setMode("prev")}>Previsão do 2º turno</button>
            <button type="button" aria-pressed={mode === "r1"} onClick={() => setMode("r1")}>1º turno, só os dois</button>
            <button type="button" aria-pressed={mode === "var"} onClick={() => setMode("var")}>Variação desde o 1º turno</button>
          </div>
        </div>
        {rows ? (
          <MunMap rows={rows} fill={fill} sel={sel} onPick={pick} tip={(r) => (
            <>
              <h4>{r[1]}</h4>
              {r[2] != null && <><div className="row"><span className="fl">Flávio</span><b>{pct(r[2])}</b></div><div className="row"><span className="lu">Lula</span><b>{pct(100 - r[2])}</b></div>
                <div className="row"><span>Margem prevista</span><b>{mg(2 * r[2] - 100)}</b></div></>}
              {r[4] != null && <div className="row"><span>Flávio no 1º turno</span><b>{pct(r[4])}</b></div>}
              <div className="row"><span>Votos válidos previstos</span><b>{nint(r[3])}</b></div>
            </>
          )} />
        ) : <div style={{ height: "min(72vh, 720px)", display: "grid", placeItems: "center", color: "var(--mute)" }}>Carregando os municípios…</div>}
        {mode === "var"
          ? <div className="br-legend"><span>Lula ganha 8 pts</span><i style={{ background: "linear-gradient(90deg, rgb(224,50,60), rgba(224,50,60,.12) 49%, rgba(47,111,227,.12) 51%, rgb(47,111,227))" }} /><span>Flávio ganha 8 pts</span></div>
          : <div className="br-legend"><span>Lula +40</span><i /><span>Flávio +40</span></div>}
        <p className="br-note">{stats && `Flávio deve vencer em ${nint(stats.fl)} municípios e Lula em ${nint(stats.lu)}. `}No 1º turno, a comparação usa só os votos de Flávio e Lula. Arraste para mover o mapa, use os botões ou Ctrl com a rolagem para aproximar, e clique duas vezes para voltar.</p>
      </div>

      <div className="br-card">
        <div className="br-card-h"><h3>Todos os municípios</h3><span>Clique num município no mapa para achá-lo aqui</span></div>
        <div className="br-search" style={{ marginBottom: 12 }}>
          <label htmlFor="br-q" className="br-eye" style={{ color: "var(--mute)" }}>Buscar</label>
          <input id="br-q" type="search" placeholder="Digite o nome do município" value={q} onChange={(e) => { setQ(e.target.value); setSel(null); }} />
        </div>
        <div className="br-tbl-w" style={{ maxHeight: all ? 640 : undefined, overflowY: all ? "auto" : undefined }}>
          <table className="br-tbl">
            <thead><tr>{th("name", "Município", false)}{th("valid", "Votos válidos")}{th("flavio", "Flávio")}<th className="n">Lula</th>{th("margin", "Margem")}{th("r1", "1º turno")}{th("var", "Variação")}</tr></thead>
            <tbody>
              {shown.map((r) => {
                const m = r[2] == null ? null : 2 * r[2] - 100, v = r[2] != null && r[4] != null ? r[2] - r[4] : null;
                return (
                  <tr key={r[0]} id={`m${r[0]}`} className={sel === r[0] ? "on" : ""} onClick={() => setSel(r[0])}>
                    <td><b>{r[1]}</b></td><td className="n">{nint(r[3])}</td>
                    <td className="n fl">{r[2] == null ? "" : nf(r[2])}</td><td className="n lu">{r[2] == null ? "" : nf(100 - r[2])}</td>
                    <td className={`n ${m != null && m > 0 ? "fl" : "lu"}`}>{m == null ? "" : mg(m)}</td>
                    <td className="n">{r[4] == null ? "" : nf(r[4])}</td>
                    <td className={`n ${v != null && v > 0 ? "fl" : "lu"}`}>{v == null ? "" : `${v > 0 ? "+" : "−"}${nf(Math.abs(v))}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!all && list.length > 40 && <button type="button" className="br-more" onClick={() => setAll(true)}>Mostrar os {nint(list.length)} municípios</button>}
        <p className="br-note">Flávio, Lula e 1º turno em percentual dos votos válidos dados aos dois. Variação é a diferença entre a previsão de Flávio e o resultado dele no 1º turno.</p>
      </div>
    </div>
  );
}
