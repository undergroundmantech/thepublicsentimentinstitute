"use client";
// Pieces shared by the live results pages: the status line, the two candidate cards, the reporting bar and the
// On Point projection with its band. Every label follows the reader's language.
import React from "react";
import { useCountdown } from "./useBrLive";
import { useFmt } from "./i18n";
import { ELECTION_ISO } from "./lib";
import type { Proj } from "./project";

export function SimBanner({ sim }: { sim: boolean }) {
  const { t } = useFmt();
  if (!sim) return null;
  return <div className="br-sim" role="status">{t("Simulation: these numbers are made up from the forecast to show how the page works on election night. ", "Simulação: estes números são fictícios, gerados a partir da previsão para mostrar como a página funciona na noite da eleição. ")}<a href="?">{t("Back to the real data", "Voltar aos dados reais")}</a></div>;
}

export function Status({ t: at, counted, err }: { t?: string; counted: number; err: boolean }) {
  const x = useFmt(), { t } = x;
  const c = useCountdown(ELECTION_ISO);
  if (c && !c.done && counted === 0) return <span className="br-status">{t(`Polls close in ${c.d > 0 ? `${c.d}d ` : ""}${c.h}h ${String(c.m).padStart(2, "0")}m · 5 PM Brasília`, `Urnas fecham em ${c.d > 0 ? `${c.d}d ` : ""}${c.h}h ${String(c.m).padStart(2, "0")}min · 17h de Brasília`)}</span>;
  const when = at ? new Date(at).toLocaleTimeString(x.lang === "pt" ? "pt-BR" : "en-US", { hour: x.lang === "pt" ? "2-digit" : "numeric", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "";
  if (err) return <span className="br-status">{t("Lost the connection to the count, trying again", "Sem conexão com a apuração, tentando de novo")}</span>;
  return <span className={`br-status${counted > 0 ? " on" : ""}`}><i />{counted > 0 ? t(`Live count · updated ${when} Brasília`, `Apuração ao vivo · atualizado às ${when}`) : t("Waiting for the first numbers from the TSE", "Aguardando os primeiros números do TSE")}</span>;
}

export function Cards({ fv, lv, call, winLabel }: { fv: number; lv: number; call: "F" | "L" | null; winLabel?: string }) {
  const x = useFmt(), { t, nf, nint } = x;
  const tot = fv + lv, f = tot ? (100 * fv) / tot : 0, l = tot ? 100 - f : 0;
  const card = (k: "F" | "L", nm: string, party: string, p: number, v: number) => (
    <div className={`c${call === k ? " win" : ""}`} style={{ ["--c" as string]: k === "F" ? "var(--fl)" : "var(--lu)" }}>
      {call === k && <span className="ok">{winLabel ?? t("Elected", "Eleito")}</span>}
      <small>{party}</small><b>{nm}</b>
      <span className={`p ${k === "F" ? "fl" : "lu"}`}>{nf(tot ? p : 0, 2)}%</span>
      <span className="v">{nint(v)} {t("votes", "votos")}</span>
    </div>
  );
  return <div className="br-big">{card("F", "Flávio Bolsonaro", "PL", f, fv)}{card("L", "Lula", "PT", l, lv)}</div>;
}

export function Reporting({ pr, counted, total }: { pr: number; counted: number; total: number }) {
  const { t, nf, nint } = useFmt();
  const share = total > 0 ? Math.min(100, (100 * counted) / total) : 0;
  const p = pr > 0 ? pr : share;
  return (
    <div className="br-rep">
      <div className="lab"><span>{t(`${nf(p, 2)}% of sections counted`, `${nf(p, 2)}% das seções apuradas`)}</span><span>{t(`${nint(counted)} valid votes counted`, `${nint(counted)} votos válidos contados`)}</span></div>
      <div className="track"><i style={{ width: `${p}%` }} /></div>
    </div>
  );
}

export function ProjBand({ proj, label, scope }: { proj: Proj; label?: string; scope?: string }) {
  const { t, nf, pct, mg } = useFmt();
  const lo = 40, hi = 60, X = (v: number) => `${Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100))}%`;
  const started = proj.counted > 0;
  const where = scope ?? t("nationwide", "no país");
  return (
    <div className="br-proj">
      <div className="br-card-h" style={{ marginBottom: 0 }}><h3>{label ?? t("On Point projection of the final result", "Projeção On Point do resultado final")}</h3><span>{started ? t("Updates with the count", "Atualiza com a apuração") : t("Before the count: the forecast", "Antes da apuração: a previsão")}</span></div>
      <div className="band" aria-label={`Flávio ${nf(proj.f)}%, ${nf(proj.lo)} to ${nf(proj.hi)}`}>
        <span className="mid" />
        <span className="rng" style={{ left: X(proj.lo), width: `calc(${X(proj.hi)} - ${X(proj.lo)})` }} />
        <span className="pt" style={{ left: X(proj.f) }} />
      </div>
      <div className="ticks"><span>Lula 60%</span><span>55%</span><span>50%</span><span>55%</span><span>Flávio 60%</span></div>
      <div className="br-vote"><span className="fl">Flávio {pct(proj.f)}</span><span>{mg(2 * proj.f - 100)}</span><span className="lu">Lula {pct(100 - proj.f)}</span></div>
      <div className="br-callbox">
        {proj.call
          ? <><b className={proj.call === "F" ? "fl" : "lu"}>{t(`${proj.call === "F" ? "Flávio Bolsonaro" : "Lula"} wins ${where}`, `${proj.call === "F" ? "Flávio Bolsonaro" : "Lula"} vence ${where}`)}</b><p>{started ? t("With the votes already counted, the gap is too large for the votes still out to overturn.", "Com os votos já apurados, a diferença ficou grande demais para ser revertida pelos votos que faltam.") : ""}</p></>
          : <><b>{started ? t("No projected winner yet", "Ainda sem projeção de vencedor") : t("Waiting for the count", "Aguardando a apuração")}</b>
            <p>{t(`Chance of winning now: Flávio ${pct(100 * proj.p, 1)}, Lula ${pct(100 - 100 * proj.p, 1)}. `, `Chance de vitória agora: Flávio ${pct(100 * proj.p, 1)}, Lula ${pct(100 - 100 * proj.p, 1)}. `)}{started
              ? t(`In 8 of 10 scenarios Flávio finishes between ${pct(proj.lo)} and ${pct(proj.hi)}.`, `Em 8 de cada 10 cenários, Flávio termina entre ${pct(proj.lo)} e ${pct(proj.hi)}.`)
              : t("Once votes come in, the projection compares each municipality with what the model expected and estimates the votes still to come.", "Quando os votos começarem a chegar, a projeção compara cada município com o que o modelo esperava e estima os votos que faltam.")}</p></>}
      </div>
    </div>
  );
}

export const swingColor = (d: number | null, a0 = 0.12) => {
  if (d == null) return "rgba(120,110,140,.25)";
  const a = Math.min(1, Math.abs(d) / 6), t = Math.pow(a, 0.8);
  return d >= 0 ? `rgba(47,111,227,${a0 + 0.85 * t})` : `rgba(224,50,60,${a0 + 0.85 * t})`;
};
