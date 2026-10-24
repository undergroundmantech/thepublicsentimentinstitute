"use client";
// The interactive parts of the forecast pages: the state map with its hover notes, and the countdown to 17h.
import React from "react";
import BrMap from "./BrMap";
import { useCountdown } from "./useBrLive";
import { ELECTION_ISO, marginColor, mg, pct, ratingPt, ratingStyle, slugOf, nint, type BrState } from "./lib";

export function ForecastMap({ states }: { states: BrState[] }) {
  const by = Object.fromEntries(states.map((s) => [s.uf, s]));
  return (
    <>
      <BrMap states={states} fill={(uf) => marginColor(by[uf]?.margin)} href={(uf) => `/brasil/${slugOf(by[uf].name)}`}
        tip={(uf) => { const s = by[uf]; if (!s) return null; return (
          <>
            <h4>{s.name}</h4>
            <span className="br-rt" style={ratingStyle(s.rating)}>{ratingPt(s.rating)}</span>
            <div className="row" style={{ marginTop: 8 }}><span className="fl">Flávio</span><b>{pct(s.flavio)}</b></div>
            <div className="row"><span className="lu">Lula</span><b>{pct(s.lula)}</b></div>
            <div className="row"><span>Margem</span><b>{mg(s.margin)}</b></div>
            <div className="row"><span>Chance de Flávio</span><b>{pct(100 * s.p, 0)}</b></div>
            <div className="row"><span>Votos válidos previstos</span><b>{nint(s.valid)}</b></div>
            <small>Clique para ver os municípios</small>
          </>
        ); }} />
      <div className="br-legend"><span>Lula +40</span><i /><span>Flávio +40</span></div>
    </>
  );
}

export function Countdown({ label = "Fechamento das urnas" }: { label?: string }) {
  const c = useCountdown(ELECTION_ISO);
  if (!c) return <div className="br-count" aria-hidden="true" style={{ minHeight: 58 }} />;
  if (c.done) return <div className="br-chip gold">Urnas fechadas · apuração em andamento</div>;
  const cell = (v: number, l: string) => <div><b>{String(v).padStart(2, "0")}</b><small>{l}</small></div>;
  return (
    <div>
      <div className="br-eye" style={{ textAlign: "center", marginBottom: 8 }}>{label} · 17h de Brasília</div>
      <div className="br-count" role="timer" aria-label="Contagem regressiva para o fechamento das urnas">
        {c.d > 0 && cell(c.d, "dias")}{cell(c.h, "horas")}{cell(c.m, "min")}{cell(c.s, "seg")}
      </div>
    </div>
  );
}
