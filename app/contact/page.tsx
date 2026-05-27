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

        {/* ── HERO ── */}
        <div className="ct-hero">
          <div className="ct-hero-left">
            <div className="ct-hero-tag">
              <span className="ct-tag-sep">—</span>
              <span>Public Sentiment Institute</span>
              <span className="ct-tag-sep">·</span>
              <span style={{ color: "#9d5cf0" }}>Intake</span>
            </div>

            <h1 className="ct-hero-headline">
              Partner<br />
              <span className="ct-headline-gold">With Us.</span>
            </h1>

            <p className="ct-hero-desc">
              Request a poll, propose a partnership, or discuss recurring fielding.
              All inquiries route directly to our research team at{" "}
              <span style={{ color: "rgba(255,255,255,0.6)" }}>{CONTACT_EMAIL}</span>.
            </p>

            <div className="ct-badge-row">
              <span className="ct-badge ct-badge-live">
                <span className="ct-live-dot" />
                Same-Day Response
              </span>
              <span className="ct-badge">Custom Fielding Available</span>
              <span className="ct-badge">National · State · District</span>
            </div>

            <div className="ct-hero-meta">
              Direct line: <span>{CONTACT_EMAIL}</span>
            </div>
          </div>

          {/* Right panel — quick stats */}
          <div className="ct-hero-right">
            {[
              { label: "Response Time", val: "Same Day" },
              { label: "Contact Team",  val: "Research" },
              { label: "Fielding",      val: "Custom" },
            ].map(({ label, val }) => (
              <div key={label} className="ct-hero-metric">
                <div className="ct-metric-eyebrow">{label}</div>
                <div className="ct-metric-num">{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── MAIN LAYOUT ── */}
        <div className="ct-layout">

          {/* ── FORM ── */}
          <form onSubmit={onSubmit} className="ct-form-panel">
            <div className="ct-panel-header">
              <div>
                <div className="ct-panel-title">Project Request</div>
                <div className="ct-panel-sub">Fields marked * are required</div>
              </div>
              <StatusPill status={status} />
            </div>

            <div className="ct-form-body">
              {/* Row 1: Name + Email */}
              <div className="ct-row-2">
                <div className="ct-field">
                  <label className="ct-label">Name *</label>
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
                  <label className="ct-label">Email *</label>
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

              {/* Org */}
              <div className="ct-field">
                <label className="ct-label">Organization</label>
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

              {/* Topic + Geography */}
              <div className="ct-row-2">
                <div className="ct-field">
                  <label className="ct-label">Topic / Issue Area</label>
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
                  <label className="ct-label">Geography</label>
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

              {/* Audience + Timeline */}
              <div className="ct-row-2">
                <div className="ct-field">
                  <label className="ct-label">Target Audience</label>
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
                  <label className="ct-label">Timeline</label>
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
                <label className="ct-label">Message *</label>
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
                  {status.type === "sending" ? "Transmitting…" : "Send Request →"}
                </button>
                <button
                  type="button"
                  className="ct-btn-outline"
                  onClick={() => { setForm(EMPTY_FORM); setStatus({ type: "idle" }); }}
                >
                  Clear
                </button>
                {status.type === "sent" && (
                  <span className="ct-sent-note">
                    ✓ Submitted — if no server is configured your email client will open.
                  </span>
                )}
              </div>

              <div className="ct-disclaimer">
                Direct send target: {CONTACT_EMAIL} · Please avoid sensitive personal information
              </div>
            </div>
          </form>

          {/* ── SIDEBAR ── */}
          <aside className="ct-sidebar">

            {/* What to include */}
            <div className="ct-sidebar-card">
              <div className="ct-panel-header">
                <div className="ct-panel-title">What to Include</div>
              </div>
              <div className="ct-sidebar-body">
                <div className="ct-sidebar-sub">Fastest replies come with full context</div>
                <ul className="ct-checklist">
                  {[
                    { color: "#5b8fd4", text: "Target geography + audience (A18+, RV, LV)" },
                    { color: "#9d5cf0", text: "Field dates / cadence (one-time vs recurring)" },
                    { color: "#d45b5b", text: "Required outputs (tabs, memo, toplines, trend)" },
                    { color: "#5b8fd4", text: "Demographics, oversamples, or special targets" },
                    { color: "#9d5cf0", text: "Budget range or sample size target" },
                  ].map(({ color, text }) => (
                    <li key={text} className="ct-checklist-item">
                      <span className="ct-checklist-dot" style={{ background: color }} />
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Response time */}
            <div className="ct-sidebar-card">
              <div className="ct-panel-header">
                <div className="ct-panel-title">Response Time</div>
              </div>
              <div className="ct-sidebar-body">
                {[
                  { type: "Simple request",  time: "Same day",  color: "#5b8fd4" },
                  { type: "Custom project",  time: "24–48 hrs", color: "#9d5cf0" },
                  { type: "Urgent (noted)",  time: "Priority",  color: "#d45b5b" },
                ].map(({ type, time, color }) => (
                  <div key={type} className="ct-response-row">
                    <div className="ct-response-type">
                      <span className="ct-response-dot" style={{ background: color }} />
                      {type}
                    </div>
                    <div className="ct-response-time" style={{ color }}>{time}</div>
                  </div>
                ))}
                <p className="ct-sidebar-note">
                  Include "URGENT" in your timeline field for expedited routing.
                  Mark media inquiries clearly.
                </p>
              </div>
            </div>

            {/* Direct email */}
            <div className="ct-email-card">
              <div className="ct-email-label">Direct Email</div>
              <a href={`mailto:${CONTACT_EMAIL}`} className="ct-email-addr">
                {CONTACT_EMAIL}
              </a>
              <div className="ct-email-note">
                Form submission routes here automatically.
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
    sending: { color: "#9d5cf0", text: "Transmitting…" },
    sent:    { color: "#5b8fd4", text: "Submitted" },
    error:   { color: "#d45b5b", text: status.type === "error" ? (status as any).message : "Error" },
  };
  const cfg = configs[status.type] ?? configs.error;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 7,
      padding: "3px 10px",
      border: `1px solid rgba(15,16,32,0.10)`,
      background: "rgba(255,255,255,0.03)",
      fontFamily: "var(--font-body), monospace",
      fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase",
      color: cfg.color,
    }}>
      <span style={{
        display: "inline-block", width: 6, height: 6, borderRadius: "50%",
        background: cfg.color, flexShrink: 0,
      }} />
      {cfg.text}
    </div>
  );
}

const CSS = `
  body { background: #f6f7fb !important; }

  .ct-root {
    max-width: 1280px;
    margin: 0 auto;
    padding: 32px 32px 80px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  @media (max-width: 768px) { .ct-root { padding: 20px 16px 60px; } }

  /* ── HERO ── */
  .ct-hero {
    display: grid;
    grid-template-columns: 1fr 260px;
    border: 1px solid rgba(15,16,32,0.10);
    background: #ffffff;
    overflow: hidden;
  }
  @media (max-width: 900px) { .ct-hero { grid-template-columns: 1fr; } }

  .ct-hero-left {
    padding: 48px 48px 40px;
    border-right: 1px solid rgba(15,16,32,0.08);
    position: relative;
    overflow: hidden;
  }
  @media (max-width: 768px) { .ct-hero-left { padding: 28px 20px; border-right: none; border-bottom: 1px solid rgba(15,16,32,0.08); } }

  .ct-hero-left::before {
    content: '';
    position: absolute; top: -60px; right: -60px;
    width: 300px; height: 300px;
    background: radial-gradient(circle, rgba(124,58,237,0.05) 0%, transparent 70%);
    pointer-events: none;
  }

  .ct-hero-tag {
    display: inline-flex; align-items: center; gap: 6px;
    font-family: var(--font-body), monospace;
    font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase;
    color: rgba(15,16,32,0.50);
    margin-bottom: 20px;
  }
  .ct-tag-sep { color: rgba(255,255,255,0.15); }

  .ct-hero-headline {
    font-family: var(--font-display), sans-serif;
    font-size: clamp(52px, 7vw, 88px);
    letter-spacing: 0.03em; line-height: 0.95; text-transform: uppercase;
    color: #fff; margin: 0 0 20px;
    position: relative; z-index: 1;
  }
  .ct-headline-gold { color: #9d5cf0; }

  .ct-hero-desc {
    font-family: var(--font-body), monospace;
    font-size: 11px; color: rgba(15,16,32,0.50);
    line-height: 1.8; max-width: 480px;
    margin-bottom: 24px; letter-spacing: 0.04em;
    position: relative; z-index: 1;
  }

  .ct-badge-row {
    display: flex; flex-wrap: wrap; gap: 8px;
    position: relative; z-index: 1;
    margin-bottom: 24px;
  }
  .ct-badge {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 10px;
    border: 1px solid rgba(15,16,32,0.10);
    background: rgba(255,255,255,0.03);
    font-family: var(--font-body), monospace;
    font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase;
    color: rgba(255,255,255,0.3);
  }
  .ct-badge-live {
    border-color: rgba(124,58,237,0.3);
    background: rgba(124,58,237,0.06);
    color: #9d5cf0;
  }
  .ct-live-dot {
    display: inline-block; width: 5px; height: 5px;
    border-radius: 50%; background: #9d5cf0;
    animation: ct-pulse 1.8s ease-in-out infinite;
    flex-shrink: 0;
  }
  @keyframes ct-pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }

  .ct-hero-meta {
    padding-top: 20px;
    border-top: 1px solid rgba(15,16,32,0.08);
    font-family: var(--font-body), monospace;
    font-size: 9px; color: rgba(255,255,255,0.2);
    letter-spacing: 0.1em; text-transform: uppercase;
    position: relative; z-index: 1;
  }
  .ct-hero-meta span { color: rgba(255,255,255,0.4); }

  /* Hero right panel */
  .ct-hero-right {
    padding: 32px 24px;
    display: flex; flex-direction: column;
    background: #0d0d0b;
  }

  .ct-hero-metric {
    padding: 20px 0;
    border-bottom: 1px solid rgba(15,16,32,0.06);
    flex: 1;
    display: flex; flex-direction: column; justify-content: center;
  }
  .ct-hero-metric:last-child { border-bottom: none; }

  .ct-metric-eyebrow {
    font-family: var(--font-body), monospace;
    font-size: 8px; letter-spacing: 0.2em; text-transform: uppercase;
    color: rgba(15,16,32,0.45); margin-bottom: 6px;
  }
  .ct-metric-num {
    font-family: var(--font-display), sans-serif;
    font-size: 36px; letter-spacing: 0.03em; text-transform: uppercase;
    line-height: 1; color: #9d5cf0;
  }

  /* ── LAYOUT ── */
  .ct-layout {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 20px;
    align-items: start;
  }
  @media (max-width: 900px) { .ct-layout { grid-template-columns: 1fr; } }

  /* ── SHARED PANEL HEADER ── */
  .ct-panel-header {
    padding: 14px 20px 12px;
    border-bottom: 1px solid rgba(15,16,32,0.08);
    display: flex; align-items: center;
    justify-content: space-between; gap: 10px;
    background: #0d0d0b;
  }
  .ct-panel-title {
    font-family: var(--font-body), monospace;
    font-size: 10px; font-weight: 500;
    letter-spacing: 0.14em; text-transform: uppercase;
    color: rgba(255,255,255,0.6);
  }
  .ct-panel-sub {
    font-family: var(--font-body), monospace;
    font-size: 8px; color: rgba(255,255,255,0.2);
    letter-spacing: 0.08em; margin-top: 3px;
  }

  /* ── FORM PANEL ── */
  .ct-form-panel {
    border: 1px solid rgba(15,16,32,0.10);
    background: #ffffff;
    overflow: hidden;
  }

  .ct-form-body {
    padding: 22px 22px 20px;
    display: flex; flex-direction: column; gap: 16px;
  }

  /* FIELDS */
  .ct-field { display: flex; flex-direction: column; gap: 0; }
  .ct-label {
    font-family: var(--font-body), monospace;
    font-size: 8px; font-weight: 500;
    letter-spacing: 0.2em; text-transform: uppercase;
    color: rgba(15,16,32,0.45);
    margin-bottom: 6px;
  }
  .ct-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  @media (max-width: 560px) { .ct-row-2 { grid-template-columns: 1fr; } }

  .ct-input, .ct-select, .ct-textarea {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(15,16,32,0.10);
    color: rgba(15,16,32,0.75);
    font-family: var(--font-body), monospace;
    font-size: 11px; letter-spacing: 0.04em;
    padding: 10px 14px;
    outline: none;
    transition: border-color 120ms, background 120ms;
    width: 100%; box-sizing: border-box;
    border-radius: 0; appearance: none; -webkit-appearance: none;
  }
  .ct-input::placeholder, .ct-textarea::placeholder {
    color: rgba(255,255,255,0.15);
    font-size: 10px; letter-spacing: 0.06em;
  }
  .ct-input:hover, .ct-select:hover, .ct-textarea:hover {
    border-color: rgba(15,16,32,0.16);
  }
  .ct-input--focused {
    border-color: rgba(124,58,237,0.45) !important;
    background: rgba(124,58,237,0.04) !important;
  }
  .ct-select {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='rgba(124,58,237,0.6)'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    padding-right: 32px; cursor: pointer;
  }
  .ct-select option { background: #ffffff; color: rgba(15,16,32,0.75); }
  .ct-textarea { min-height: 160px; resize: vertical; line-height: 1.65; }

  /* ACTIONS */
  .ct-actions {
    display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
    margin-top: 4px;
  }
  .ct-btn-primary {
    display: inline-flex; align-items: center;
    padding: 11px 22px;
    background: var(--gradient-purple);
    color: #fff;
    font-family: var(--font-numeric), monospace;
    font-size: 11px; font-weight: 700;
    letter-spacing: 0.12em; text-transform: uppercase;
    border: none; cursor: pointer;
    border-radius: var(--r-pill);
    box-shadow: var(--shadow-purple);
    transition: background 120ms, transform 80ms, box-shadow 120ms;
  }
  .ct-btn-primary:hover:not(:disabled) { background: var(--gradient-purple-soft); transform: translateY(-1px); box-shadow: 0 8px 22px rgba(124,58,237,0.32); }
  .ct-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

  .ct-btn-outline {
    display: inline-flex; align-items: center;
    padding: 10px 18px;
    background: transparent;
    color: rgba(15,16,32,0.50);
    font-family: var(--font-body), monospace;
    font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
    border: 1px solid rgba(15,16,32,0.14); cursor: pointer;
    transition: border-color 120ms, color 120ms;
  }
  .ct-btn-outline:hover { border-color: rgba(255,255,255,0.3); color: rgba(255,255,255,0.6); }

  .ct-sent-note {
    font-family: var(--font-body), monospace;
    font-size: 9px; letter-spacing: 0.1em;
    color: #5b8fd4;
  }
  .ct-disclaimer {
    font-family: var(--font-body), monospace;
    font-size: 8px; letter-spacing: 0.14em; text-transform: uppercase;
    color: rgba(15,16,32,0.14);
    padding-top: 8px;
    border-top: 1px solid rgba(15,16,32,0.05);
  }

  /* ── SIDEBAR ── */
  .ct-sidebar { display: flex; flex-direction: column; gap: 1px; background: rgba(15,16,32,0.08); border: 1px solid rgba(15,16,32,0.08); }

  .ct-sidebar-card {
    background: #ffffff;
    display: flex; flex-direction: column;
  }

  .ct-sidebar-body {
    padding: 16px 18px;
    display: flex; flex-direction: column; gap: 12px;
  }

  .ct-sidebar-sub {
    font-family: var(--font-body), monospace;
    font-size: 8px; color: rgba(255,255,255,0.2);
    letter-spacing: 0.1em;
  }

  .ct-checklist { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
  .ct-checklist-item {
    display: flex; align-items: flex-start; gap: 10px;
    font-family: var(--font-body), monospace;
    font-size: 10px; letter-spacing: 0.04em; line-height: 1.65;
    color: rgba(255,255,255,0.4);
  }
  .ct-checklist-dot {
    display: inline-block; width: 6px; height: 6px;
    border-radius: 50%; margin-top: 5px; flex-shrink: 0;
  }

  .ct-response-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid rgba(15,16,32,0.05);
  }
  .ct-response-row:last-of-type { border-bottom: none; }
  .ct-response-type {
    display: flex; align-items: center; gap: 8px;
    font-family: var(--font-body), monospace;
    font-size: 10px; letter-spacing: 0.06em;
    color: rgba(15,16,32,0.50);
  }
  .ct-response-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .ct-response-time {
    font-family: var(--font-display), sans-serif;
    font-size: 18px; letter-spacing: 0.04em; text-transform: uppercase;
  }
  .ct-sidebar-note {
    font-family: var(--font-body), monospace;
    font-size: 9px; letter-spacing: 0.06em; line-height: 1.75;
    color: rgba(255,255,255,0.2); margin: 0;
  }

  /* EMAIL CARD */
  .ct-email-card {
    background: rgba(124,58,237,0.05);
    border-top: 1px solid rgba(124,58,237,0.15);
    padding: 18px 18px;
    display: flex; flex-direction: column; gap: 6px;
  }
  .ct-email-label {
    font-family: var(--font-body), monospace;
    font-size: 8px; font-weight: 500;
    letter-spacing: 0.2em; text-transform: uppercase;
    color: rgba(124,58,237,0.5);
  }
  .ct-email-addr {
    font-family: var(--font-body), monospace;
    font-size: 11px; font-weight: 500; letter-spacing: 0.04em;
    color: #9d5cf0; text-decoration: none; word-break: break-all;
    transition: color 120ms;
  }
  .ct-email-addr:hover { color: #a855f7; }
  .ct-email-note {
    font-family: var(--font-body), monospace;
    font-size: 9px; letter-spacing: 0.08em; line-height: 1.65;
    color: rgba(255,255,255,0.2);
  }
`;