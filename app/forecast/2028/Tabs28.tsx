"use client";
// Two prebuilt versions of the same section, such as with and without a candidate, one shown at a time.
import { useState, type ReactNode } from "react";

export default function Tabs28({ labels, children }: { labels: string[]; children: ReactNode[] }) {
  const [i, setI] = useState(0);
  return (
    <div className="p28-tabs">
      <div className="p28-seg sm" role="tablist">
        {labels.map((l, k) => <button key={l} type="button" role="tab" aria-selected={i === k} className={i === k ? "on" : ""} onClick={() => setI(k)}>{l}</button>)}
      </div>
      {children.map((c, k) => <div key={k} hidden={i !== k}>{c}</div>)}
    </div>
  );
}
