"use client";

import React, { useMemo, useState } from "react";

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

function classNames(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-semibold uppercase tracking-wider text-white/55">
      {children}
    </label>
  );
}

function InputBase({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={classNames(
        "mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/85",
        "outline-none transition",
        "placeholder:text-white/35",
        "focus:border-white/20 focus:ring-2 focus:ring-white/10",
        "hover:border-white/15",
        className
      )}
    />
  );
}

function TextareaBase({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={classNames(
        "mt-2 min-h-[170px] w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/85",
        "outline-none transition",
        "placeholder:text-white/35",
        "focus:border-white/20 focus:ring-2 focus:ring-white/10",
        "hover:border-white/15",
        className
      )}
    />
  );
}

function StatusPill({ status }: { status: Status }) {
  if (status.type === "idle") return null;

  if (status.type === "sending") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
        <span className="h-2 w-2 animate-pulse rounded-full bg-white/60" />
        Sending…
      </span>
    );
  }

  if (status.type === "sent") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
        <span className="h-2 w-2 rounded-full" style={{ background: "var(--psi-green)" }} />
        Submitted
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
      <span className="h-2 w-2 rounded-full" style={{ background: "var(--psi-red)" }} />
      {status.message}
    </span>
  );
}

export default function ContactPage() {
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    org: "",
    topic: "",
    geography: "",
    audience: "",
    timeline: "",
    message: "",
  });

  const [status, setStatus] = useState<Status>({ type: "idle" });

  const onChange =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((s) => ({ ...s, [key]: e.target.value }));

  const canSubmit = useMemo(() => {
    return (
      form.name.trim().length > 0 &&
      form.email.trim().length > 0 &&
      (form.message.trim().length > 0 || form.topic.trim().length > 0)
    );
  }, [form]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setStatus({ type: "sending" });

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("API failed");
      setStatus({ type: "sent" });
      return;
    } catch {
      // fallback to mailto
      const subject = encodeURIComponent("Public Sentiment Institute — Project Request");
      const body = encodeURIComponent(
        `Name: ${form.name}\nEmail: ${form.email}\nOrganization: ${form.org}\n\nTopic: ${form.topic}\nGeography: ${form.geography}\nAudience: ${form.audience}\nTimeline: ${form.timeline}\n\nMessage:\n${form.message}\n`
      );

      window.location.href = `mailto:?subject=${subject}&body=${body}`;
      setStatus({ type: "sent" });
    }
  };

  return (
    <div className="space-y-10">
      {/* HEADER */}
      <header className="space-y-4 psi-animate-in">
        <h2 className="text-5xl font-semibold tracking-tight text-white/90">
          <span className="psi-gradient-text">Contact</span>
        </h2>

        <p className="max-w-3xl text-white/60">
          Request a poll, propose a partnership, or discuss recurring fielding for the Public
          Sentiment National Database.
        </p>

      </header>

      {/* CONTENT */}
      <section className="grid gap-6 lg:grid-cols-12">
        {/* FORM */}
        <form onSubmit={onSubmit} className="psi-card p-6 lg:col-span-8 psi-animate-in">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-white/90">Project request</div>
              <div className="mt-1 text-sm text-white/60">
                Share a little context and we’ll reply with next steps.
              </div>
            </div>
            <StatusPill status={status} />
          </div>

          <div className="my-5 psi-divider" />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>Name *</FieldLabel>
              <InputBase
                value={form.name}
                onChange={onChange("name")}
                required
                placeholder="Your name"
                autoComplete="name"
              />
            </div>

            <div>
              <FieldLabel>Email *</FieldLabel>
              <InputBase
                type="email"
                value={form.email}
                onChange={onChange("email")}
                required
                placeholder="you@company.com"
                autoComplete="email"
              />
            </div>
          </div>

          <div className="mt-4">
            <FieldLabel>Organization (optional)</FieldLabel>
            <InputBase
              value={form.org}
              onChange={onChange("org")}
              placeholder="Campaign, firm, nonprofit, etc."
              autoComplete="organization"
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>Topic / issue area</FieldLabel>
              <InputBase
                value={form.topic}
                onChange={onChange("topic")}
                placeholder="Approval, economy, immigration, foreign policy…"
              />
            </div>

            <div>
              <FieldLabel>Geography</FieldLabel>
              <InputBase
                value={form.geography}
                onChange={onChange("geography")}
                placeholder="National, State, district…"
              />
            </div>

            <div>
              <FieldLabel>Target audience</FieldLabel>
              <InputBase
                value={form.audience}
                onChange={onChange("audience")}
                placeholder="Adults 18+, RV, LV, primary voters…"
              />
            </div>

            <div>
              <FieldLabel>Timeline</FieldLabel>
              <InputBase
                value={form.timeline}
                onChange={onChange("timeline")}
                placeholder="Dates, urgency, recurring cadence…"
              />
            </div>
          </div>

          <div className="mt-4">
            <FieldLabel>Message *</FieldLabel>
            <TextareaBase
              value={form.message}
              onChange={onChange("message")}
              placeholder="What do you want to measure? Required demographics? Sample size? Outputs (tabs/memo)?"
              required
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={!canSubmit || status.type === "sending"}
              className={classNames(
                "psi-btn psi-btn-primary",
                "disabled:cursor-not-allowed disabled:opacity-60"
              )}
            >
              {status.type === "sending" ? "Sending…" : "Send request"}
            </button>

            <button
              type="button"
              onClick={() => {
                setForm({
                  name: "",
                  email: "",
                  org: "",
                  topic: "",
                  geography: "",
                  audience: "",
                  timeline: "",
                  message: "",
                });
                setStatus({ type: "idle" });
              }}
              className="psi-btn psi-btn-ghost"
            >
              Clear
            </button>

            {status.type === "sent" ? (
              <span className="text-sm text-white/60">
                Submitted. If no backend is configured, your email client may open.
              </span>
            ) : null}
          </div>

          <div className="mt-5 psi-mono text-xs text-white/45">
            Please avoid sending sensitive personal information. We can share secure intake options if needed.
          </div>
        </form>

        {/* SIDEBAR */}
        <aside className="space-y-4 lg:col-span-4">
          <div className="psi-card p-6 psi-animate-in">
            <div className="text-sm font-semibold text-white/90">What to include</div>
            <div className="mt-2 text-sm text-white/60">
              The fastest replies come when you include:
            </div>

            <div className="my-4 psi-divider" />

            <ul className="space-y-3 text-sm text-white/75">
              <li className="flex gap-3">
                <span className="mt-2 h-2 w-2 rounded-full" style={{ background: "var(--psi-magenta)" }} />
                <span>Target geography + audience (A18+, RV, LV, etc.)</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-2 w-2 rounded-full" style={{ background: "var(--psi-purple)" }} />
                <span>Field dates / cadence (one-time vs recurring)</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-2 w-2 rounded-full" style={{ background: "var(--psi-red)" }} />
                <span>Outputs needed (tabs, memo, toplines, trend)</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-2 w-2 rounded-full" style={{ background: "var(--psi-blue)" }} />
                <span>Any required demographics or oversamples</span>
              </li>
            </ul>
          </div>

          <div className="psi-card p-6 psi-animate-in">
            <div className="text-sm font-semibold text-white/90">Response time</div>
            <div className="mt-2 text-sm text-white/60">
              Typical response: <span className="font-semibold text-white/80">same day</span> for simple requests.
            </div>

            <div className="my-4 psi-divider" />

            <div className="text-sm text-white/70">
              For urgent timelines, include “Urgent” in your timeline field.
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
