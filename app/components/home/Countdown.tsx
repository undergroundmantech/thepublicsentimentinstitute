"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ELECTION_ISO } from "@/app/lib/opp";

function parts() {
  const d = Math.max(0, new Date(ELECTION_ISO).getTime() - Date.now());
  return { days: Math.floor(d / 864e5), hrs: Math.floor((d % 864e5) / 36e5), min: Math.floor((d % 36e5) / 6e4) };
}

export default function Countdown() {
  const [p, setP] = useState<{ days: number; hrs: number; min: number } | null>(null);
  useEffect(() => { setP(parts()); const t = setInterval(() => setP(parts()), 30000); return () => clearInterval(t); }, []);
  return (
    <div className="card count">
      <div className="card-b">
        <div className="eye">Next election night</div>
        <div className="bignum" style={{ marginTop: 8 }}>Nov 3</div>
        <div className="n" aria-live="off">
          <div><b className="mono">{p ? p.days : "·"}</b><span>days</span></div>
          <div><b className="mono">{p ? p.hrs : "·"}</b><span>hrs</span></div>
          <div><b className="mono">{p ? p.min : "·"}</b><span>min</span></div>
        </div>
        <div style={{ fontSize: 13, color: "var(--ink2)", marginTop: 12 }}>County maps, call log, live model updates and the stream from the TPSI situation room.</div>
        <Link className="btn white" style={{ marginTop: 14 }} href="/results/live">Open the live desk</Link>
      </div>
    </div>
  );
}
