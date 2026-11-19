"use client";
// Share a finished race: one line and the closest states as colored squares, with a link whose card shows the map,
// and a challenge link that starts a friend on the same race with the same seed.
import React, { useMemo, useState } from "react";
import * as E from "./engine28";
import { encodeRes, packWins, shareText, type ShareRes } from "../share28";
import { cls } from "../px/ui";
import { sfx } from "../px/sound";

const SITE = "https://onpointpolitics.us";
export function resOf(d: E.Data, s: E.GenS, res: E.NightRes, extra: { day?: number; diff?: string; seed?: number }): ShareRes {
  const byI = new Map(res.calls.map((c) => [c.i, c]));
  const dWon = d.states.map((_, i) => { const c = byI.get(i); if (!c) return false; return s.party === "D" ? c.win : !c.win; });
  const close = res.calls.filter((c) => !c.st.includes("-")).sort((a, b) => a.close - b.close).slice(0, 7)
    .map((c) => c.st + ((s.party === "D") === c.win ? "D" : "R"));
  return { v: 1, p: s.party, me: s.me, op: s.op, vp: s.vp, ev: res.ev, pop: Math.round(res.pop * 10) / 10, win: res.win, w: packWins(dWon), close, ...extra };
}

export default function Share28({ r }: { r: ShareRes }) {
  const code = useMemo(() => encodeRes(r), [r]);
  const url = `${SITE}/play/r/${code}`, chal = `${SITE}/play?c=${code}`;
  const text = shareText(r, url);
  const [done, setDone] = useState<string | null>(null);
  const copy = (t: string, k: string) => { navigator.clipboard?.writeText(t).then(() => { setDone(k); sfx("coin"); }).catch(() => {}); };
  const native = typeof navigator !== "undefined" && !!navigator.share;
  const pop = (u: string) => { window.open(u, "_blank", "noopener,noreferrer,width=640,height=640"); sfx("click"); };
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
      </div>
    </section>
  );
}
