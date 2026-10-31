"use client";
// The interactive part of the forecast pages: the state map with its hover notes.
import React from "react";
import BrMap from "./BrMap";
import { useFmt } from "./i18n";
import { marginColor, ratingStyle, slugOf, type BrState } from "./lib";

export function ForecastMap({ states }: { states: BrState[] }) {
  const x = useFmt();
  const by = Object.fromEntries(states.map((s) => [s.uf, s]));
  return (
    <>
      <BrMap states={states} fill={(uf) => marginColor(by[uf]?.margin)} href={(uf) => `/brasil/${slugOf(by[uf].name)}`}
        tip={(uf) => { const s = by[uf]; if (!s) return null; return (
          <>
            <h4>{s.name}</h4>
            <span className="br-rt" style={ratingStyle(s.rating)}>{x.rating(s.rating)}</span>
            <div className="row" style={{ marginTop: 8 }}><span className="fl">Flávio</span><b>{x.pct(s.flavio)}</b></div>
            <div className="row"><span className="lu">Lula</span><b>{x.pct(s.lula)}</b></div>
            <div className="row"><span>{x.t("Margin", "Margem")}</span><b>{x.mg(s.margin)}</b></div>
            <div className="row"><span>{x.t("Flávio's chance", "Chance de Flávio")}</span><b>{x.pct(100 * s.p, 0)}</b></div>
            <div className="row"><span>{x.t("Projected valid votes", "Votos válidos previstos")}</span><b>{x.nint(s.valid)}</b></div>
            <small>{x.t("Click to see every municipality", "Clique para ver os municípios")}</small>
          </>
        ); }} />
      <div className="br-legend"><span>Lula +40</span><i /><span>Flávio +40</span></div>
    </>
  );
}
