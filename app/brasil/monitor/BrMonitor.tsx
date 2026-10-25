"use client";
// The Brazil results desk, built like the US situation monitor: every municipality on one full screen map, colored as
// the count comes in; towns flash as they report, states are called with a toast, and the panels keep the national
// count and the On Point projection in view. Click any state, on the map or in the list, to open its desk: the count,
// the projection, how it runs against the forecast and its biggest municipalities. Tilt the map for the 3D view.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import NationCanvas, { useAllMun, type CanvasHandle, type Muni } from "../NationCanvas";
import { useBrLive } from "../useBrLive";
import { swingColor } from "../LiveBits";
import { useFmt } from "../i18n";
import { UF_ORDER, marginColor, slugOf, ELECTION_ISO, type BrState, type Fmt } from "../lib";
import type { LiveState, Proj } from "../project";

type Color = "res" | "vs" | "prev";
type Ev = { t: Date; kind: "start" | "call" | "nat"; uf?: string; who?: "F" | "L" };
const clock = (d: Date, x: Fmt) => d.toLocaleTimeString(x.lang === "pt" ? "pt-BR" : "en-US", { hour: x.lang === "pt" ? "2-digit" : "numeric", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const WHO = (w: "F" | "L", full = false) => (w === "F" ? (full ? "Flávio Bolsonaro" : "Flávio") : "Lula");

function StateDesk({ s, live, munis, x, onClose, qs }: { s: BrState; live: LiveState | undefined; munis: Muni[]; x: Fmt; onClose: () => void; qs: string }) {
  const { t, nf, nint, pct, mg, compact } = x;
  const fv = live?.fv ?? 0, lv = live?.lv ?? 0, c = fv + lv, f = c ? (100 * fv) / c : null;
  const p: Proj = live && live.proj.counted > 0 ? live.proj : { f: s.flavio, lo: s.p10, hi: s.p90, p: s.p, total: s.valid, counted: 0, call: null, swing: null };
  const share = Math.min(100, (100 * c) / Math.max(1, p.total));
  const rows = munis.map((m) => { const v = live?.m[m.key]; const n = v ? v[0] + v[1] : 0; return { m, n, f: n ? (100 * v![0]) / n : null, pr: v?.[2] ?? 0 }; });
  const top = [...rows].sort((a, b) => (c ? b.n - a.n : b.m.row[3] - a.m.row[3])).slice(0, 10);
  const moved = rows.filter((r) => r.f != null && r.n >= 500 && r.m.row[2] != null).map((r) => ({ ...r, d: r.f! - r.m.row[2]! }));
  const upF = [...moved].sort((a, b) => b.d - a.d).slice(0, 3), upL = [...moved].sort((a, b) => a.d - b.d).slice(0, 3);
  const X = (v: number) => `${Math.max(0, Math.min(100, ((v - 20) / 60) * 100))}%`;
  const status = p.call ? <span className={`br-call ${p.call === "F" ? "f" : "l"}`}>{t(`${WHO(p.call)} wins`, `${WHO(p.call)} vence`)}</span>
    : c > 0 ? <span className="br-status on"><i />{t("Counting", "Em apuração")}</span> : <span className="br-status">{t("Waiting for returns", "Aguardando")}</span>;
  return (
    <div className="brm-desk">
      <div className="dh">
        <div><small>{x.region(s.region)} · {s.uf}</small><b>{s.name}</b></div>
        <button type="button" onClick={onClose}>{t("All of Brazil", "Brasil todo")}</button>
      </div>
      <div className="ds">{status}<span>{t(`Forecast ${mg(s.margin)}`, `Previsão ${mg(s.margin)}`)}</span></div>
      <div className="dc">
        {(["F", "L"] as const).map((k) => {
          const v = k === "F" ? fv : lv, sh = c ? (100 * v) / c : 0;
          return (
            <div key={k} className={`cand ${k === "F" ? "f" : "l"}${p.call === k ? " win" : ""}`}>
              <span className="nm">{WHO(k, true)}{p.call === k && <em>✓</em>}</span>
              <span className="pc">{c ? pct(sh, 2) : "0"}</span>
              <span className="bar"><i style={{ width: `${sh}%` }} /></span>
              <span className="vt">{nint(v)} {t("votes", "votos")}</span>
            </div>
          );
        })}
      </div>
      <div className="br-rep">
        <div className="lab"><span>{t(`${nf(live?.pr ?? 0, 1)}% of sections counted`, `${nf(live?.pr ?? 0, 1)}% das seções apuradas`)}</span><span>{compact(c)} / {compact(p.total)}</span></div>
        <div className="track"><i style={{ width: `${live?.pr || share}%` }} /></div>
      </div>
      <div className="dp">
        <div className="dl"><span>{c ? t("On Point projection", "Projeção On Point") : t("Forecast before the count", "Previsão antes da apuração")}</span><b className={p.f >= 50 ? "fl" : "lu"}>{mg(2 * p.f - 100)}</b></div>
        <div className="band"><span className="mid" style={{ left: X(50) }} /><span className="rng" style={{ left: X(p.lo), width: `calc(${X(p.hi)} - ${X(p.lo)})` }} /><span className="pt" style={{ left: X(p.f) }} /></div>
        <div className="dl sm"><span>{t(`Flávio ${pct(p.lo)} to ${pct(p.hi)}`, `Flávio de ${pct(p.lo)} a ${pct(p.hi)}`)}</span><span>{t(`Flávio wins ${pct(100 * p.p, 0)}`, `Flávio vence ${pct(100 * p.p, 0)}`)}</span></div>
        {c > 0 && p.swing != null && <div className="dl sm"><span>{t("Counted towns against the forecast", "Municípios apurados contra a previsão")}</span><b className={p.swing >= 0 ? "fl" : "lu"}>{p.swing >= 0 ? "Flávio" : "Lula"} +{nf(Math.abs(p.swing))}</b></div>}
      </div>
      <h4>{c ? t("Largest municipalities counted", "Maiores municípios apurados") : t("Largest municipalities, forecast", "Maiores municípios, previsão")}</h4>
      <table className="dt">
        <thead><tr><th>{t("Town", "Município")}</th><th>{c ? t("In", "Apur.") : t("Votes", "Votos")}</th><th>{c ? t("Margin", "Margem") : t("Forecast", "Previsão")}</th><th>{t("vs fcst", "vs prev.")}</th></tr></thead>
        <tbody>
          {top.map((r) => {
            const fc = r.m.row[2], m = r.f != null ? 2 * r.f - 100 : fc != null ? 2 * fc - 100 : null, d = r.f != null && fc != null ? r.f - fc : null;
            return (
              <tr key={r.m.row[0]}>
                <td>{r.m.row[1]}</td>
                <td>{r.f != null ? `${nf(r.pr, 0)}%` : compact(r.m.row[3])}</td>
                <td className={m == null ? "" : m > 0 ? "fl" : "lu"}>{m == null ? "" : mg(m)}</td>
                <td className={d == null ? "" : d > 0 ? "fl" : "lu"}>{d == null ? "" : `${d > 0 ? "F" : "L"}+${nf(Math.abs(d))}`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {moved.length >= 3 && (
        <div className="dm">
          <div><h4>{t("Flávio beating the forecast", "Flávio acima da previsão")}</h4>{upF.map((r) => <p key={r.m.row[0]}><span>{r.m.row[1]}</span><b className="fl">+{nf(r.d)}</b></p>)}</div>
          <div><h4>{t("Lula beating the forecast", "Lula acima da previsão")}</h4>{upL.map((r) => <p key={r.m.row[0]}><span>{r.m.row[1]}</span><b className="lu">+{nf(-r.d)}</b></p>)}</div>
        </div>
      )}
      <Link className="dlink" href={`/brasil/resultados/${slugOf(s.name)}${qs}`}>{t(`Open the full ${s.name} results`, `Abrir a apuração completa ${x.ofState(s.uf, s.name)}`)}</Link>
    </div>
  );
}

export default function BrMonitor({ states, nat }: { states: BrState[]; nat: { flavio: number; p_flavio: number; valid: number; p10: number; p90: number } }) {
  const { live, sim } = useBrLive();
  const x = useFmt(), { t, nf, nint, pct, mg } = x;
  const munis = useAllMun(UF_ORDER);
  const by = useMemo(() => Object.fromEntries(states.map((s) => [s.uf, s])), [states]);
  const borders = useMemo(() => states.filter((s) => s.d).map((s) => ({ uf: s.uf, d: s.d! })), [states]);
  const cref = useRef<CanvasHandle>(null), box = useRef<HTMLDivElement>(null);
  const [color, setColor] = useState<Color>("res");
  const [tilt, setTilt] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [order, setOrder] = useState<"close" | "big">("big");
  const [feed, setFeed] = useState<Ev[]>([]);
  const [toast, setToast] = useState<(Ev & { id: number }) | null>(null);
  const [glow, setGlow] = useState<Map<string, number>>(new Map());
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const tm = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(tm); }, []);

  // what changed since the last update: new municipalities flash, new calls go to the feed and the toast
  const seen = useRef<{ m: Record<string, number>; calls: Record<string, string>; started: Set<string>; nat: string | null; first: boolean }>({ m: {}, calls: {}, started: new Set(), nat: null, first: true });
  useEffect(() => {
    if (!live) return;
    const S = seen.current, tn = performance.now(), g = new Map<string, number>(), add: Ev[] = [];
    for (const [uf, st] of Object.entries(live.st)) {
      for (const [k, v] of Object.entries(st.m)) { const id = uf + ":" + k, c = v[0] + v[1]; if (!S.first && c > (S.m[id] ?? 0)) g.set(id, tn - Math.random() * 900); S.m[id] = c; }
      if (st.fv + st.lv > 0 && !S.started.has(uf)) { S.started.add(uf); if (!S.first && uf !== "ZZ") add.push({ t: new Date(), kind: "start", uf }); }
      const call = st.proj.call;
      if (call && S.calls[uf] !== call) {
        S.calls[uf] = call;
        if (uf !== "ZZ") { add.push({ t: new Date(), kind: "call", uf, who: call }); if (!S.first) setToast({ id: Date.now(), t: new Date(), kind: "call", uf, who: call }); }
      }
    }
    const nc = live.nat.proj.call;
    if (nc && S.nat !== nc) { S.nat = nc; add.push({ t: new Date(), kind: "nat", who: nc }); setToast({ id: Date.now() + 1, t: new Date(), kind: "nat", who: nc }); }
    S.first = false;
    if (g.size) setGlow(g);
    if (add.length) setFeed((f) => [...add.reverse(), ...f].slice(0, 40));
  }, [live]);
  useEffect(() => { if (!toast) return; const tm = setTimeout(() => setToast(null), 5200); return () => clearTimeout(tm); }, [toast]);
  const evText = (e: Ev) => e.kind === "start" ? t(`${by[e.uf!]?.name ?? e.uf} starts counting`, `${by[e.uf!]?.name ?? e.uf} começa a apurar`)
    : e.kind === "call" ? t(`Projection: ${WHO(e.who!)} wins ${by[e.uf!]?.name ?? e.uf}`, `Projeção: ${WHO(e.who!)} vence ${by[e.uf!]?.name ?? e.uf}`)
    : t(`Projection: ${WHO(e.who!, true)} wins the presidency`, `Projeção: ${WHO(e.who!, true)} vence a eleição`);

  const mshare = useCallback((m: Muni) => { const v = live?.st[m.uf]?.m[m.key]; const c = v ? v[0] + v[1] : 0; return c > 0 ? (100 * v![0]) / c : null; }, [live]);
  const fill = useCallback((m: Muni) => {
    const e = m.row[2] == null ? null : 2 * m.row[2] - 100;
    if (color === "prev") return marginColor(e);
    const f = mshare(m);
    if (f == null) return marginColor(e, 0.16);
    return color === "res" ? marginColor(2 * f - 100) : swingColor(m.row[2] == null ? null : f - m.row[2]);
  }, [color, mshare]);

  const n = live?.nat, proj = n && n.proj.counted > 0 ? n.proj : { f: nat.flavio, lo: nat.p10, hi: nat.p90, p: nat.p_flavio, total: nat.valid, counted: 0, call: null, swing: null };
  const cnt = (n?.fv ?? 0) + (n?.lv ?? 0), fsh = cnt ? (100 * n!.fv) / cnt : null;
  const pr = n?.pr ?? 0;
  const calls = Object.entries(live?.st ?? {}).filter(([uf]) => uf !== "ZZ").map(([, v]) => v.proj.call);
  const list = [...states].sort((a, b) => order === "big" ? b.valid - a.valid : Math.abs((live?.st[a.uf]?.proj.f ?? a.flavio) - 50) - Math.abs((live?.st[b.uf]?.proj.f ?? b.flavio) - 50));
  const pick = (uf: string | null) => { setSel(uf); cref.current?.fly(uf); };
  const started = now ? now.getTime() >= new Date(ELECTION_ISO).getTime() || cnt > 0 : false;
  const qs = sim ? "?simular=1" : "";
  const selMunis = useMemo(() => (sel ? munis.filter((m) => m.uf === sel) : []), [munis, sel]);
  const zero = nf(0, 2);
  return (
    <div className={`brm${tilt ? " t3d" : ""}`} ref={box}>
      <div className="brm-stage">
        <div className="brm-tilt">
          {tilt && <div className="brm-grid" />}
          <NationCanvas ref={cref} inset={{ l: 440, r: 420, t: 10, b: 50 }} munis={munis} borders={borders} fill={fill} glow={glow} sel={sel} border="rgba(255,255,255,.8)"
            onPick={(m) => { if (m.uf !== sel) pick(m.uf); }}
            tip={tilt ? undefined : (m) => { const f = mshare(m), v = live?.st[m.uf]?.m[m.key]; return (
              <>
                <h4>{m.row[1]} <span style={{ color: "#8e86a3", fontWeight: 600 }}>{m.uf}</span></h4>
                {f == null ? <p style={{ margin: 0 }}>{t("No votes counted yet.", "Ainda sem votos apurados.")}{m.row[2] != null && ` ${t("Forecast", "Previsão")}: ${mg(2 * m.row[2] - 100)}.`}</p> : <>
                  <div className="row"><span className="fl">Flávio</span><b>{pct(f, 2)}</b></div>
                  <div className="row"><span className="lu">Lula</span><b>{pct(100 - f, 2)}</b></div>
                  <div className="row"><span>{t("Votes counted", "Votos contados")}</span><b>{nint(v![0] + v![1])}</b></div>
                  {m.row[2] != null && <div className="row"><span>{t("Against the forecast", "Contra a previsão")}</span><b>{f - m.row[2] >= 0 ? "Flávio +" : "Lula +"}{nf(Math.abs(f - m.row[2]))}</b></div>}
                </>}
                <small>{t("Click to open the state", "Clique para abrir o estado")}</small>
              </>
            ); }} />
        </div>
      </div>

      {toast && <div key={toast.id} className="brm-toast" style={{ ["--c" as string]: toast.who === "F" ? "#2f6fe3" : "#e0323c" }}><small>{t("On Point projection", "Projeção On Point")}</small>
        {toast.kind === "nat" ? t(`${WHO(toast.who!, true)} is elected president`, `${WHO(toast.who!, true)} é eleito presidente`) : t(`${WHO(toast.who!)} wins ${by[toast.uf!]?.name ?? toast.uf}`, `${WHO(toast.who!)} vence ${by[toast.uf!]?.name ?? toast.uf}`)}</div>}

      <div className="brm-top">
        <div className="brm-title gl">
          <div className="eye"><i className={started ? "on" : ""} />{sim ? t("Simulation", "Simulação") : started ? t("Live count", "Apuração ao vivo") : t("Sunday, October 25 · polls close 5 PM Brasília", "Domingo, 25 de outubro · 17h")}</div>
          <h1>{t("Brazil runoff", "2º turno")} <em>{t("live results", "ao vivo")}</em></h1>
          <p>{t("Every municipality in Brazil, colored as the TSE counts.", "Todos os municípios do Brasil, coloridos conforme o TSE apura.")} {sim ? t("Made up numbers for a demonstration.", "Números fictícios para demonstração.") : t("Click any state to analyze it.", "Clique em qualquer estado para analisá-lo.")}</p>
        </div>
        <div className="brm-nat gl">
          <div className="row"><span><small>Flávio Bolsonaro</small><br /><b className="f">{fsh == null ? zero : nf(fsh, 2)}%</b></span><span style={{ textAlign: "right" }}><small>Lula</small><br /><b className="l">{fsh == null ? zero : nf(100 - fsh, 2)}%</b></span></div>
          <div className="br-prob thin"><i className="f" style={{ width: `${fsh ?? 50}%` }} /><i className="l" style={{ width: `${fsh == null ? 50 : 100 - fsh}%` }} /><span className="mid" /></div>
          <div className="sub"><span>{t(`${nf(pr, 2)}% counted`, `${nf(pr, 2)}% apurado`)}</span><span>{nint(cnt)} {t("votes", "votos")}</span></div>
          <div className="sub" style={{ color: "#ffd98a" }}><span>{cnt ? t("On Point projection", "Projeção On Point") : t("Forecast", "Previsão")}</span><span>{proj.call ? t(`${WHO(proj.call)} wins`, `${WHO(proj.call)} vence`) : `${mg(2 * proj.f - 100)} · Flávio ${pct(100 * proj.p, 0)}`}</span></div>
          <div className="sub"><span>{t("States projected", "Estados projetados")}</span><span><b className="f" style={{ fontSize: 12 }}>Flávio {calls.filter((c) => c === "F").length}</b> · <b className="l" style={{ fontSize: 12 }}>Lula {calls.filter((c) => c === "L").length}</b></span></div>
        </div>
        <div className="brm-seg gl" role="group" aria-label={t("Map color", "Cor do mapa")}>
          <button type="button" aria-pressed={color === "res"} onClick={() => setColor("res")}>{t("Results", "Resultado")}</button>
          <button type="button" aria-pressed={color === "vs"} onClick={() => setColor("vs")}>{t("Versus forecast", "Contra a previsão")}</button>
          <button type="button" aria-pressed={color === "prev"} onClick={() => setColor("prev")}>{t("Forecast", "Previsão")}</button>
        </div>
      </div>

      <aside className="brm-right gl" aria-label={t("States", "Estados")}>
        {sel && by[sel] ? <StateDesk s={by[sel]} live={live?.st[sel]} munis={selMunis} x={x} onClose={() => pick(null)} qs={qs} /> : (
          <>
            <h3><span>{t("States", "Estados")}</span><button type="button" onClick={() => setOrder(order === "big" ? "close" : "big")}>{order === "big" ? t("By size", "Por tamanho") : t("Closest", "Mais disputados")}</button></h3>
            <ul className="brm-list">
              {list.map((s) => {
                const st = live?.st[s.uf], c = (st?.fv ?? 0) + (st?.lv ?? 0), f = c ? (100 * st!.fv) / c : null, call = st?.proj.call;
                return (
                  <li key={s.uf}><button type="button" onClick={() => pick(s.uf)}>
                    <span className="uf">{s.uf}</span><span className="nm">{s.name}</span>
                    <span className={`v ${f == null ? (s.margin > 0 ? "fl" : "lu") : f > 50 ? "fl" : "lu"}`}>{call ? <span className={`br-call ${call === "F" ? "f" : "l"}`}>{WHO(call)}</span> : f == null ? mg(s.margin) : mg(2 * f - 100)}</span>
                    <span className="r">{nf(st?.pr ?? 0, 0)}%</span>
                    <span className="mini"><i style={{ width: `${st?.pr ?? 0}%` }} /></span>
                  </button></li>
                );
              })}
            </ul>
            <p className="brm-hint">{t("Before the count each state shows its forecast margin. Click a state to open its desk.", "Antes da apuração cada estado mostra a margem prevista. Clique num estado para abrir o painel dele.")}</p>
          </>
        )}
      </aside>

      <div className="brm-feed gl" aria-live="polite">
        <h3>{t("Timeline", "Linha do tempo")}</h3>
        {feed.length ? <ul>{feed.slice(0, 12).map((e, i) => <li key={i}><time>{clock(e.t, x)}</time><span style={{ color: e.kind === "nat" ? "#ffd98a" : e.kind === "call" ? (e.who === "F" ? "#8fb2ff" : "#ff8f96") : undefined }}>{evText(e)}</span></li>)}</ul>
          : <p>{started ? t("Waiting for the first numbers from the TSE.", "Esperando os primeiros números do TSE.") : t("Polls close at 5 PM Brasília, 4 PM Eastern. Numbers appear here as soon as the TSE starts releasing them.", "As urnas fecham às 17h de Brasília. Os números aparecem aqui assim que o TSE começar a divulgar.")}</p>}
      </div>

      <div className="brm-hud">
        <span>{now ? t(`${clock(now, x)} in Brasília`, `${clock(now, x)} em Brasília`) : ""}</span><span>{nint(munis.length)} {t("municipalities", "municípios")}</span><span>{calls.filter(Boolean).length} {t("states projected", "estados projetados")}</span>
      </div>
      <div className="brm-z">
        <button type="button" aria-label={t("Zoom in", "Aproximar")} onClick={() => cref.current?.zoom(1.6)}>+</button>
        <button type="button" aria-label={t("Zoom out", "Afastar")} onClick={() => cref.current?.zoom(0.62)}>−</button>
        <button type="button" className="t" aria-pressed={tilt} onClick={() => setTilt(!tilt)}>3D</button>
        <button type="button" className="t" onClick={() => pick(null)}>{t("Brazil", "Brasil")}</button>
        <button type="button" className="t" onClick={() => { const el = box.current; if (!el) return; if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen?.(); }}>{t("Full screen", "Tela cheia")}</button>
      </div>
    </div>
  );
}
