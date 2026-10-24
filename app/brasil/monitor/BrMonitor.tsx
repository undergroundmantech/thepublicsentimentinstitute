"use client";
// A Sala de situação: the election night control room for the Brazil runoff. Every municipality on one full screen
// map, colored as the count comes in; towns flash as they report, states are called with a toast, and the panels
// keep the national count and the On Point projection in view. Tilt the map for the 3D view.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import NationCanvas, { useAllMun, type CanvasHandle, type Muni } from "../NationCanvas";
import { useBrLive } from "../useBrLive";
import { swingColor } from "../LiveBits";
import { UF_ORDER, marginColor, mg, nf, nint, pct, slugOf, ELECTION_ISO, type BrState } from "../lib";

type Color = "res" | "vs" | "prev";
type Feed = { t: Date; text: string; c?: string };
const clock = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

export default function BrMonitor({ states, nat }: { states: BrState[]; nat: { flavio: number; p_flavio: number; valid: number; p10: number; p90: number } }) {
  const { live, sim } = useBrLive();
  const munis = useAllMun(UF_ORDER);
  const by = useMemo(() => Object.fromEntries(states.map((s) => [s.uf, s])), [states]);
  const borders = useMemo(() => states.filter((s) => s.d).map((s) => ({ uf: s.uf, d: s.d! })), [states]);
  const cref = useRef<CanvasHandle>(null), box = useRef<HTMLDivElement>(null);
  const [color, setColor] = useState<Color>("res");
  const [tilt, setTilt] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [order, setOrder] = useState<"close" | "big">("big");
  const [feed, setFeed] = useState<Feed[]>([]);
  const [toast, setToast] = useState<{ id: number; text: string; sub: string; c: string } | null>(null);
  const [glow, setGlow] = useState<Map<string, number>>(new Map());
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(t); }, []);

  // what changed since the last update: new municipalities flash, new calls go to the feed and the toast
  const seen = useRef<{ m: Record<string, number>; calls: Record<string, string>; started: Set<string>; nat: string | null; first: boolean }>({ m: {}, calls: {}, started: new Set(), nat: null, first: true });
  useEffect(() => {
    if (!live) return;
    const S = seen.current, t = performance.now(), g = new Map<string, number>(), add: Feed[] = [];
    for (const [uf, x] of Object.entries(live.st)) {
      for (const [k, v] of Object.entries(x.m)) { const id = uf + ":" + k, c = v[0] + v[1]; if (!S.first && c > (S.m[id] ?? 0)) g.set(id, t - Math.random() * 900); S.m[id] = c; }
      if (x.fv + x.lv > 0 && !S.started.has(uf)) { S.started.add(uf); if (!S.first && uf !== "ZZ") add.push({ t: new Date(), text: `${by[uf]?.name ?? uf} começa a apurar` }); }
      const call = x.proj.call;
      if (call && S.calls[uf] !== call) {
        S.calls[uf] = call;
        if (uf !== "ZZ") {
          const who = call === "F" ? "Flávio" : "Lula";
          add.push({ t: new Date(), text: `Projeção: ${who} vence ${by[uf] ? by[uf].name : uf}`, c: call === "F" ? "#8fb2ff" : "#ff8f96" });
          if (!S.first) setToast({ id: Date.now(), text: `${who} vence ${by[uf]?.name ?? uf}`, sub: "Projeção On Point", c: call === "F" ? "#2f6fe3" : "#e0323c" });
        }
      }
    }
    const nc = live.nat.proj.call;
    if (nc && S.nat !== nc) {
      S.nat = nc; const who = nc === "F" ? "Flávio Bolsonaro" : "Lula";
      add.push({ t: new Date(), text: `Projeção: ${who} vence a eleição`, c: "#ffd98a" });
      setToast({ id: Date.now() + 1, text: `${who} é eleito presidente`, sub: "Projeção On Point", c: nc === "F" ? "#2f6fe3" : "#e0323c" });
    }
    S.first = false;
    if (g.size) setGlow(g);
    if (add.length) setFeed((f) => [...add.reverse(), ...f].slice(0, 40));
  }, [live, by]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 5200); return () => clearTimeout(t); }, [toast]);

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
  const list = [...states].sort((a, b) => order === "big" ? b.valid - a.valid : Math.abs((live?.st[a.uf]?.proj.f ?? a.flavio) - 50) - Math.abs((live?.st[b.uf]?.proj.f ?? b.flavio) - 50));
  const pick = (uf: string | null) => { setSel(uf); cref.current?.fly(uf); };
  const started = now ? now.getTime() >= new Date(ELECTION_ISO).getTime() || cnt > 0 : false;
  const qs = sim ? "?simular=1" : "";
  return (
    <div className={`brm${tilt ? " t3d" : ""}`} ref={box}>
      <div className="brm-stage">
        <div className="brm-tilt">
          {tilt && <div className="brm-grid" />}
          <NationCanvas ref={cref} inset={{ l: 440, r: 400, t: 10, b: 50 }} munis={munis} borders={borders} fill={fill} glow={glow} sel={sel} border="rgba(255,255,255,.8)"
            onPick={(m) => { if (m.uf !== sel) pick(m.uf); }}
            tip={tilt ? undefined : (m) => { const f = mshare(m), v = live?.st[m.uf]?.m[m.key]; return (
              <>
                <h4>{m.row[1]} <span style={{ color: "#8e86a3", fontWeight: 600 }}>{m.uf}</span></h4>
                {f == null ? <p style={{ margin: 0 }}>Ainda sem votos apurados.{m.row[2] != null && ` Previsão: ${mg(2 * m.row[2] - 100)}.`}</p> : <>
                  <div className="row"><span className="fl">Flávio</span><b>{pct(f, 2)}</b></div>
                  <div className="row"><span className="lu">Lula</span><b>{pct(100 - f, 2)}</b></div>
                  <div className="row"><span>Votos contados</span><b>{nint(v![0] + v![1])}</b></div>
                  {m.row[2] != null && <div className="row"><span>Contra a previsão</span><b>{f - m.row[2] >= 0 ? "Flávio +" : "Lula +"}{nf(Math.abs(f - m.row[2]))}</b></div>}
                </>}
              </>
            ); }} />
        </div>
      </div>

      {toast && <div key={toast.id} className="brm-toast" style={{ ["--c" as string]: toast.c }}><small>{toast.sub}</small>{toast.text}</div>}

      <div className="brm-top">
        <div className="brm-title gl">
          <div className="eye"><i className={started ? "on" : ""} />{sim ? "Simulação" : started ? "Apuração ao vivo" : "Domingo, 25 de outubro · 17h"}</div>
          <h1>Sala de <em>situação</em></h1>
          <p>Todos os municípios do Brasil, coloridos conforme o TSE apura. {sim ? "Números fictícios para demonstração." : "Clique num estado para aproximar."}</p>
        </div>
        <div className="brm-nat gl">
          <div className="row"><span><small>Flávio</small><br /><b className="f">{fsh == null ? "0,00" : nf(fsh, 2)}%</b></span><span style={{ textAlign: "right" }}><small>Lula</small><br /><b className="l">{fsh == null ? "0,00" : nf(100 - fsh, 2)}%</b></span></div>
          <div className="br-prob thin"><i className="f" style={{ width: `${fsh ?? 50}%` }} /><i className="l" style={{ width: `${fsh == null ? 50 : 100 - fsh}%` }} /><span className="mid" /></div>
          <div className="sub"><span>{nf(pr, 2)}% apurado</span><span>{nint(cnt)} votos</span></div>
          <div className="sub" style={{ color: "#ffd98a" }}><span>Projeção On Point</span><span>{proj.call ? `${proj.call === "F" ? "Flávio" : "Lula"} vence` : `${mg(2 * proj.f - 100)} · Flávio ${pct(100 * proj.p, 0)}`}</span></div>
        </div>
        <div className="brm-seg gl" role="group" aria-label="Cor do mapa">
          <button type="button" aria-pressed={color === "res"} onClick={() => setColor("res")}>Resultado</button>
          <button type="button" aria-pressed={color === "vs"} onClick={() => setColor("vs")}>Contra a previsão</button>
          <button type="button" aria-pressed={color === "prev"} onClick={() => setColor("prev")}>Previsão</button>
        </div>
      </div>

      <aside className="brm-right gl" aria-label="Estados">
        {sel && by[sel] ? (() => { const s = by[sel], x = live?.st[sel], c = (x?.fv ?? 0) + (x?.lv ?? 0), f = c ? (100 * x!.fv) / c : null; return (
          <div style={{ marginBottom: 14 }}>
            <h3><span>{s.name}</span><button type="button" onClick={() => pick(null)}>Brasil</button></h3>
            <div className="brm-nat" style={{ padding: 0 }}>
              <div className="row"><b className="f">{f == null ? "0,00" : nf(f, 2)}%</b><b className="l">{f == null ? "0,00" : nf(100 - f, 2)}%</b></div>
              <div className="br-prob thin"><i className="f" style={{ width: `${f ?? 50}%` }} /><i className="l" style={{ width: `${f == null ? 50 : 100 - f}%` }} /><span className="mid" /></div>
              <div className="sub"><span>{nf(x?.pr ?? 0, 1)}% apurado</span><span>Previsão {mg(s.margin)}</span></div>
              <div className="sub" style={{ color: "#ffd98a" }}><span>Projeção</span><span>{x?.proj.call ? `${x.proj.call === "F" ? "Flávio" : "Lula"} vence` : mg(2 * (x?.proj.f ?? s.flavio) - 100)}</span></div>
            </div>
            <Link href={`/brasil/resultados/${slugOf(s.name)}${qs}`} style={{ display: "inline-block", marginTop: 8, font: "700 12px var(--font-b)", color: "#ffd98a" }}>Abrir a apuração {s.uf === "DF" ? "do DF" : "do estado"}</Link>
          </div>
        ); })() : null}
        <h3><span>Estados</span><button type="button" onClick={() => setOrder(order === "big" ? "close" : "big")}>{order === "big" ? "Por tamanho" : "Mais disputados"}</button></h3>
        <ul className="brm-list">
          {list.map((s) => {
            const x = live?.st[s.uf], c = (x?.fv ?? 0) + (x?.lv ?? 0), f = c ? (100 * x!.fv) / c : null, call = x?.proj.call;
            return (
              <li key={s.uf}><button type="button" className={sel === s.uf ? "on" : ""} onClick={() => pick(s.uf)}>
                <span className="uf">{s.uf}</span><span className="nm">{s.name}</span>
                <span className={`v ${f == null ? "" : f > 50 ? "fl" : "lu"}`}>{call ? <span className={`br-call ${call === "F" ? "f" : "l"}`}>{call === "F" ? "Flávio" : "Lula"}</span> : f == null ? mg(s.margin) : mg(2 * f - 100)}</span>
                <span className="r">{nf(x?.pr ?? 0, 0)}%</span>
                <span className="mini"><i style={{ width: `${x?.pr ?? 0}%` }} /></span>
              </button></li>
            );
          })}
        </ul>
      </aside>

      <div className="brm-feed gl" aria-live="polite">
        <h3>Linha do tempo</h3>
        {feed.length ? <ul>{feed.slice(0, 12).map((f, i) => <li key={i}><time>{clock(f.t)}</time><span style={{ color: f.c }}>{f.text}</span></li>)}</ul>
          : <p>{started ? "Esperando os primeiros números do TSE." : "As urnas fecham às 17h de Brasília. Os números aparecem aqui assim que o TSE começar a divulgar."}</p>}
      </div>

      <div className="brm-hud">
        <span>{now ? `${clock(now)} em Brasília` : ""}</span><span>{nint(munis.length)} municípios</span><span>{Object.values(live?.st ?? {}).filter((x) => x.proj.call).length} estados projetados</span>
      </div>
      <div className="brm-z">
        <button type="button" aria-label="Aproximar" onClick={() => cref.current?.zoom(1.6)}>+</button>
        <button type="button" aria-label="Afastar" onClick={() => cref.current?.zoom(0.62)}>−</button>
        <button type="button" className="t" aria-pressed={tilt} onClick={() => setTilt(!tilt)}>3D</button>
        <button type="button" className="t" onClick={() => pick(null)}>Brasil</button>
        <button type="button" className="t" onClick={() => { const el = box.current; if (!el) return; if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen?.(); }}>Tela cheia</button>
      </div>
    </div>
  );
}
