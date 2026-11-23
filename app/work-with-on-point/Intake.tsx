"use client";
// The consulting intake: the eight questions the discovery call needs answered before it starts.
import { useState } from "react";
import { CONSULTING } from "@/app/lib/offers";
import { ev } from "@/app/lib/ev";

const BUDGET = ["Under $1,000", "$1,000 to $5,000", "$5,000 to $15,000", "$15,000 and up", "Not sure yet"];
const WHEN = ["This month", "In 1 to 3 months", "Before the 2027 primaries", "Before the 2028 primaries", "Just exploring"];
export default function Intake() {
  const [f, setF] = useState({ name: "", email: "", org: "", role: "", race: "", need: "", budget: "", when: "", notes: "", website: "" });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [done, setDone] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const go = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try { const j = await (await fetch("/api/community/intake", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) })).json();
      if (j.ok) { setDone(true); ev("Consulting intake", { need: f.need }); } else setErr(j.error); } catch { setErr("That didn't go through. Try again, or email info@publicsentimentinstitute.com."); } finally { setBusy(false); }
  };
  if (done) return <div className="cm-card" role="status"><h3>Thanks, {f.name.split(" ")[0]}.</h3><p className="cm-mute" style={{ fontSize: 14 }}>We read every request and reply within one business day with times for a call.</p></div>;
  return (
    <form className="cm-card" onSubmit={go} aria-labelledby="in-h" style={{ gap: 10 }}>
      <h3 id="in-h" style={{ fontSize: 19 }}>Tell us about your race</h3>
      <div className="cm-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        <input id="in-name" className="cm-in" placeholder="Your name" autoComplete="name" value={f.name} onChange={set("name")} aria-label="Your name" required />
        <input id="in-email" className="cm-in" type="email" placeholder="Email" autoComplete="email" value={f.email} onChange={set("email")} aria-label="Email" required />
        <input id="in-org" className="cm-in" placeholder="Campaign or organization" value={f.org} onChange={set("org")} aria-label="Campaign or organization" />
        <input id="in-role" className="cm-in" placeholder="Your role" value={f.role} onChange={set("role")} aria-label="Your role" />
        <input id="in-race" className="cm-in" placeholder="Race, state or district" value={f.race} onChange={set("race")} aria-label="Race, state or district" />
        <select id="in-need" className="cm-in" value={f.need} onChange={set("need")} aria-label="What you need" required><option value="">What you need</option>{CONSULTING.map((c) => <option key={c.name}>{c.name}</option>)}<option>Something else</option></select>
        <select id="in-budget" className="cm-in" value={f.budget} onChange={set("budget")} aria-label="Budget"><option value="">Budget</option>{BUDGET.map((b) => <option key={b}>{b}</option>)}</select>
        <select id="in-when" className="cm-in" value={f.when} onChange={set("when")} aria-label="Timing"><option value="">Timing</option>{WHEN.map((b) => <option key={b}>{b}</option>)}</select>
      </div>
      <textarea id="in-notes" className="cm-in" rows={4} placeholder="Anything else: the question you need answered, polls you already have, your deadline" value={f.notes} onChange={set("notes")} aria-label="Anything else" />
      <input className="oc-trap" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.website} onChange={set("website")} name="website" />
      {err ? <p className="oc-err" role="alert">{err}</p> : null}
      <button className="btn gold" type="submit" disabled={busy} style={{ justifySelf: "start" }}>{busy ? "Sending" : "Send my request"}</button>
    </form>
  );
}
