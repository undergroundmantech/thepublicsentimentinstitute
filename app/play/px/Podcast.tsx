"use client";
// A show: a podcast, talk radio or a stream. Three questions, no handlers. The host's lean decides who is listening:
// your own voters, the other side's, or the persuadable middle. Pushback and jokes make clips, for better or worse.
import React, { useMemo, useState } from "react";
import * as E from "../engine";
import * as N from "../net";
import { sfx } from "./sound";
import { Portrait, Type, cls, fxs } from "./ui";

export default function Podcast({ r, s, m, onDone, onClose }: { r: E.RaceFile; s: E.State; m: E.Meet; onDone: (x: E.State, fx: number) => void; onClose: () => void }) {
  const c = useMemo(() => E.ctx(r, s.side), [r, s.side]);
  const [x] = useState(() => structuredClone(s));
  const qs = useMemo(() => N.podQuestions(c, x, m), [c, x, m]);
  const [k, setK] = useState(-1);
  const [ans, setAns] = useState<{ fx: number; clip: string | null; label: string } | null>(null);
  const [tot, setTot] = useState<{ fx: number; parts: E.Part[] }>({ fx: 0, parts: [] });
  const [fin, setFin] = useState(false);
  const lean = m.pod?.lean ?? "O", friendly = lean === s.side, hostile = lean !== "O" && !friendly;
  const room = friendly ? "Friendly room: your own voters are listening. Straight answers fire them up." : hostile ? "Hostile room: the other side's voters are listening. Common ground and calm pushback win respect; party lines bounce off." : "A big, mostly apolitical audience. Jokes and plain talk travel; talking points do not.";
  const pick = (j: number) => {
    const q = qs[k]; const a = N.podAnswer(c, x, m, q, j);
    setAns({ fx: a.fx, clip: a.clip, label: q.opts[j].label });
    setTot((t) => ({ fx: t.fx + a.fx, parts: [...t.parts, ...a.parts] }));
    sfx(a.clip ? (a.fx >= 0 ? "fanfare" : "alarm") : a.fx > 0.02 ? "good" : a.fx < -0.02 ? "bad" : "click");
  };
  const next = () => { setAns(null); if (k + 1 < qs.length) setK(k + 1); else { N.finishPod(c, x, m, tot.fx, tot.parts.slice(0, 5)); setFin(true); sfx(tot.fx >= 0 ? "crowd" : "buzz"); } };
  return (
    <div className="px-modal" role="dialog" aria-modal="true" aria-labelledby="px-pod-h">
      <div className={cls("px-meet", "podcast", "px-pod", hostile ? "hostile" : friendly ? "friendly" : "neutral")}>
        <div className="px-meet-bg" aria-hidden="true" />
        <div className="px-onair" aria-hidden="true"><i />ON AIR</div>
        <div className="px-meet-top">
          <Portrait seed={m.seed} role="podcast" party={lean === "O" ? "" : lean} talking={k >= 0 && !ans && !fin} size={120} />
          <div>
            <span className="px-tag">{hostile ? "Hostile ground" : friendly ? "Home turf" : "New audience"}{m.real ? <em className="px-real">Real</em> : null}</span>
            <h3 id="px-pod-h">{m.title}</h3>
            <b className="px-who">{m.who}</b>
            <span className="px-k">{m.place} · takes a full day</span>
          </div>
        </div>
        {k < 0 ? (
          <>
            <p className="px-line"><Type text={m.intro} /></p>
            <p className="px-note">{room}</p>
            <div className="px-opts">
              <button type="button" className="px-opt" disabled={s.days < E.COST.podcast} onClick={() => { setK(0); sfx("bell"); }}><b>Go on the show</b><span>Three questions, live. {s.days < E.COST.podcast ? "Not enough time left this week." : "A full day."}</span></button>
              <button type="button" className="px-ghost" onClick={onClose}>Not now</button>
            </div>
            {m.src ? <a className="px-src" href={m.src} target="_blank" rel="noopener noreferrer">What they said about the race</a> : null}
          </>
        ) : fin ? (
          <div className="px-out">
            <p>{tot.fx >= 0.05 ? "The episode was a hit. Clips are everywhere and your numbers with the audience moved." : tot.fx <= -0.05 ? "It went badly. The worst minute is the one everybody saw." : "A decent episode. Nobody will remember it in a week."}</p>
            <b className={cls("px-big", tot.fx >= 0 ? "up" : "dn")}>{fxs(tot.fx)} points</b>
            <button type="button" className="px-btn go" onClick={() => onDone(x, tot.fx)}>Done</button>
          </div>
        ) : (
          <>
            <p className="px-line"><b>Question {k + 1} of {qs.length}.</b> <Type key={k} text={qs[k].q} speed={14} /></p>
            {!ans ? (
              <div className="px-opts">{qs[k].opts.map((o, j) => <button key={j} type="button" className="px-opt" onClick={() => pick(j)}><b>{o.label}</b><span>{o.say}</span></button>)}</div>
            ) : (
              <div className="px-out">
                <p>{ans.clip ?? (ans.fx >= 0.03 ? "The host nodded. So did the chat." : ans.fx <= -0.03 ? "The chat turned on you." : "It landed fine.")}</p>
                <b className={cls("px-big", ans.fx >= 0 ? "up" : "dn")}>{fxs(ans.fx)}</b>
                <button type="button" className="px-btn go" onClick={next}>{k + 1 < qs.length ? "Next question" : "Sign off"}</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
