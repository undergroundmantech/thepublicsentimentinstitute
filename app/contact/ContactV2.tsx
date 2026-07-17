// app/contact/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import DarkNav from "@/app/components/DarkNav";

const CONTACT_EMAIL = "tpsinstitutecontact@gmail.com";
const LIME = "#b7ff00";

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
  { t: "Custom polls", n: "A race, a district, an issue — fielded, weighted, and delivered with the crosstabs." },
  { t: "Recurring tracks", n: "Weekly or monthly waves on the questions you need answered all cycle long." },
  { t: "Partner research", n: "Co-branded studies with campaigns, media desks, and research organizations." },
  { t: "Media & data requests", n: "Methodology questions, interview requests, and raw series access." },
];

/* ── SignalField — the contact page's own light.
   Same LED-lattice grammar as the homepage DotField, different physics:
   slow interference wavefronts in the footer strata hues (rose crown,
   violet mid, cobalt floor) wash across a dot grid, and every few
   seconds a thin lime ring — the ping — emanates from the mail line.
   Distances are precomputed per dot; per frame it's just sines. ── */
function SignalField() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    let running = true;
    let t = reduced ? 4.2 : 0;

    // wave sources in normalized space + strata anchor colors
    const SRC = [
      { x: 1.04, y: -0.10, lam: 0.34, v: 0.055, amp: 1.0 },  // rose crown — top right
      { x: 0.78, y: 0.66,  lam: 0.52, v: -0.042, amp: 0.78 }, // violet mid
      { x: -0.12, y: 1.08, lam: 0.72, v: 0.034, amp: 0.6 },   // cobalt floor — lower left
    ];
    const PING = { x: 0.16, y: 0.78, period: 6.5, width: 0.05 }; // emanates from the mail line
    const ROSE = [244, 125, 140], VIOLET = [136, 88, 244], COBALT = [86, 110, 230];

    let W = 0, H = 0, pitch = 16;
    let dots: { x: number; y: number; d0: number; d1: number; d2: number; dp: number; m: number }[] = [];

    const build = () => {
      const r = cv.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      pitch = W < 700 ? 13 : 16;
      const aspect = W / H;
      dots = [];
      for (let y = pitch / 2; y < H; y += pitch) {
        for (let x = pitch / 2; x < W; x += pitch) {
          const nx = x / W, ny = y / H;
          const dist = (sx: number, sy: number) => Math.hypot((nx - sx) * aspect, ny - sy);
          dots.push({
            x, y,
            d0: dist(SRC[0].x, SRC[0].y),
            d1: dist(SRC[1].x, SRC[1].y),
            d2: dist(SRC[2].x, SRC[2].y),
            dp: dist(PING.x, PING.y),
            // hue mix runs on the strata diagonal: rose top-right → cobalt low-left
            m: Math.max(0, Math.min(1, 0.15 + nx * 0.55 + (1 - ny) * 0.45)),
          });
        }
      }
    };
    build();
    const ro = new ResizeObserver(build);
    ro.observe(cv);

    const TAU = Math.PI * 2;
    const frame = () => {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      t += 0.016;

      const ph0 = t * SRC[0].v * TAU, ph1 = t * SRC[1].v * TAU, ph2 = t * SRC[2].v * TAU;
      // the ping — a thin expanding ring, fading as it travels
      const pp = (t % PING.period) / PING.period;
      const pingR = pp * 1.5;
      const pingA = Math.max(0, 1 - pp * 1.25);

      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        let b =
          SRC[0].amp * (0.5 + 0.5 * Math.sin((d.d0 / SRC[0].lam) * TAU - ph0)) * Math.max(0, 1 - d.d0 / 1.5) +
          SRC[1].amp * (0.5 + 0.5 * Math.sin((d.d1 / SRC[1].lam) * TAU - ph1)) * Math.max(0, 1 - d.d1 / 1.45) +
          SRC[2].amp * (0.5 + 0.5 * Math.sin((d.d2 / SRC[2].lam) * TAU - ph2)) * Math.max(0, 1 - d.d2 / 1.5);
        b = Math.min(1, b * 0.85);
        b = b * b * (3 - 2 * b); // smoothstep contrast
        const a = 0.06 + b * 0.82;

        // strata hue blend by diagonal position, brightened by the crest
        const m = d.m;
        const r = m < 0.5 ? COBALT[0] + (VIOLET[0] - COBALT[0]) * (m * 2) : VIOLET[0] + (ROSE[0] - VIOLET[0]) * ((m - 0.5) * 2);
        const g = m < 0.5 ? COBALT[1] + (VIOLET[1] - COBALT[1]) * (m * 2) : VIOLET[1] + (ROSE[1] - VIOLET[1]) * ((m - 0.5) * 2);
        const bl = m < 0.5 ? COBALT[2] + (VIOLET[2] - COBALT[2]) * (m * 2) : VIOLET[2] + (ROSE[2] - VIOLET[2]) * ((m - 0.5) * 2);

        const sz = 1.2 + b * 2.4;
        ctx.fillStyle = `rgba(${r | 0},${g | 0},${bl | 0},${a.toFixed(3)})`;
        ctx.fillRect(d.x - sz / 2, d.y - sz / 2, sz, sz);

        // lime only where it means something: the ping crest passing through
        const ringDelta = Math.abs(d.dp - pingR);
        if (ringDelta < PING.width && pingA > 0.02) {
          const la = (1 - ringDelta / PING.width) * pingA * 0.9;
          const ls = 1.4 + la * 2.2;
          ctx.fillStyle = `rgba(183,255,0,${(la * 0.85).toFixed(3)})`;
          ctx.fillRect(d.x - ls / 2, d.y - ls / 2, ls, ls);
        }
      }

      if (!reduced) raf = requestAnimationFrame(frame);
    };

    // run only while on screen
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        if (!running) { running = true; raf = requestAnimationFrame(frame); }
        else { raf = requestAnimationFrame(frame); running = true; }
      } else {
        running = false;
        cancelAnimationFrame(raf);
      }
    }, { threshold: 0.04 });
    io.observe(cv);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} className="ct-field-cv" aria-hidden="true" />;
}

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
    <div className="ct-page">
      <style>{CSS}</style>
      <div className="ct-grain" aria-hidden="true" />

      {/* ── hero — a full-viewport signal field with one ask ── */}
      <section className="ct-hero">
        <SignalField />
        <div className="ct-hero-veil" aria-hidden="true" />

        <div className="ct-shell ct-hero-in">
          <div className="ct-hero-top">
            <DarkNav />
            <div className="ct-folio">
              <span>TPSI Intake</span>
              <span>partnerships · custom fielding · media</span>
            </div>
          </div>

          <div className="ct-hero-main">
            <h1 className="ct-title">
              <span className="ct-title-line">partner</span>
              <span className="ct-title-line">with the desk<em>.</em></span>
            </h1>
            <p className="ct-lede">
              Custom surveys, recurring tracks, and partner research — scoped,
              fielded, and delivered with the crosstabs. Inquiries go directly
              to the research team.
            </p>
          </div>

          <div className="ct-hero-foot">
            <a className="ct-mail" href={`mailto:${CONTACT_EMAIL}`}>
              <span className="ct-mail-label">write to</span>
              <span className="ct-mail-addr">{CONTACT_EMAIL}</span>
              <span className="ct-mail-arw" aria-hidden="true">→</span>
            </a>
            <div className="ct-meta">
              <span><i aria-hidden="true" />replies in 24–48 hours</span>
              <em>·</em><span>fielded under the meridian coalition voter model</span>
              <em>·</em><span>crosstabs included</span>
            </div>
          </div>
        </div>
      </section>

      <div className="ct-shell">
        {/* ── the takes — one horizontal editorial band ── */}
        <section className="ct-band">
          <span className="ct-eyebrow">What the desk takes on</span>
          <div className="ct-band-grid">
            {TAKES.map((x, i) => (
              <div className="ct-take" key={x.t}>
                <span className="ct-take-idx">{String(i + 1).padStart(2, "0")}</span>
                <h3>{x.t}</h3>
                <p>{x.n}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── the intake form ── */}
        <section className="ct-intake">
          <div className="ct-intake-rail">
            <span className="ct-eyebrow">Or start it here</span>
            <h2 className="ct-intake-h">the brief takes<br /><span>two minutes.</span></h2>
            <p className="ct-intake-p">
              Name, email, and a few sentences are enough. The rest helps us
              scope the work faster.
            </p>
            <div className="ct-note">
              Prefer email? Everything the form asks fits in one message to{" "}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </div>
          </div>

          <form className="ct-form" onSubmit={onSubmit} aria-label="Project intake form">
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
                <input value={form.org} onChange={onChange("org")} placeholder="Campaign, outlet, org — optional" />
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
                <input value={form.geography} onChange={onChange("geography")} placeholder="National, a state, a district…" />
              </label>
              <label className="ct-field">
                <span>Timeline</span>
                <input value={form.timeline} onChange={onChange("timeline")} placeholder="When do you need it in the field?" />
              </label>
              <label className="ct-field ct-field-wide">
                <span>Audience</span>
                <input value={form.audience} onChange={onChange("audience")} placeholder="Likely voters? Registered? A custom universe?" />
              </label>
              <label className="ct-field ct-field-wide">
                <span>The brief<i>*</i></span>
                <textarea value={form.message} onChange={onChange("message")} rows={5} placeholder="What do you need to learn, and why now?" />
              </label>
            </div>

            <div className="ct-actions">
              <button type="submit" className="ct-send" disabled={!canSubmit || status.type === "sending"}>
                {status.type === "sending" ? "Sending…" : "Send it to the desk"}
                <i aria-hidden="true">→</i>
              </button>
              {status.type === "sent" && <span className="ct-status is-ok">Received — we’ll reply within two days.</span>}
              {status.type === "error" && <span className="ct-status is-err">{status.message}</span>}
              {status.type === "idle" && !canSubmit && <span className="ct-status">name, email, and a brief are required</span>}
            </div>
          </form>
        </section>

        <div className="ct-foot">
          <span>The Public Sentiment Institute</span>
          <span>independent polling &amp; election analysis</span>
        </div>
      </div>
    </div>
  );
}

const CSS = `
html, body { background: #050505 !important; }
body header, body footer { display: none !important; }
body main > div { max-width: none !important; padding-left: 0 !important; padding-right: 0 !important; }
body main > div > div { padding-top: 0 !important; padding-bottom: 0 !important; }

.ct-page { position: relative; min-height: 100svh; color: #f4f4ef; overflow-x: clip; background: #050505;
  font-family: var(--font-body); font-size: 15px; letter-spacing: -0.01em;
  width: 100vw; margin-left: calc(50% - 50vw); }
.ct-shell { position: relative; z-index: 2; max-width: 1180px; margin: 0 auto; padding: 0 clamp(20px, 4vw, 44px); }
.ct-page a { color: inherit; }
.ct-page h1, .ct-page h2, .ct-page h3 { text-transform: none; }

.ct-grain { position: fixed; inset: -40px; z-index: 3; pointer-events: none; opacity: 0.05; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E"); }

/* ── hero — the signal field ── */
.ct-hero { position: relative; min-height: 100svh; display: flex; overflow: hidden; }
.ct-field-cv { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0;
  -webkit-mask-image: radial-gradient(135% 110% at 72% 18%, #000 36%, transparent 82%);
  mask-image: radial-gradient(135% 110% at 72% 18%, #000 36%, transparent 82%);
  animation: ct-cv-in 1.6s ease 0.1s both; }
@keyframes ct-cv-in { from { opacity: 0; } to { opacity: 1; } }
.ct-hero-veil { position: absolute; inset: 0; z-index: 1; pointer-events: none;
  background:
    linear-gradient(180deg, rgba(5,5,5,0.42), transparent 22%),
    linear-gradient(180deg, transparent 58%, rgba(5,5,5,0.62) 88%, #050505 100%),
    radial-gradient(70% 58% at 28% 62%, rgba(5,5,5,0.55) 0%, rgba(5,5,5,0.22) 52%, transparent 78%); }

.ct-hero-in { display: flex; flex-direction: column; width: 100%; min-height: 100svh; }
.ct-hero-top { flex: 0 0 auto; }
.ct-hero-main { flex: 1 1 auto; display: flex; flex-direction: column; justify-content: center; padding: clamp(28px, 5vh, 56px) 0; }
.ct-hero-foot { flex: 0 0 auto; padding-bottom: clamp(30px, 5vh, 56px); }

.ct-folio { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding: 13px 0; margin-top: 2px;
  border-top: 1px solid rgba(255,255,255,0.14); border-bottom: 1px solid rgba(255,255,255,0.08);
  font-size: 10.5px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(244,244,239,0.4); }
.ct-folio span:first-child { color: #f4f4ef; }

.ct-title { margin: 0; color: #f4f4ef; font-weight: 460; text-transform: lowercase; letter-spacing: -0.035em; line-height: 0.88;
  font-size: clamp(58px, 11vw, 150px); animation: ct-rise 0.8s cubic-bezier(.16,1,.3,1) 0.12s both; }
.ct-title-line { display: block; }
.ct-title em { font-style: normal; color: ${LIME}; }
.ct-lede { margin: clamp(26px, 4vh, 42px) 0 0; max-width: 50ch; font-size: clamp(16px, 1.5vw, 19px); line-height: 1.6;
  color: rgba(244,244,239,0.6); animation: ct-rise 0.8s cubic-bezier(.16,1,.3,1) 0.24s both; }
@keyframes ct-rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }

.ct-mail { display: inline-flex; align-items: baseline; gap: 18px; text-decoration: none; max-width: 100%;
  animation: ct-rise 0.8s cubic-bezier(.16,1,.3,1) 0.36s both; }
.ct-mail-label { font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(244,244,239,0.38); white-space: nowrap; }
.ct-mail-addr { font-size: clamp(19px, 3vw, 36px); font-weight: 520; letter-spacing: -0.02em; color: #f4f4ef;
  border-bottom: 1px solid rgba(244,244,239,0.25); padding-bottom: 6px; transition: border-color 220ms ease, color 220ms ease; min-width: 0; overflow-wrap: anywhere; }
.ct-mail-arw { font-size: clamp(18px, 2.4vw, 26px); color: rgba(244,244,239,0.4); transition: transform 220ms ease, color 220ms ease; }
.ct-mail:hover .ct-mail-addr { border-color: ${LIME}; }
.ct-mail:hover .ct-mail-arw { transform: translateX(8px); color: ${LIME}; }

.ct-meta { display: flex; align-items: baseline; flex-wrap: wrap; gap: 10px 14px; margin-top: clamp(22px, 3.4vh, 34px);
  font-size: 11px; font-weight: 650; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(244,244,239,0.38); }
.ct-meta em { font-style: normal; color: rgba(244,244,239,0.18); }
.ct-meta i { display: inline-block; width: 6px; height: 6px; border-radius: 99px; background: ${LIME};
  box-shadow: 0 0 9px rgba(183,255,0,0.6); margin-right: 8px; vertical-align: 1px; animation: ct-pulse 2s ease-in-out infinite; }
@keyframes ct-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } }

/* ── the takes — one editorial band ── */
.ct-band { padding: clamp(64px, 11vh, 130px) 0 clamp(56px, 9vh, 110px); }
.ct-eyebrow { display: block; font-size: 11.5px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(244,244,239,0.42); }
.ct-band-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: clamp(28px, 4vw, 56px); margin-top: clamp(34px, 5vh, 54px); }
.ct-take { position: relative; padding-top: 18px; border-top: 1px solid rgba(255,255,255,0.13); }
.ct-take::before { content: ''; position: absolute; top: -1px; left: 0; width: 26px; height: 1.5px; background: ${LIME};
  transform: scaleX(0); transform-origin: left center; transition: transform 320ms cubic-bezier(.2,.8,.2,1); }
.ct-take:hover::before { transform: scaleX(1); }
.ct-take-idx { font-size: 11px; font-weight: 600; color: rgba(244,244,239,0.28); font-variant-numeric: tabular-nums; }
.ct-take h3 { margin: 12px 0 0; color: #f4f4ef; font-size: clamp(18px, 1.7vw, 22px); font-weight: 600; letter-spacing: -0.02em; line-height: 1.15; }
.ct-take p { margin: 12px 0 0; font-size: 13.5px; line-height: 1.6; color: rgba(244,244,239,0.5); }

/* ── intake ── */
.ct-intake { display: grid; grid-template-columns: minmax(280px, 5fr) minmax(0, 7fr); gap: clamp(48px, 7vw, 110px);
  padding: clamp(56px, 9vh, 110px) 0 clamp(64px, 10vh, 120px); border-top: 1px solid rgba(255,255,255,0.12); }
.ct-intake-rail { display: flex; flex-direction: column; align-items: flex-start; }
.ct-intake-h { margin: clamp(20px, 3vh, 30px) 0 0; color: #f4f4ef; font-weight: 460; text-transform: lowercase;
  letter-spacing: -0.03em; line-height: 0.96; font-size: clamp(34px, 4.2vw, 56px); }
.ct-intake-h span { color: rgba(244,244,239,0.42); }
.ct-intake-p { margin: clamp(18px, 3vh, 28px) 0 0; font-size: 15px; line-height: 1.6; color: rgba(244,244,239,0.55); max-width: 36ch; }
.ct-note { margin-top: clamp(28px, 5vh, 44px); padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.09);
  font-size: 13.5px; line-height: 1.6; color: rgba(244,244,239,0.45); max-width: 40ch; }
.ct-note a { color: rgba(244,244,239,0.8); text-decoration: underline; text-underline-offset: 4px; text-decoration-color: rgba(244,244,239,0.3); transition: text-decoration-color 200ms ease; }
.ct-note a:hover { text-decoration-color: ${LIME}; }

/* the form — hairlines, not boxes */
.ct-form { display: flex; flex-direction: column; gap: 30px; min-width: 0; }
.ct-grid { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(26px, 3.6vh, 38px) clamp(24px, 3vw, 44px); }
.ct-field { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.ct-field-wide { grid-column: 1 / -1; }
.ct-field > span { font-size: 10.5px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(244,244,239,0.42); transition: color 200ms ease; }
.ct-field > span i { font-style: normal; color: ${LIME}; margin-left: 3px; }
.ct-field:focus-within > span { color: rgba(244,244,239,0.85); }
.ct-field input, .ct-field select, .ct-field textarea {
  appearance: none; background: transparent; border: 0; border-bottom: 1px solid rgba(244,244,239,0.16); border-radius: 0;
  padding: 4px 0 11px; font: inherit; font-size: 15.5px; font-weight: 480; color: #f4f4ef; letter-spacing: -0.01em;
  transition: border-color 240ms ease; outline: none; width: 100%; }
.ct-field textarea { resize: vertical; min-height: 96px; line-height: 1.55; }
.ct-field input::placeholder, .ct-field textarea::placeholder { color: rgba(244,244,239,0.26); }
.ct-field select { color: #f4f4ef; cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23f4f4ef' stroke-opacity='0.45' fill='none'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 2px center; padding-right: 20px; }
.ct-field select option { background: #0b0b0d; color: #f4f4ef; }
.ct-field select:invalid, .ct-field select:has(option[value=""]:checked) { color: rgba(244,244,239,0.26); }
.ct-field input:focus, .ct-field select:focus, .ct-field textarea:focus { border-color: ${LIME}; }

.ct-actions { display: flex; align-items: center; gap: 22px; flex-wrap: wrap; margin-top: 4px; }
.ct-send { display: inline-flex; align-items: center; gap: 10px; padding: 15px 30px; border: 0; border-radius: 999px; cursor: pointer;
  background: ${LIME}; color: #050505; font: inherit; font-size: 15px; font-weight: 680; letter-spacing: -0.01em;
  transition: transform 220ms cubic-bezier(0.2,0.8,0.2,1), box-shadow 220ms ease, opacity 200ms ease; }
.ct-send i { font-style: normal; transition: transform 220ms ease; }
.ct-send:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 18px 44px rgba(183,255,0,0.22); }
.ct-send:hover:not(:disabled) i { transform: translateX(4px); }
.ct-send:disabled { opacity: 0.34; cursor: default; }
.ct-status { font-size: 12px; font-weight: 600; letter-spacing: 0.06em; color: rgba(244,244,239,0.36); }
.ct-status.is-ok { color: ${LIME}; }
.ct-status.is-err { color: #ef8b94; }

.ct-foot { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding: 22px 0 46px;
  border-top: 1px solid rgba(255,255,255,0.09); font-size: 10.5px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(244,244,239,0.32); }

@media (max-width: 980px) {
  .ct-band-grid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 900px) {
  .ct-intake { grid-template-columns: 1fr; gap: 56px; }
  .ct-grid { grid-template-columns: 1fr; }
}
@media (max-width: 600px) {
  .ct-band-grid { grid-template-columns: 1fr; }
  .ct-hero-main { justify-content: flex-start; padding-top: clamp(40px, 8vh, 72px); }
}
@media (prefers-reduced-motion: reduce) {
  .ct-title, .ct-lede, .ct-mail, .ct-field-cv { animation: none !important; }
}
`;
