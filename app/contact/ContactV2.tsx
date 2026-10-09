"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";

const CONTACT_EMAIL = "tpsinstitutecontact@gmail.com";

type FormState = {
  name: string;
  email: string;
  org: string;
  topic: string;
  geography: string;
  audience: string;
  timeline: string;
  message: string;
};

type Status =
  | { type: "idle" }
  | { type: "sending" }
  | { type: "sent" }
  | { type: "error"; message: string };

const EMPTY_FORM: FormState = {
  name: "", email: "", org: "", topic: "",
  geography: "", audience: "", timeline: "", message: "",
};

const TOPICS = [
  "Presidential Approval",
  "Generic Ballot",
  "State-Level Polling",
  "Issue Polling",
  "Custom Track",
  "Partnership / Media",
  "Other",
];

const TAKES = [
  { t: "Custom polls", n: "A race, a district, an issue: fielded, weighted and delivered with the crosstabs." },
  { t: "Recurring tracks", n: "Weekly or monthly waves on the questions you need answered all cycle long." },
  { t: "Partner research", n: "Co-branded studies with campaigns, media desks, and research organizations." },
  { t: "Media & data requests", n: "Methodology questions, interview requests, and raw series access." },
];

export default function ContactPage() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [status, setStatus] = useState<Status>({ type: "idle" });

  const onChange =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((s) => ({ ...s, [key]: e.target.value }));

  const canSubmit = useMemo(
    () => form.name.trim().length > 0 && form.email.trim().includes("@") && form.message.trim().length > 10,
    [form]
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus({ type: "sending" });

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, to: CONTACT_EMAIL }),
      });
      if (!res.ok) throw new Error("server error");
      setStatus({ type: "sent" });
    } catch {
      const subject = encodeURIComponent("[PSI Project Request] " + (form.topic || "General Inquiry"));
      const body = encodeURIComponent(
        [
          `Name: ${form.name}`,
          `Email: ${form.email}`,
          `Organization: ${form.org || "N/A"}`,
          ``,
          `Topic / Issue: ${form.topic || "N/A"}`,
          `Geography: ${form.geography || "N/A"}`,
          `Audience: ${form.audience || "N/A"}`,
          `Timeline: ${form.timeline || "N/A"}`,
          ``,
          `Message:`,
          form.message,
        ].join("\n")
      );
      window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
      setStatus({ type: "sent" });
    }
  };

  return (
    <div className="opp ct">
      <style>{CSS}</style>
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><span>Contact</span></nav>
      <header className="ph">
        <div className="eye g">Contact the desk</div>
        <h1>Partner with the <em>desk</em></h1>
        <p className="lede">Custom surveys, recurring tracks and partner research, scoped, fielded by The Public Sentiment Institute and delivered with the crosstabs. Inquiries go directly to the research team.</p>
        <div className="pmeta">
          <span>Replies in <b>24 to 48 hours</b></span>
          <span>Model <b>Meridian coalition voter model</b></span>
          <span>Crosstabs <b>Included</b></span>
        </div>
      </header>

      <div className="layout">
        <section className="card" aria-labelledby="ct-form-h">
          <div className="card-h"><h3 id="ct-form-h">Start a brief</h3><span className="eye" style={{ marginLeft: "auto" }}>Two minutes</span></div>
          <form className="card-b ct-form" onSubmit={onSubmit} aria-label="Project intake form">
            <p className="ct-intro">Name, email and a few sentences are enough. The rest helps us scope the work faster.</p>
            <div className="ct-grid">
              <label className="ct-field">
                <span>Name<i>*</i></span>
                <input value={form.name} onChange={onChange("name")} autoComplete="name" placeholder="Who are we talking to?" />
              </label>
              <label className="ct-field">
                <span>Email<i>*</i></span>
                <input value={form.email} onChange={onChange("email")} type="email" autoComplete="email" placeholder="you@organization.com" />
              </label>
              <label className="ct-field">
                <span>Organization</span>
                <input value={form.org} onChange={onChange("org")} placeholder="Campaign, outlet or org, optional" />
              </label>
              <label className="ct-field">
                <span>Topic</span>
                <select value={form.topic} onChange={onChange("topic")}>
                  <option value="">Pick the closest fit</option>
                  {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="ct-field">
                <span>Geography</span>
                <input value={form.geography} onChange={onChange("geography")} placeholder="National, a state, a district" />
              </label>
              <label className="ct-field">
                <span>Timeline</span>
                <input value={form.timeline} onChange={onChange("timeline")} placeholder="When do you need it in the field?" />
              </label>
              <label className="ct-field ct-wide">
                <span>Audience</span>
                <input value={form.audience} onChange={onChange("audience")} placeholder="Likely voters? Registered? A custom universe?" />
              </label>
              <label className="ct-field ct-wide">
                <span>The brief<i>*</i></span>
                <textarea value={form.message} onChange={onChange("message")} rows={5} placeholder="What do you need to learn, and why now?" />
              </label>
            </div>
            <div className="ct-actions">
              <button type="submit" className="btn g ct-send" disabled={!canSubmit || status.type === "sending"}>
                {status.type === "sending" ? "Sending..." : "Send it to the desk"}
              </button>
              <span className="ct-status" role="status">
                {status.type === "sent" && <span className="ok">Received. We&rsquo;ll reply within two days.</span>}
                {status.type === "error" && status.message}
                {status.type === "idle" && !canSubmit && "Name, email and a brief are required"}
              </span>
            </div>
          </form>
        </section>

        <aside className="side">
          <div className="card">
            <div className="card-h"><h3>Write to us</h3></div>
            <div className="card-b">
              <a className="ct-mail mono" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
              <p style={{ fontSize: 13.5, marginTop: 10 }}>Prefer email? Everything the form asks fits in one message.</p>
            </div>
          </div>
          <div className="card">
            <div className="card-h"><h3>What the desk takes on</h3></div>
            <div>
              {TAKES.map((x, i) => (
                <div className="ct-take" key={x.t}>
                  <span className="mono">{String(i + 1).padStart(2, "0")}</span>
                  <div><b>{x.t}</b><p>{x.n}</p></div>
                </div>
              ))}
            </div>
          </div>
          <div className="callout"><div className="eye">Fieldwork</div>Polls are fielded by The Public Sentiment Institute for OnPoint Politics. See the <Link href="/tpsi/services" style={{ textDecoration: "underline" }}>services</Link> and <Link href="/tpsi/methodology" style={{ textDecoration: "underline" }}>methodology</Link>.</div>
        </aside>
      </div>
    </div>
  );
}

const CSS = `
.ct .ct-intro { font-size: 14px; margin: 0 0 16px; }
.ct .ct-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.ct .ct-wide { grid-column: 1 / -1; }
.ct .ct-field { display: grid; gap: 6px; }
.ct .ct-field > span { font: 700 10.5px var(--font-m); letter-spacing: .12em; text-transform: uppercase; color: var(--mute); }
.ct .ct-field > span i { font-style: normal; color: var(--ink); margin-left: 3px; }
.ct .ct-field input, .ct .ct-field select, .ct .ct-field textarea {
  width: 100%; padding: 11px 14px; border-radius: 10px; border: 1px solid var(--line2); background: var(--glass2);
  color: var(--ink); font: 500 14px var(--font-b); outline: none; transition: border-color .15s, box-shadow .15s; -webkit-appearance: none; appearance: none;
}
.ct .ct-field textarea { resize: vertical; min-height: 120px; line-height: 1.5; }
.ct .ct-field select { background-image: linear-gradient(45deg, transparent 50%, var(--mute) 50%), linear-gradient(135deg, var(--mute) 50%, transparent 50%); background-position: calc(100% - 18px) 50%, calc(100% - 13px) 50%; background-size: 5px 5px; background-repeat: no-repeat; padding-right: 34px; }
.ct .ct-field select option { background: var(--bg2); color: var(--ink); }
.ct .ct-field input::placeholder, .ct .ct-field textarea::placeholder { color: var(--mute2); }
.ct .ct-field input:focus-visible, .ct .ct-field select:focus-visible, .ct .ct-field textarea:focus-visible { border-color: var(--hi); box-shadow: 0 0 0 3px rgba(var(--line-rgb),.18); outline: none; }
.ct .ct-actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-top: 18px; }
.ct .ct-send { padding: 12px 20px; font-size: 14px; }
.ct .ct-send:disabled { opacity: .45; cursor: not-allowed; transform: none; }
.ct .ct-send:focus-visible { outline: 2px solid var(--hi); outline-offset: 3px; }
.ct .ct-status { font-size: 13px; color: var(--mute); }
.ct .ct-status .ok { color: var(--ink); }
.ct .ct-mail { font-size: 13px; font-weight: 700; color: var(--ink); text-decoration: underline; text-underline-offset: 3px; word-break: break-all; }
.ct .ct-take { display: grid; grid-template-columns: 28px 1fr; gap: 8px; padding: 12px 18px; border-top: 1px solid var(--line); }
.ct .ct-take:first-child { border-top: 0; }
.ct .ct-take .mono { font-size: 12px; font-weight: 700; color: var(--mute); padding-top: 1px; }
.ct .ct-take b { font-size: 14px; }
.ct .ct-take p { font-size: 13px; color: var(--mute); margin: 2px 0 0; }
@media (max-width: 600px) { .ct .ct-grid { grid-template-columns: 1fr; } }
`;
