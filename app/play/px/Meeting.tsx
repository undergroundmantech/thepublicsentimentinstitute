"use client";
// A meeting with someone who matters in the state: a party chair, a union boss, a megadonor, a podcaster, a pastor, a
// sheriff, or a real endorser from the research. Each one costs a day and can pay off or blow up.
import React, { useMemo, useState } from "react";
import * as E from "../engine";
import { ROLE_NAME } from "../events";
import { seedOf } from "./sprites";
import { sfx } from "./sound";
import { Portrait, Type, cls, fxs } from "./ui";

export default function Meeting({ r, s, m, onDone, onClose }: { r: E.RaceFile; s: E.State; m: E.Meet; onDone: (x: E.State, res: { fx: number; caught: boolean }) => void; onClose: () => void }) {
  const c = useMemo(() => E.ctx(r, s.side), [r, s.side]);
  const [typed, setTyped] = useState(false);
  const [res, setRes] = useState<{ x: E.State; t: string; fx: number; caught: boolean; parts: E.Part[]; k: number } | null>(null);
  const pick = (k: number) => {
    const x = structuredClone(s); const o = E.resolveMeet(c, x, m, k);
    setRes({ x, ...o, k }); sfx(o.caught ? (o.fx >= 0 ? "fanfare" : "alarm") : o.fx > 0.02 ? "good" : o.fx < -0.02 ? "bad" : "coin");
  };
  const opP = m.role === "mole" ? c.op.party : m.role === "chair" || m.role === "endorser" ? c.me.party : "";
  return (
    <div className="px-modal" role="dialog" aria-modal="true" aria-labelledby="px-meet-h">
      <div className={cls("px-meet", m.role)}>
        <div className="px-meet-bg" aria-hidden="true" />
        <div className="px-meet-top">
          <Portrait seed={m.seed} role={m.role} party={opP} talking={!typed && !res} size={132} />
          <div>
            <span className="px-tag">{ROLE_NAME[m.role]}{m.real ? <em className="px-real">Real</em> : null}</span>
            <h3 id="px-meet-h">{m.title}</h3>
            <b className="px-who">{m.who}</b>
            <span className="px-k">{m.place} · costs a day</span>
          </div>
        </div>
        <p className="px-line"><Type text={m.intro} onDone={() => setTyped(true)} /></p>
        {!res ? (
          <div className="px-opts">
            {m.opts.map((o, k) => {
              const blocked = (o.need === "oppo" && !s.staff.oppo) || ((o.out.days ?? 1) > s.days);
              return <button key={k} type="button" className="px-opt" disabled={blocked} onClick={() => pick(k)}><b>{o.label}</b><span>{o.say}{o.need === "oppo" && !s.staff.oppo ? " Needs an opposition research firm." : ""}{(o.out.days ?? 1) === 0 ? " No day spent." : ""}</span></button>;
            })}
            <button type="button" className="px-ghost" onClick={onClose}>Not now</button>
          </div>
        ) : (
          <div className="px-out">
            <p>{res.t}</p>
            {res.fx ? <b className={cls("px-big", res.fx >= 0 ? "up" : "dn")}>{fxs(res.fx)} points</b> : null}
            <ul className="px-gains">
              {m.opts[res.k].out.cash ? <li className="coin">{m.opts[res.k].out.cash! > 0 ? "+" : ""}{E.usd(m.opts[res.k].out.cash!)}</li> : null}
              {m.opts[res.k].out.vol ? <li className="vol">{m.opts[res.k].out.vol! > 0 ? "+" : ""}{m.opts[res.k].out.vol} volunteers</li> : null}
              {m.opts[res.k].out.enth ? <li className="enth">{m.opts[res.k].out.enth! > 0 ? "+" : ""}{m.opts[res.k].out.enth} base enthusiasm</li> : null}
              {m.opts[res.k].out.buzz ? <li className="buzz">{m.opts[res.k].out.buzz! > 0 ? "+" : ""}{m.opts[res.k].out.buzz} buzz</li> : null}
              {m.opts[res.k].out.prep ? <li className="prep">+{m.opts[res.k].out.prep} debate prep</li> : null}
              {m.opts[res.k].out.endorse ? <li className="end">Endorsement</li> : null}
            </ul>
            {m.src ? <a className="px-src" href={m.src} target="_blank" rel="noopener noreferrer">Source for the real endorsement</a> : null}
            <button type="button" className="px-btn go" onClick={() => onDone(res.x, { fx: res.fx, caught: res.caught })}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
export const meetSeed = seedOf;
