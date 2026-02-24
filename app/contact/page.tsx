// app/contact/page.tsx
"use client";

import React, { useMemo, useState } from "react";

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

export default function ContactPage() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [focused, setFocused] = useState<string | null>(null);

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
      // Mailto fallback
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

  const fieldClass = (name: string) =>
    `ct-input${focused === name ? " ct-input--focused" : ""}`;

  return (
    <>
      <style>{CSS}</style>
      <div className="ct-root">
        <div className="ct-stripe" />

        {/* ── HERO ── */}
        <div className="ct-hero">
          <div className="ct-stripe" />
          <div className="ct-hero-inner">
            <div>
              <div className="ct-eyebrow">Public Sentiment Institute · Intake</div>
              <h1 className="ct-hero-title">
                Contact<br />
                <em className="ct-em">PSI</em>
              </h1>
              <p className="ct-hero-desc">
                Request a poll, propose a partnership, or discuss recurring fielding.
                All inquiries route to our research team at{" "}
                <span className="ct-email-inline">{CONTACT_EMAIL}</span>.
              </p>
              <div className="ct-badge-row">
                <span className="ct-badge ct-badge-live"><span className="ct-live-dot" />SAME-DAY RESPONSE</span>
                <span className="ct-badge ct-badge-purple">CUSTOM FIELDING AVAILABLE</span>
                <span className="ct-badge">NATIONAL · STATE · DISTRICT</span>
              </div>
            </div>
            <div className="ct-hero-facts">
              {[
                { label: "RESPONSE", val: "Same Day" },
                { label: "CONTACT",  val: "Research" },
                { label: "FIELDING", val: "Custom" },
              ].map(({ label, val }) => (
                <div key={label} className="ct-fact">
                  <div className="ct-fact-label">{label}</div>
                  <div className="ct-fact-val">{val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div className="ct-layout">
          {/* ── FORM ── */}
          <form onSubmit={onSubmit} className="ct-form-panel">
            <div className="ct-stripe" />
            <div className="ct-form-inner">
              <div className="ct-form-header">
                <div>
                  <div className="ct-form-title">PROJECT REQUEST</div>
                  <div className="ct-form-sub">Fields marked * are required</div>
                </div>
                <StatusPill status={status} />
              </div>

              <div className="ct-divider" />

              {/* Row 1: Name + Email */}
              <div className="ct-row-2">
                <div className="ct-field">
                  <label className="ct-label">NAME *</label>
                  <input
                    className={fieldClass("name")}
                    value={form.name}
                    onChange={onChange("name")}
                    onFocus={() => setFocused("name")}
                    onBlur={() => setFocused(null)}
                    placeholder="Your full name"
                    autoComplete="name"
                    required
                  />
                </div>
                <div className="ct-field">
                  <label className="ct-label">EMAIL *</label>
                  <input
                    type="email"
                    className={fieldClass("email")}
                    value={form.email}
                    onChange={onChange("email")}
                    onFocus={() => setFocused("email")}
                    onBlur={() => setFocused(null)}
                    placeholder="you@organization.com"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              {/* Row 2: Org */}
              <div className="ct-field">
                <label className="ct-label">ORGANIZATION</label>
                <input
                  className={fieldClass("org")}
                  value={form.org}
                  onChange={onChange("org")}
                  onFocus={() => setFocused("org")}
                  onBlur={() => setFocused(null)}
                  placeholder="Campaign, firm, nonprofit, media outlet…"
                  autoComplete="organization"
                />
              </div>

              {/* Row 3: Topic + Geography */}
              <div className="ct-row-2">
                <div className="ct-field">
                  <label className="ct-label">TOPIC / ISSUE AREA</label>
                  <select
                    className={`ct-select${focused === "topic" ? " ct-input--focused" : ""}`}
                    value={form.topic}
                    onChange={onChange("topic")}
                    onFocus={() => setFocused("topic")}
                    onBlur={() => setFocused(null)}
                  >
                    <option value="">Select a topic…</option>
                    {TOPICS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="ct-field">
                  <label className="ct-label">GEOGRAPHY</label>
                  <input
                    className={fieldClass("geography")}
                    value={form.geography}
                    onChange={onChange("geography")}
                    onFocus={() => setFocused("geography")}
                    onBlur={() => setFocused(null)}
                    placeholder="National, state, district…"
                  />
                </div>
              </div>

              {/* Row 4: Audience + Timeline */}
              <div className="ct-row-2">
                <div className="ct-field">
                  <label className="ct-label">TARGET AUDIENCE</label>
                  <input
                    className={fieldClass("audience")}
                    value={form.audience}
                    onChange={onChange("audience")}
                    onFocus={() => setFocused("audience")}
                    onBlur={() => setFocused(null)}
                    placeholder="Adults 18+, RV, LV, primary voters…"
                  />
                </div>
                <div className="ct-field">
                  <label className="ct-label">TIMELINE</label>
                  <input
                    className={fieldClass("timeline")}
                    value={form.timeline}
                    onChange={onChange("timeline")}
                    onFocus={() => setFocused("timeline")}
                    onBlur={() => setFocused(null)}
                    placeholder="Dates, urgency, recurring cadence…"
                  />
                </div>
              </div>

              {/* Message */}
              <div className="ct-field">
                <label className="ct-label">MESSAGE *</label>
                <textarea
                  className={`ct-textarea${focused === "message" ? " ct-input--focused" : ""}`}
                  value={form.message}
                  onChange={onChange("message")}
                  onFocus={() => setFocused("message")}
                  onBlur={() => setFocused(null)}
                  placeholder="What do you want to measure? Required demographics? Sample size? Outputs (tabs, memo, toplines)?"
                  required
                />
              </div>

              {/* Actions */}
              <div className="ct-actions">
                <button
                  type="submit"
                  disabled={!canSubmit || status.type === "sending"}
                  className="ct-btn-primary"
                >
                  {status.type === "sending" ? "TRANSMITTING…" : "SEND REQUEST →"}
                </button>
                <button
                  type="button"
                  className="ct-btn-ghost"
                  onClick={() => { setForm(EMPTY_FORM); setStatus({ type: "idle" }); }}
                >
                  CLEAR
                </button>
                {status.type === "sent" && (
                  <span className="ct-sent-note">
                    ✓ Submitted — if no server is configured your email client will open.
                  </span>
                )}
              </div>

              <div className="ct-disclaimer">
                DIRECT SEND TARGET: {CONTACT_EMAIL} · PLEASE AVOID SENSITIVE PERSONAL INFORMATION
              </div>
            </div>
          </form>

          {/* ── SIDEBAR ── */}
          <aside className="ct-sidebar">
            {/* What to include */}
            <div className="ct-sidebar-card">
              <div className="ct-stripe" />
              <div className="ct-sidebar-inner">
                <div className="ct-sidebar-title">WHAT TO INCLUDE</div>
                <div className="ct-sidebar-sub">Fastest replies come with full context</div>
                <div className="ct-divider" />
                <ul className="ct-checklist">
                  {[
                    { color: "var(--ct-purple)", text: "Target geography + audience (A18+, RV, LV)" },
                    { color: "var(--ct-accent)", text: "Field dates / cadence (one-time vs recurring)" },
                    { color: "#ef4444",           text: "Required outputs (tabs, memo, toplines, trend)" },
                    { color: "#3b82f6",           text: "Demographics, oversamples, or special targets" },
                    { color: "rgba(245,158,11,0.9)", text: "Budget range or sample size target" },
                  ].map(({ color, text }) => (
                    <li key={text} className="ct-checklist-item">
                      <span className="ct-checklist-dot" style={{ background: color }} />
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Response info */}
            <div className="ct-sidebar-card">
              <div className="ct-stripe" />
              <div className="ct-sidebar-inner">
                <div className="ct-sidebar-title">RESPONSE TIME</div>
                <div className="ct-divider" />
                <div className="ct-response-grid">
                  {[
                    { type: "Simple request",  time: "Same day",  dot: "var(--ct-green)" },
                    { type: "Custom project",  time: "24–48 hrs", dot: "var(--ct-accent)" },
                    { type: "Urgent (noted)",  time: "Priority",  dot: "#ef4444" },
                  ].map(({ type, time, dot }) => (
                    <div key={type} className="ct-response-row">
                      <div className="ct-response-type">
                        <span className="ct-response-dot" style={{ background: dot }} />
                        {type}
                      </div>
                      <div className="ct-response-time">{time}</div>
                    </div>
                  ))}
                </div>
                <div className="ct-divider" />
                <p className="ct-sidebar-note">
                  For urgent timelines, include "URGENT" in your timeline field.
                  Mark media inquiries clearly for expedited routing.
                </p>
              </div>
            </div>

            {/* Direct email */}
            <div className="ct-email-card">
              <div className="ct-email-card-label">DIRECT EMAIL</div>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="ct-email-addr"
              >
                {CONTACT_EMAIL}
              </a>
              <div className="ct-email-card-note">
                You can also email us directly — form submission routes here automatically.
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

function StatusPill({ status }: { status: Status }) {
  if (status.type === "idle") return null;
  const configs = {
    sending: { dot: "rgba(167,139,250,0.9)", text: "TRANSMITTING…" },
    sent:    { dot: "rgba(34,197,94,0.9)",  text: "SUBMITTED" },
    error:   { dot: "rgba(239,68,68,0.9)",  text: status.type === "error" ? status.message : "" },
  };
  const cfg = configs[status.type] ?? configs.error;
  return (
    <div className="ct-status-pill">
      <span className="ct-status-dot" style={{ background: cfg.dot }} />
      <span>{cfg.text}</span>
    </div>
  );
}

const CSS = `
  .ct-root {
    --ct-bg:       #070709;
    --ct-panel:    #0f0f15;
    --ct-border:   rgba(255,255,255,0.09);
    --ct-border2:  rgba(255,255,255,0.16);
    --ct-muted:    rgba(240,240,245,0.62);
    --ct-muted2:   rgba(240,240,245,0.38);
    --ct-muted3:   rgba(240,240,245,0.20);
    --ct-purple:   #7c3aed;
    --ct-soft:     #a78bfa;
    --ct-accent:   rgba(167,139,250,0.85);
    --ct-green:    rgba(34,197,94,0.9);

    display: flex;
    flex-direction: column;
    gap: 20px;
    animation: ct-fade-up 0.45s cubic-bezier(0.22,1,0.36,1) both;
  }

  @keyframes ct-fade-up {
    from { opacity:0; transform:translateY(10px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes ct-pulse {
    0%,100% { opacity:1; transform:scale(1); }
    50%      { opacity:0.3; transform:scale(0.7); }
  }

  /* STRIPE */
  .ct-stripe {
    height: 3px;
    background: linear-gradient(90deg,
      var(--ct-purple) 0%,var(--ct-purple) 33%,
      rgba(167,139,250,0.6) 33%,rgba(167,139,250,0.6) 66%,
      rgba(255,255,255,0.1) 66%,rgba(255,255,255,0.1) 100%
    );
  }

  /* LIVE DOT */
  .ct-live-dot {
    display: inline-block; width: 6px; height: 6px;
    border-radius: 50%; background: var(--ct-purple);
    box-shadow: 0 0 7px rgba(124,58,237,0.8);
    animation: ct-pulse 1.8s ease-in-out infinite;
    flex-shrink: 0;
  }

  /* EYEBROW */
  .ct-eyebrow {
    font-family: ui-monospace,'Courier New',monospace;
    font-size: 8px; font-weight: 700; letter-spacing: 0.32em;
    text-transform: uppercase; color: var(--ct-soft);
    margin-bottom: 12px;
    display: flex; align-items: center; gap: 10px;
  }
  .ct-eyebrow::before {
    content: ''; display: inline-block; width: 16px; height: 1px;
    background: var(--ct-soft); opacity: 0.5;
  }

  /* HERO */
  .ct-hero {
    border: 1px solid var(--ct-border);
    background: var(--ct-panel);
    position: relative; overflow: hidden;
  }
  .ct-hero::before {
    content: '';
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 50% 120% at 0% 60%, rgba(124,58,237,0.07) 0%, transparent 60%),
      radial-gradient(ellipse 30% 80% at 100% 30%, rgba(167,139,250,0.04) 0%, transparent 60%),
      repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.005) 3px, rgba(255,255,255,0.005) 4px);
    pointer-events: none;
  }
  .ct-hero-inner {
    position: relative; padding: 28px 30px 26px;
    display: grid; grid-template-columns: 1fr auto;
    align-items: end; gap: 24px;
  }
  @media (max-width: 640px) { .ct-hero-inner { grid-template-columns: 1fr; } }

  .ct-hero-title {
    font-family: ui-monospace,'Courier New',monospace;
    font-size: clamp(26px,4vw,52px); font-weight: 900;
    text-transform: uppercase; letter-spacing: 0.02em;
    line-height: 0.9; color: #fff; margin: 0 0 16px;
  }
  .ct-em {
    font-style: normal;
    background: linear-gradient(110deg, var(--ct-purple), var(--ct-soft));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .ct-hero-desc {
    font-family: ui-monospace,monospace;
    font-size: 9.5px; letter-spacing: 0.11em; line-height: 1.8;
    color: var(--ct-muted2); text-transform: uppercase; max-width: 520px;
  }
  .ct-email-inline {
    color: var(--ct-soft); font-weight: 700;
  }
  .ct-badge-row {
    display: flex; flex-wrap: wrap; gap: 6px; margin-top: 18px;
  }
  .ct-badge {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 9px;
    border: 1px solid var(--ct-border);
    background: rgba(255,255,255,0.03);
    font-family: ui-monospace,monospace;
    font-size: 7.5px; font-weight: 700; letter-spacing: 0.22em;
    text-transform: uppercase; color: var(--ct-muted3);
  }
  .ct-badge-live   { border-color:rgba(124,58,237,0.35); background:rgba(124,58,237,0.07); color:var(--ct-soft); }
  .ct-badge-purple { border-color:rgba(167,139,250,0.3); background:rgba(124,58,237,0.06); color:var(--ct-soft); }

  /* HERO FACTS */
  .ct-hero-facts {
    display: flex; flex-direction: column; gap: 6px; min-width: 140px;
  }
  .ct-fact {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; padding: 10px 14px;
    border: 1px solid var(--ct-border);
    background: rgba(255,255,255,0.025);
  }
  .ct-fact-label {
    font-family: ui-monospace,monospace;
    font-size: 7px; font-weight: 700; letter-spacing: 0.28em;
    text-transform: uppercase; color: var(--ct-muted3);
  }
  .ct-fact-val {
    font-family: ui-monospace,monospace;
    font-size: 13px; font-weight: 900; color: var(--ct-soft);
  }

  /* LAYOUT */
  .ct-layout {
    display: grid; grid-template-columns: 1fr 320px; gap: 16px;
    align-items: start;
  }
  @media (max-width: 900px) { .ct-layout { grid-template-columns: 1fr; } }

  /* FORM PANEL */
  .ct-form-panel {
    background: var(--ct-panel);
    border: 1px solid var(--ct-border);
    overflow: hidden;
  }
  .ct-form-inner {
    padding: 24px 26px;
    display: flex; flex-direction: column; gap: 16px;
  }
  .ct-form-header {
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: 12px; flex-wrap: wrap;
  }
  .ct-form-title {
    font-family: ui-monospace,monospace;
    font-size: 10px; font-weight: 900; letter-spacing: 0.28em;
    text-transform: uppercase; color: var(--ct-soft);
  }
  .ct-form-sub {
    font-family: ui-monospace,monospace;
    font-size: 8px; letter-spacing: 0.16em; color: var(--ct-muted3);
    margin-top: 4px;
  }

  /* STATUS PILL */
  .ct-status-pill {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 4px 10px;
    border: 1px solid var(--ct-border);
    background: rgba(255,255,255,0.03);
    font-family: ui-monospace,monospace;
    font-size: 8px; font-weight: 700; letter-spacing: 0.2em;
    text-transform: uppercase; color: var(--ct-muted2);
  }
  .ct-status-dot {
    display: inline-block; width: 7px; height: 7px; border-radius: 50%;
    flex-shrink: 0;
  }

  /* DIVIDER */
  .ct-divider { height: 1px; background: var(--ct-border); }

  /* FIELD */
  .ct-field { display: flex; flex-direction: column; gap: 0; }
  .ct-label {
    font-family: ui-monospace,monospace;
    font-size: 7.5px; font-weight: 700; letter-spacing: 0.26em;
    text-transform: uppercase; color: var(--ct-muted3);
    margin-bottom: 6px;
  }
  .ct-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  @media (max-width: 560px) { .ct-row-2 { grid-template-columns: 1fr; } }

  /* INPUTS */
  .ct-input, .ct-select, .ct-textarea {
    background: rgba(255,255,255,0.03);
    border: 1px solid var(--ct-border);
    color: rgba(255,255,255,0.85);
    font-family: ui-monospace,monospace;
    font-size: 11px; letter-spacing: 0.06em;
    padding: 10px 14px;
    outline: none;
    transition: border-color 120ms, background 120ms;
    width: 100%; box-sizing: border-box;
    border-radius: 0;
    appearance: none;
    -webkit-appearance: none;
  }
  .ct-input::placeholder, .ct-textarea::placeholder {
    color: var(--ct-muted3); font-size: 10px; letter-spacing: 0.08em;
  }
  .ct-select {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='rgba(167,139,250,0.5)'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    padding-right: 32px;
    cursor: pointer;
  }
  .ct-select option {
    background: #0f0f15; color: rgba(255,255,255,0.85);
  }
  .ct-textarea {
    min-height: 160px; resize: vertical;
    line-height: 1.65;
  }
  .ct-input--focused {
    border-color: rgba(124,58,237,0.5) !important;
    background: rgba(124,58,237,0.04) !important;
    box-shadow: 0 0 0 2px rgba(124,58,237,0.1);
  }
  .ct-input:hover, .ct-select:hover, .ct-textarea:hover {
    border-color: rgba(255,255,255,0.14);
  }

  /* ACTIONS */
  .ct-actions {
    display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
    margin-top: 4px;
  }
  .ct-btn-primary {
    padding: 10px 22px;
    background: rgba(124,58,237,0.15);
    border: 1px solid rgba(124,58,237,0.45);
    color: var(--ct-soft);
    font-family: ui-monospace,monospace;
    font-size: 9px; font-weight: 800; letter-spacing: 0.24em;
    text-transform: uppercase; cursor: pointer;
    transition: background 150ms, border-color 150ms;
  }
  .ct-btn-primary:hover:not(:disabled) {
    background: rgba(124,58,237,0.25);
    border-color: rgba(124,58,237,0.7);
  }
  .ct-btn-primary:disabled {
    opacity: 0.45; cursor: not-allowed;
  }
  .ct-btn-ghost {
    padding: 10px 18px;
    background: transparent;
    border: 1px solid var(--ct-border);
    color: var(--ct-muted3);
    font-family: ui-monospace,monospace;
    font-size: 9px; font-weight: 700; letter-spacing: 0.24em;
    text-transform: uppercase; cursor: pointer;
    transition: background 120ms, color 120ms;
  }
  .ct-btn-ghost:hover {
    background: rgba(255,255,255,0.04); color: var(--ct-muted2);
  }
  .ct-sent-note {
    font-family: ui-monospace,monospace;
    font-size: 8.5px; letter-spacing: 0.1em;
    color: var(--ct-green);
  }
  .ct-disclaimer {
    font-family: ui-monospace,monospace;
    font-size: 7.5px; letter-spacing: 0.18em;
    text-transform: uppercase; color: var(--ct-muted3);
    padding-top: 4px;
    border-top: 1px solid rgba(255,255,255,0.04);
  }

  /* SIDEBAR */
  .ct-sidebar {
    display: flex; flex-direction: column; gap: 14px;
  }
  .ct-sidebar-card {
    background: var(--ct-panel);
    border: 1px solid var(--ct-border);
    overflow: hidden;
  }
  .ct-sidebar-inner {
    padding: 18px 20px;
    display: flex; flex-direction: column; gap: 12px;
  }
  .ct-sidebar-title {
    font-family: ui-monospace,monospace;
    font-size: 8.5px; font-weight: 800; letter-spacing: 0.28em;
    text-transform: uppercase; color: var(--ct-soft);
  }
  .ct-sidebar-sub {
    font-family: ui-monospace,monospace;
    font-size: 8px; letter-spacing: 0.12em; color: var(--ct-muted3);
    margin-top: -6px;
  }
  .ct-checklist {
    list-style: none; padding: 0; margin: 0;
    display: flex; flex-direction: column; gap: 10px;
  }
  .ct-checklist-item {
    display: flex; align-items: flex-start; gap: 10px;
    font-family: ui-monospace,monospace;
    font-size: 9px; letter-spacing: 0.08em; line-height: 1.6;
    color: var(--ct-muted2);
  }
  .ct-checklist-dot {
    display: inline-block; width: 7px; height: 7px; border-radius: 50%;
    margin-top: 4px; flex-shrink: 0;
  }

  /* RESPONSE GRID */
  .ct-response-grid {
    display: flex; flex-direction: column; gap: 8px;
  }
  .ct-response-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 10px;
    border: 1px solid rgba(255,255,255,0.04);
    background: rgba(255,255,255,0.015);
  }
  .ct-response-type {
    display: flex; align-items: center; gap: 8px;
    font-family: ui-monospace,monospace;
    font-size: 9px; letter-spacing: 0.1em; color: var(--ct-muted2);
  }
  .ct-response-dot {
    display: inline-block; width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
  }
  .ct-response-time {
    font-family: ui-monospace,monospace;
    font-size: 9px; font-weight: 800; letter-spacing: 0.14em;
    color: rgba(255,255,255,0.75);
  }
  .ct-sidebar-note {
    font-family: ui-monospace,monospace;
    font-size: 8.5px; letter-spacing: 0.08em; line-height: 1.7;
    color: var(--ct-muted3); margin: 0;
  }

  /* EMAIL CARD */
  .ct-email-card {
    background: rgba(124,58,237,0.05);
    border: 1px solid rgba(124,58,237,0.25);
    padding: 18px 20px;
    display: flex; flex-direction: column; gap: 8px;
  }
  .ct-email-card-label {
    font-family: ui-monospace,monospace;
    font-size: 7px; font-weight: 800; letter-spacing: 0.32em;
    text-transform: uppercase; color: rgba(167,139,250,0.6);
  }
  .ct-email-addr {
    font-family: ui-monospace,monospace;
    font-size: 11px; font-weight: 700; letter-spacing: 0.06em;
    color: var(--ct-soft); text-decoration: none;
    word-break: break-all;
    transition: color 120ms;
  }
  .ct-email-addr:hover { color: #fff; }
  .ct-email-card-note {
    font-family: ui-monospace,monospace;
    font-size: 8px; letter-spacing: 0.1em; line-height: 1.65;
    color: var(--ct-muted3);
  }

  @media (prefers-reduced-motion: reduce) {
    .ct-root { animation: none !important; }
    .ct-live-dot { animation: none !important; }
  }
`;