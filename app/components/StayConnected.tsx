"use client";
// Join the On Point list: email alerts for new videos, polls, the majority tracker and
// the 2028 forecast, plus the four places to follow. The list lives on the site, so a new video can go out as an
// email the moment it is posted; the Substack newsletter is offered alongside, not instead.
import { useState } from "react";
import { usePathname } from "next/navigation";
import { SOCIAL, TOPICS, type Topic } from "@/app/lib/offers";
import { ev } from "@/app/lib/ev";
import "./community.css";


export function Follow({ compact }: { compact?: boolean }) {
  return (
    <div className={`oc-follow${compact ? " sm" : ""}`}>
      <a className="oc-soc yt" href={SOCIAL.youtubeSub} target="_blank" rel="noopener noreferrer" onClick={() => ev("Follow", { to: "youtube" })}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.7 15.1V8.9l5.8 3.1-5.8 3.1z" /></svg>Subscribe on YouTube</a>
      <a className="oc-soc x" href={SOCIAL.x} target="_blank" rel="noopener noreferrer" onClick={() => ev("Follow", { to: "x" })}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.2 2.3h3.4l-7.4 8.4 8.7 11.5h-6.8l-5.3-7-6.1 7H1.3l7.9-9L.9 2.3h7l4.8 6.4 5.5-6.4zm-1.2 17.9h1.9L7.1 4.2H5.1l11.9 16z" /></svg>Follow on X</a>
      <a className="oc-soc dc" href={SOCIAL.discord} target="_blank" rel="noopener noreferrer" onClick={() => ev("Follow", { to: "discord" })}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.6 1.3a18.2 18.2 0 0 0-5.5 0L8.6 3a19.6 19.6 0 0 0-4.9 1.4C.6 9 0 13.6.3 18.1a19.8 19.8 0 0 0 6 3l1.3-2.1c-.7-.3-1.4-.6-2-1l.5-.4a14 14 0 0 0 11.8 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.7 19.7 0 0 0 6-3c.4-5.2-.7-9.7-3.4-13.7zM8.5 15.4c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4zm7 0c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4z" /></svg>Join the Discord</a>
      <a className="oc-soc ss" href={SOCIAL.substack} target="_blank" rel="noopener noreferrer" onClick={() => ev("Follow", { to: "substack" })}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h18v2.5H3zM3 7.8h18v2.5H3zM3 12.6h18V22l-9-5-9 5z" /></svg>Read the Substack</a>
    </div>
  );
}

export default function StayConnected({ from, variant = "full", title, note, pick }: { from?: string; variant?: "full" | "foot"; title?: string; note?: string; pick?: Topic[] }) {
  const path = usePathname() || "";
  const [email, setEmail] = useState("");
  const [topics, setTopics] = useState<Topic[]>(pick ?? ["videos", "polls"]); const [news, setNews] = useState(true);
  const [busy, setBusy] = useState(false); const [done, setDone] = useState<null | { email: boolean; sms: boolean }>(null); const [err, setErr] = useState(""); const [trap, setTrap] = useState("");
  const src = from ?? (path || "site");
  const flip = (k: Topic) => setTopics((t) => (t.includes(k) ? t.filter((x) => x !== k) : [...t, k]));
  const go = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    if (!email.trim()) { setErr("Enter your email address."); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/alerts/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, topics, from: src, website: trap }) });
      const j = await r.json(); if (!j.ok) { setErr(j.error || "That didn't go through. Try again."); return; }
      ev("Alert signup", { from: src, topics: topics.join(" ") });
      if (news && email.trim()) window.open(`${SOCIAL.substack}/subscribe?email=${encodeURIComponent(email.trim())}`, "_blank", "noopener");
      setDone({ email: true, sms: false });
    } catch { setErr("That didn't go through. Check your connection and try again."); } finally { setBusy(false); }
  };
  const id = `oc-${variant}-${src.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <section className={`opp oc oc-${variant}`} aria-labelledby={`${id}-h`}>
      <div className="oc-head">
        <span className="eye">Free alerts</span>
        <h2 id={`${id}-h`}>{title ?? "Get every On Point video, poll and forecast first"}</h2>
        <p>{note ?? "An email the moment a new video goes up, a new poll drops or the forecast moves. Free, and you can leave any time."}</p>
      </div>
      {done ? (
        <div className="oc-done" role="status"><b>You're on the list.</b> Watch your inbox for the next one.{news && done.email ? " Confirm the Substack tab that opened to get the weekly newsletter too." : ""}<Follow compact /></div>
      ) : (
        <form className="oc-form" onSubmit={go} noValidate>
          <div className="oc-topics" role="group" aria-label="What to hear about">
            {TOPICS.map((t) => <button type="button" key={t.k} className={`oc-chip${topics.includes(t.k) ? " on" : ""}`} aria-pressed={topics.includes(t.k)} onClick={() => flip(t.k)}>{t.label}</button>)}
          </div>
          <div className="oc-fields">
            <label htmlFor={`${id}-e`} className="oc-sr">Email address</label>
            <input id={`${id}-e`} type="email" inputMode="email" autoComplete="email" placeholder="Your email address" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="oc-trap" tabIndex={-1} autoComplete="off" aria-hidden="true" value={trap} onChange={(e) => setTrap(e.target.value)} name="website" />
            <button type="submit" className="btn g" disabled={busy}>{busy ? "Adding you" : "Sign me up"}</button>
          </div>
          <label className="oc-news"><input type="checkbox" checked={news} onChange={(e) => setNews(e.target.checked)} /><span>Also send me the free weekly On Point newsletter on Substack</span></label>
          {err ? <p className="oc-err" role="alert">{err}</p> : null}
        </form>
      )}
      {done ? null : <Follow compact={variant === "foot"} />}
    </section>
  );
}
