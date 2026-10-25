"use client";
// The interactive parts of the forecast pages: the state map with its hover notes, and the countdown to poll close.
import React from "react";
import BrMap from "./BrMap";
import { useCountdown } from "./useBrLive";
import { useFmt } from "./i18n";
import { ELECTION_ISO, marginColor, ratingStyle, slugOf, type BrState } from "./lib";

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

export function Countdown() {
  const x = useFmt();
  const c = useCountdown(ELECTION_ISO);
  if (!c) return <div className="br-count" aria-hidden="true" style={{ minHeight: 58 }} />;
  if (c.done) return <div className="br-chip gold">{x.t("Polls closed · counting under way", "Urnas fechadas · apuração em andamento")}</div>;
  const cell = (v: number, l: string) => <div><b>{String(v).padStart(2, "0")}</b><small>{l}</small></div>;
  return (
    <div>
      <div className="br-eye" style={{ textAlign: "center", marginBottom: 8 }}>{x.t("Polls close · 5 PM Brasília, 4 PM Eastern", "Fechamento das urnas · 17h de Brasília")}</div>
      <div className="br-count" role="timer" aria-label={x.t("Countdown to poll close", "Contagem regressiva para o fechamento das urnas")}>
        {c.d > 0 && cell(c.d, x.t("days", "dias"))}{cell(c.h, x.t("hours", "horas"))}{cell(c.m, "min")}{cell(c.s, x.t("sec", "seg"))}
      </div>
    </div>
  );
}
