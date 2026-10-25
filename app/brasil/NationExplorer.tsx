"use client";
// /brasil/estados: the whole country municipality by municipality, with a panel for the state or town you pick.
import React, { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import NationCanvas, { useAllMun, type CanvasHandle, type Muni } from "./NationCanvas";
import { UF_ORDER, marginColor, ratingStyle, slugOf, type BrState } from "./lib";
import { useFmt } from "./i18n";

export default function NationExplorer({ states }: { states: BrState[] }) {
  const munis = useAllMun(UF_ORDER);
  const x = useFmt(), { nf, nint, pct, t } = x, mg = (m: number) => x.mg(m);
  const by = useMemo(() => Object.fromEntries(states.map((s) => [s.uf, s])), [states]);
  const borders = useMemo(() => states.filter((s) => s.d).map((s) => ({ uf: s.uf, d: s.d! })), [states]);
  const cref = useRef<CanvasHandle>(null);
  const [uf, setUf] = useState<string | null>(null);
  const [mun, setMun] = useState<Muni | null>(null);
  const fill = useCallback((m: Muni) => marginColor(m.row[2] == null ? null : 2 * m.row[2] - 100), []);
  const go = (u: string | null) => { setUf(u); setMun(null); cref.current?.fly(u); };
  const s = uf ? by[uf] : null;
  return (
    <div className="br-mapgrid">
      <div className="br-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ position: "relative", height: "min(78vh, 820px)", background: "radial-gradient(70% 70% at 50% 45%, color-mix(in srgb, var(--bg2) 70%, #0f1a3a), var(--bg))" }}>
          <NationCanvas ref={cref} munis={munis} borders={borders} fill={fill} sel={uf} ctrlWheel
            onPick={(m) => { if (m.uf !== uf) { setUf(m.uf); cref.current?.fly(m.uf); } setMun(m); }}
            tip={(m) => (<><h4>{m.row[1]} <span style={{ color: "var(--mute)", fontWeight: 600 }}>{m.uf}</span></h4>
              {m.row[2] != null && <><div className="row"><span className="fl">Flávio</span><b>{pct(m.row[2])}</b></div><div className="row"><span className="lu">Lula</span><b>{pct(100 - m.row[2])}</b></div></>}
              <div className="row"><span>{t("Projected valid votes", "Votos válidos previstos")}</span><b>{nint(m.row[3])}</b></div></>)} />
          {munis.length < 5000 && <div style={{ position: "absolute", left: 16, bottom: 14, font: "700 11px var(--font-m)", color: "var(--mute)" }}>{t("Loading municipalities", "Carregando municípios")} · {nint(munis.length)}</div>}
          <div className="mm-z">
            <button type="button" aria-label={t("Zoom in", "Aproximar")} onClick={() => cref.current?.zoom(1.6)}>+</button>
            <button type="button" aria-label={t("Zoom out", "Afastar")} onClick={() => cref.current?.zoom(0.62)}>−</button>
            <button type="button" className="t" onClick={() => go(null)}>{t("Brazil", "Brasil")}</button>
          </div>
        </div>
      </div>
      <div className="br-card" style={{ display: "grid", gap: 14, alignContent: "start" }}>
        <div className="br-card-h" style={{ marginBottom: 0 }}><h3>{s ? s.name : t("Pick a state", "Escolha um estado")}</h3><span>{s ? x.region(s.region) : t("Click the map", "Clique no mapa")}</span></div>
        <div className="br-pick">
          {UF_ORDER.map((u) => <a key={u} href={`#${u}`} aria-current={u === uf ? "page" : undefined} onClick={(e) => { e.preventDefault(); go(u); }} title={by[u]?.name}>{u}</a>)}
        </div>
        {s ? (
          <>
            <div><span className="br-rt" style={ratingStyle(s.rating)}>{x.rating(s.rating)}</span></div>
            <div className="br-big" style={{ margin: 0 }}>
              <div className="c" style={{ ["--c" as string]: "var(--fl)" }}><small>Flávio</small><span className="p fl" style={{ fontSize: 34 }}>{nf(s.flavio)}%</span></div>
              <div className="c" style={{ ["--c" as string]: "var(--lu)" }}><small>Lula</small><span className="p lu" style={{ fontSize: 34 }}>{nf(s.lula)}%</span></div>
            </div>
            <div className="br-tip" style={{ background: "var(--glass)", boxShadow: "none", maxWidth: "none" }}>
              <div className="row"><span>{t("Projected margin", "Margem prevista")}</span><b>{mg(s.margin)}</b></div>
              <div className="row"><span>{t("Flávio's chance", "Chance de Flávio")}</span><b>{pct(100 * s.p, 0)}</b></div>
              <div className="row"><span>{t("Projected valid votes", "Votos válidos previstos")}</span><b>{nint(s.valid)}</b></div>
              <div className="row"><span>{t("Flávio, first round", "Flávio no 1º turno")}</span><b>{pct(s.r1)}</b></div>
              <div className="row"><span>{t("Bolsonaro in 2022", "Bolsonaro em 2022")}</span><b>{pct(s.r22)}</b></div>
            </div>
            {mun && (
              <div className="br-callbox">
                <div className="br-eye">{t("Municipality", "Município")}</div>
                <b>{mun.row[1]}</b>
                {mun.row[2] != null && <p>{t(`Forecast: Flávio ${pct(mun.row[2])}, Lula ${pct(100 - mun.row[2])}, ${mg(2 * mun.row[2] - 100)}. `, `Previsão: Flávio ${pct(mun.row[2])}, Lula ${pct(100 - mun.row[2])}, ${mg(2 * mun.row[2] - 100)}. `)}{mun.row[4] != null && t(`In the first round Flávio won ${pct(mun.row[4])} of the votes for the two. `, `No 1º turno, Flávio teve ${pct(mun.row[4])} dos votos dados aos dois. `)}{t(`${nint(mun.row[3])} projected valid votes.`, `São ${nint(mun.row[3])} votos válidos previstos.`)}</p>}
              </div>
            )}
            <Link href={`/brasil/${slugOf(s.name)}`} className="br-more" style={{ textAlign: "center", textDecoration: "none" }}>{t(`Open ${s.name} with every municipality`, `Abrir ${s.name} com todos os municípios`)}</Link>
          </>
        ) : <p className="br-note" style={{ margin: 0 }}>{t(`The map shows the forecast in each of ${nint(munis.length || 5570)} municipalities. Click a town or a state to zoom in; drag to move, and use Ctrl and scroll or the buttons to zoom.`, `O mapa mostra a previsão em cada um dos ${nint(munis.length || 5570)} municípios. Clique num município ou num estado para aproximar; arraste para mover e use Ctrl com a rolagem ou os botões para mudar o zoom.`)}</p>}
        <div className="br-legend"><span>Lula +40</span><i /><span>Flávio +40</span></div>
      </div>
    </div>
  );
}
