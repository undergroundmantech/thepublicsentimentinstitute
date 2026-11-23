"use client";
// Share a finished race: one line and the closest states as colored squares, with a link whose card shows the map,
// and a challenge link that starts a friend on the same race with the same seed.
import React, { useMemo, useState } from "react";
import * as E from "./engine28";
import { encodeRes, packWins, shareText, type ShareRes } from "../share28";
import { cls } from "../px/ui";
import { sfx } from "../px/sound";

const SITE = "https://onpointpolitics.us";
export function resOf(d: E.Data, s: E.GenS, res: E.NightRes, extra: { day?: number; diff?: string; seed?: number; sc?: string }): ShareRes {
  const byI = new Map(res.calls.map((c) => [c.i, c]));
  const dWon = d.states.map((_, i) => { const c = byI.get(i); if (!c) return false; return s.party === "D" ? c.win : !c.win; });
  const close = res.calls.filter((c) => !c.st.includes("-")).sort((a, b) => a.close - b.close).slice(0, 7)
    .map((c) => c.st + ((s.party === "D") === c.win ? "D" : "R"));
  const fl = res.calls.filter((c) => c.win && !c.st.includes("-")).filter((c) => { const p24 = d.states[c.i]?.p24; return p24 != null && (s.party === "R" ? p24 < 0 : p24 > 0); })
    .sort((a, b) => d.states[b.i].ev - d.states[a.i].ev).map((c) => c.st);
  const sp = Math.round(((s.spentTot ?? 0) + (s.spent ?? 0)) / 1e6);
  return { v: 1, p: s.party, me: s.me, op: s.op, vp: s.vp, ev: res.ev, pop: Math.round(res.pop * 10) / 10, win: res.win, w: packWins(dWon), close, fl: fl.length ? fl : undefined, sp, ...extra };
}

export default function Share28({ r }: { r: ShareRes }) {
  const code = useMemo(() => encodeRes(r), [r]);
  const url = `${SITE}/play/r/${code}`, chal = `${SITE}/play?c=${code}`;
  const text = shareText(r, url);
  const [done, setDone] = useState<string | null>(null);
  const copy = (t: string, k: string) => { navigator.clipboard?.writeText(t).then(() => { setDone(k); sfx("coin"); }).catch(() => {}); };
  const native = typeof navigator !== "undefined" && !!navigator.share;
  const pop = (u: string) => { window.open(u, "_blank", "noopener,noreferrer,width=640,height=640"); sfx("click"); };
  // the weekly leaderboard: a name, then the server checks the result and places it
  const [name, setName] = useState(() => { try { return localStorage.getItem("c28.name") ?? ""; } catch { return ""; } });
  const [lb, setLb] = useState<{ ok: boolean; t: string } | null>(null); const [busy, setBusy] = useState(false);
  const enter = async () => {
    setBusy(true); try { localStorage.setItem("c28.name", name); } catch { /* private window */ }
    try { const j = await (await fetch("/api/play/board", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, name }) })).json();
      if (!j.ok) setLb({ ok: false, t: j.error }); else { const rk = Object.entries(j.ranks as Record<string, number>); setLb({ ok: true, t: rk.length ? `You're on the board: ${rk.map(([c, n]) => `number ${n} in ${c}`).join(", ")}.` : "Entered, but this run didn't crack a top ten this week. Your best stays on the board." }); sfx(rk.length ? "fanfare" : "click"); }
    } catch { setLb({ ok: false, t: "That didn't go through. Try again." }); } finally { setBusy(false); }
  };
  return (
    <section className="px-step y28-share" aria-labelledby="y28-share-h">
      <span className="px-k" id="y28-share-h">Share your result</span>
      <pre className="y28-share-text">{text.replace(url, "").trim()}</pre>
      <div className="px-row y28-share-btns">
        {native ? <button type="button" className="px-press" onClick={() => navigator.share({ title: "Campaign 2028", text: text.replace(url, "").trim(), url }).catch(() => {})}>Share</button> : null}
        <button type="button" className="px-btn" onClick={() => pop(`https://x.com/intent/post?text=${encodeURIComponent(text)}`)}>Post on X</button>
        <button type="button" className="px-btn" onClick={() => pop(`https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text.split("\n")[1] ?? "Campaign 2028")}`)}>Reddit</button>
        <button type="button" className="px-btn" onClick={() => pop(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`)}>Facebook</button>
        <button type="button" className={cls("px-btn", done === "t" && "on")} onClick={() => copy(text, "t")}>{done === "t" ? "Copied" : "Copy"}</button>
        <button type="button" className={cls("px-btn", done === "c" && "on")} onClick={() => copy(`I ran this 2028 race as ${r.me}. Same candidates, same seed. Beat me: ${chal}`, "c")}>{done === "c" ? "Challenge copied" : "Challenge a friend"}</button>
        <a className="px-btn" href={`/play/r/${code}/opengraph-image`} target="_blank" rel="noopener noreferrer" onClick={() => sfx("click")}>Map image for Discord</a>
      </div>
      <p className="px-note y28-small">Paste the link in Discord or X and the map card shows up on its own, or open the map image and save it.</p>
      {r.win ? <div className="y28-lb">
        <span className="px-k">This week&apos;s leaderboard</span>
        <div className="px-row"><label htmlFor="y28-lb-name" className="oc-sr">Your name for the leaderboard</label><input id="y28-lb-name" className="y28-lb-in" placeholder="Your name for the board" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} />
          <button type="button" className="px-press" disabled={busy || name.trim().length < 2} onClick={enter}>{busy ? "Checking" : "Put me on the board"}</button>
          <a className="px-btn" href="/play/leaderboard" target="_blank" rel="noopener noreferrer">See the board</a></div>
        {lb ? <p className={cls("px-note", lb.ok ? "up" : "dn")} role="status">{lb.t}</p> : null}
      </div> : <p className="px-note y28-small">Win a race to enter <a href="/play/leaderboard" target="_blank" rel="noopener noreferrer">this week&apos;s leaderboard</a>.</p>}
    </section>
  );
}
