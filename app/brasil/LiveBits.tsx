"use client";
// Pieces shared by the live results pages: the status line, the two candidate cards, the reporting bar and the
// On Point projection with its band.
import React from "react";
import { useCountdown } from "./useBrLive";
import { ELECTION_ISO, mg, nf, nint, pct } from "./lib";
import type { Proj } from "./project";

export function SimBanner({ sim }: { sim: boolean }) {
  if (!sim) return null;
  return <div className="br-sim" role="status">Simulação: estes números são fictícios, gerados a partir da previsão para mostrar como a página funciona na noite da eleição. <a href="?">Voltar aos dados reais</a></div>;
}

export function Status({ t, counted, err }: { t?: string; counted: number; err: boolean }) {
  const c = useCountdown(ELECTION_ISO);
  if (c && !c.done && counted === 0) return <span className="br-status">Urnas fecham em {c.d > 0 ? `${c.d}d ` : ""}{c.h}h {String(c.m).padStart(2, "0")}min · 17h de Brasília</span>;
  const when = t ? new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "";
  if (err) return <span className="br-status">Sem conexão com a apuração, tentando de novo</span>;
  return <span className={`br-status${counted > 0 ? " on" : ""}`}><i />{counted > 0 ? `Apuração ao vivo · atualizado às ${when}` : "Aguardando os primeiros números do TSE"}</span>;
}

export function Cards({ fv, lv, call, winLabel = "Eleito" }: { fv: number; lv: number; call: "F" | "L" | null; winLabel?: string }) {
  const t = fv + lv, f = t ? (100 * fv) / t : 0, l = t ? 100 - f : 0;
  const card = (k: "F" | "L", nm: string, party: string, p: number, v: number) => (
    <div className={`c${call === k ? " win" : ""}`} style={{ ["--c" as string]: k === "F" ? "var(--fl)" : "var(--lu)" }}>
      {call === k && <span className="ok">{winLabel}</span>}
      <small>{party}</small><b>{nm}</b>
      <span className={`p ${k === "F" ? "fl" : "lu"}`}>{t ? `${nf(p, 2)}%` : "0,00%"}</span>
      <span className="v">{nint(v)} votos</span>
    </div>
  );
  return <div className="br-big">{card("F", "Flávio Bolsonaro", "PL", f, fv)}{card("L", "Lula", "PT", l, lv)}</div>;
}

export function Reporting({ pr, counted, total }: { pr: number; counted: number; total: number }) {
  const share = total > 0 ? Math.min(100, (100 * counted) / total) : 0;
  const p = pr > 0 ? pr : share;
  return (
    <div className="br-rep">
      <div className="lab"><span>{nf(p, 2)}% das seções apuradas</span><span>{nint(counted)} votos válidos contados</span></div>
      <div className="track"><i style={{ width: `${p}%` }} /></div>
    </div>
  );
}

export function ProjBand({ proj, label = "Projeção On Point do resultado final", scope = "no país" }: { proj: Proj; label?: string; scope?: string }) {
  const lo = 40, hi = 60, X = (v: number) => `${Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100))}%`;
  const started = proj.counted > 0;
  return (
    <div className="br-proj">
      <div className="br-card-h" style={{ marginBottom: 0 }}><h3>{label}</h3><span>{started ? "Atualiza com a apuração" : "Antes da apuração: a previsão"}</span></div>
      <div className="band" aria-label={`Projeção: Flávio ${nf(proj.f)}%, faixa de ${nf(proj.lo)}% a ${nf(proj.hi)}%`}>
        <span className="mid" />
        <span className="rng" style={{ left: X(proj.lo), width: `calc(${X(proj.hi)} - ${X(proj.lo)})` }} />
        <span className="pt" style={{ left: X(proj.f) }} />
      </div>
      <div className="ticks"><span>Lula 60%</span><span>55%</span><span>50%</span><span>55%</span><span>Flávio 60%</span></div>
      <div className="br-vote"><span className="fl">Flávio {pct(proj.f)}</span><span>{mg(2 * proj.f - 100)}</span><span className="lu">Lula {pct(100 - proj.f)}</span></div>
      <div className="br-callbox">
        {proj.call
          ? <><b className={proj.call === "F" ? "fl" : "lu"}>{proj.call === "F" ? "Flávio Bolsonaro" : "Lula"} vence {scope}</b><p>{started ? "Com os votos já apurados, a diferença ficou grande demais para ser revertida pelos votos que faltam." : ""}</p></>
          : <><b>{started ? "Ainda sem projeção de vencedor" : "Aguardando a apuração"}</b>
            <p>Chance de vitória agora: Flávio {pct(100 * proj.p, 1)}, Lula {pct(100 - 100 * proj.p, 1)}. {started ? `Em 8 de cada 10 cenários, Flávio termina entre ${pct(proj.lo)} e ${pct(proj.hi)}.` : "Quando os votos começarem a chegar, a projeção compara cada município com o que o modelo esperava e estima os votos que faltam."}</p></>}
      </div>
    </div>
  );
}

export const swingColor = (d: number | null, a0 = 0.12) => {
  if (d == null) return "rgba(120,110,140,.25)";
  const a = Math.min(1, Math.abs(d) / 6), t = Math.pow(a, 0.8);
  return d >= 0 ? `rgba(47,111,227,${a0 + 0.85 * t})` : `rgba(224,50,60,${a0 + 0.85 * t})`;
};
