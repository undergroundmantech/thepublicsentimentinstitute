"use client";
// The money page body: the bubble map and the race cards share one selection.
import React, { useState } from "react";
import Link from "@/app/components/Link";
import MoneyMap from "./MoneyMap";
import type { RaceMoney } from "../data";

const usd = (n: number | null | undefined) => (n == null ? "n/a" : n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${n}`);
const SC: Record<string, string> = { D: "#3d7bff", R: "#ff3b5c", I: "#b78cff" };

export default function MoneyRoom({ races }: { races: RaceMoney[] }) {
  const [pick, setPick] = useState<string | null>(races[0]?.key ?? null);
  const r = races.find((x) => x.key === pick) ?? races[0];
  const max = Math.max(...races.map((x) => x.total ?? 0));
  return (
    <div className="mr">
      <div className="card mr-map"><div className="card-h"><h3>Where the outside money lands</h3><span className="eye" style={{ marginLeft: "auto" }}>Click a state</span></div><MoneyMap races={races} onPick={setPick} picked={pick} /></div>
      {r ? (
        <div className="card mr-race">
          <div className="card-h"><h3>{r.key}</h3><Link className="wd-btn" href={r.href} style={{ marginLeft: "auto" }}>The forecast</Link></div>
          <div className="card-b">
            <div className="mr-total"><b>{usd(r.total)}</b><span>outside money in the general election</span></div>
            {r.forD != null && r.forR != null ? (
              <>
                <div className="wd-bar mr-split"><i style={{ width: `${(r.forD / ((r.forD + r.forR) || 1)) * 100}%`, background: "#3d7bff" }} /><i style={{ flex: 1, background: "#ff3b5c" }} /></div>
                <div className="mr-sides"><span className="d">{usd(r.forD)} helps {r.dem ?? "the Democrat"}</span><span className="r">{usd(r.forR)} helps {r.gop ?? "the Republican"}</span></div>
              </>
            ) : null}
            {r.ledger ? <div className="mr-ledger"><div className="eye gold">The campaigns, per Ledger</div>{r.ledger.cands.map(([n, s, v]) => <div key={n} className="mr-c"><span className={s === "D" ? "d" : "r"}>{n}</span><b>{usd(v)} raised</b></div>)}</div> : null}
            <div className="eye gold" style={{ marginTop: 12 }}>The groups spending</div>
            <div className="mr-groups">
              {r.groups.slice(0, 10).map((g, i) => (
                <Link key={i} href={`/watchdog/connections?name=${encodeURIComponent("g:" + g.name)}`} className="mr-g">
                  <span><b>{g.name}</b><small>{g.kind === "oppose" ? "against" : "for"} {g.target}</small></span>
                  <span className="wd-bar"><i style={{ width: `${(g.amount / (r.groups[0]?.amount || 1)) * 100}%`, background: g.kind === "oppose" ? "#ff9a5c" : SC[g.side ?? ""] ?? "#e7b341", animationDelay: `${i * 0.05}s` }} /></span>
                  <span className="wd-amt">{usd(g.amount)}</span>
                </Link>
              ))}
            </div>
            <p className="wd-src">Source: <a href={(r.source.match(/https?:\/\/[^\s;]+/) ?? ["#"])[0]} target="_blank" rel="noreferrer">public compilations of FEC filings</a>{r.asOf ? `, as of ${r.asOf}` : ""}.</p>
          </div>
        </div>
      ) : null}
      <div className="card mr-all">
        <div className="card-h"><h3>Every race with outside money</h3></div>
        <div className="wd-list">
          {races.map((x) => (
            <button key={x.key} className={`mr-row${x.key === pick ? " on" : ""}`} onClick={() => setPick(x.key)}>
              <b>{x.key}</b>
              <span className="wd-bar"><i style={{ width: `${((x.forD ?? 0) / max) * 100}%`, background: "#3d7bff" }} /><i style={{ width: `${((x.forR ?? 0) / max) * 100}%`, background: "#ff3b5c" }} /></span>
              <span className="wd-amt">{usd(x.total)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
