"use client";
// Email updates through the On Point newsletter on Substack: the reader types an address here and confirms it on
// Substack, which holds the list and sends the mail, so the site stores no addresses of its own.
import { useState } from "react";
import { ev } from "@/app/lib/ev";
import "./alertSignup.css";

const SUBSTACK = "https://onpointpolitics.substack.com";

export default function AlertSignup({ title, note, from }: { title: string; note: string; from: string }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const go = (e: React.FormEvent) => {
    e.preventDefault(); if (!ok) return;
    ev("Alert signup", { from });
    window.open(`${SUBSTACK}/subscribe?email=${encodeURIComponent(email.trim())}`, "_blank", "noopener");
    setSent(true);
  };
  return (
    <form className="opp alrt" onSubmit={go} aria-labelledby={`alrt-${from}`}>
      <div className="alrt-t"><span className="eye">Free updates</span><b id={`alrt-${from}`}>{title}</b><p>{note}</p></div>
      {sent ? <p className="alrt-ok" role="status">Check the Substack tab that just opened to confirm, then watch your inbox.</p> : (
        <div className="alrt-f">
          <label htmlFor={`alrt-e-${from}`} className="sr">Email address</label>
          <input id={`alrt-e-${from}`} type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button type="submit" className="btn g" disabled={!ok}>Send me updates</button>
        </div>
      )}
    </form>
  );
}
