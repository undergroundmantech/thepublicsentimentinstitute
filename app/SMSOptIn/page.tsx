"use client";

import Link from "next/link";
import { useState } from "react";

export default function SmsOptInPage() {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) { setError("Email address is required."); return; }
    if (!agreed) { setError("You must consent to receive SMS messages."); return; }
    setError("");
    setSubmitted(true);
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap');

        body { background: #0a0a08 !important; margin: 0; }

        .sms-wrap {
          max-width: 1280px;
          margin: 0 auto;
          padding: 32px 32px 80px;
        }
        @media(max-width: 768px) { .sms-wrap { padding: 20px 16px 60px; } }

        /* ── Breadcrumb ── */
        .sms-breadcrumb {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.25);
          margin-bottom: 32px;
        }
        .sms-breadcrumb a {
          color: rgba(255,255,255,0.25);
          text-decoration: none;
          transition: color 100ms;
        }
        .sms-breadcrumb a:hover { color: #c5a55a; }
        .sms-breadcrumb-sep { color: rgba(255,255,255,0.1); }

        /* ── Layout ── */
        .sms-layout {
          display: grid;
          grid-template-columns: 1fr 400px;
          gap: 20px;
          align-items: start;
        }
        @media(max-width: 960px) { .sms-layout { grid-template-columns: 1fr; } }

        /* ── Left: Hero copy ── */
        .sms-hero {
          border: 1px solid rgba(255,255,255,0.08);
          background: #0f0f0d;
          padding: 52px 52px 44px;
          position: relative;
          overflow: hidden;
        }
        @media(max-width: 768px) { .sms-hero { padding: 28px 20px; } }

        .sms-hero::before {
          content: '';
          position: absolute;
          top: -80px; right: -80px;
          width: 320px; height: 320px;
          background: radial-gradient(circle, rgba(197,165,90,0.07) 0%, transparent 70%);
          pointer-events: none;
        }

        .sms-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #c5a55a;
          margin-bottom: 20px;
        }
        .sms-eyebrow-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #c5a55a;
          animation: sms-pulse 1.8s ease-in-out infinite;
        }
        @keyframes sms-pulse { 0%,100%{opacity:1} 50%{opacity:0.2} }

        .sms-headline {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(48px, 6vw, 80px);
          letter-spacing: 0.03em;
          line-height: 0.95;
          color: #fff;
          margin-bottom: 24px;
          position: relative;
          z-index: 1;
        }
        .sms-headline .accent { color: #c5a55a; }

        .sms-desc {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          color: rgba(255,255,255,0.35);
          line-height: 1.85;
          max-width: 500px;
          letter-spacing: 0.04em;
          margin-bottom: 36px;
          position: relative;
          z-index: 1;
        }

        /* ── Benefits list ── */
        .sms-benefits {
          display: flex;
          flex-direction: column;
          gap: 0;
          border: 1px solid rgba(255,255,255,0.06);
          position: relative;
          z-index: 1;
        }

        .sms-benefit {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .sms-benefit:last-child { border-bottom: none; }

        .sms-benefit-icon {
          width: 28px;
          height: 28px;
          border: 1px solid rgba(197,165,90,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 12px;
          color: #c5a55a;
          background: rgba(197,165,90,0.05);
        }

        .sms-benefit-title {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.65);
          margin-bottom: 3px;
        }

        .sms-benefit-desc {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          color: rgba(255,255,255,0.25);
          line-height: 1.65;
          letter-spacing: 0.03em;
        }

        .sms-footnote {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid rgba(255,255,255,0.06);
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          color: rgba(255,255,255,0.18);
          letter-spacing: 0.08em;
          line-height: 1.75;
          position: relative;
          z-index: 1;
        }

        /* ── Right: Form ── */
        .sms-form-panel {
          border: 1px solid rgba(255,255,255,0.08);
          background: #0d0d0b;
          display: flex;
          flex-direction: column;
        }

        .sms-form-header {
          padding: 22px 28px 18px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: #0f0f0d;
        }

        .sms-form-title {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.6);
          margin-bottom: 4px;
        }

        .sms-form-sub {
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          color: rgba(255,255,255,0.2);
          letter-spacing: 0.06em;
        }

        .sms-form-body {
          padding: 24px 28px 28px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .sms-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .sms-label {
          font-family: 'DM Mono', monospace;
          font-size: 8px;
          font-weight: 500;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.3);
        }
        .sms-label .required { color: #c5a55a; margin-left: 2px; }

        .sms-input {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          padding: 10px 14px;
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          color: rgba(255,255,255,0.75);
          letter-spacing: 0.04em;
          outline: none;
          transition: border-color 120ms;
          width: 100%;
          box-sizing: border-box;
          border-radius: 0;
          -webkit-appearance: none;
        }
        .sms-input::placeholder { color: rgba(255,255,255,0.18); }
        .sms-input:focus { border-color: rgba(197,165,90,0.5); background: rgba(255,255,255,0.06); }

        /* ── Consent checkbox ── */
        .sms-consent {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          padding: 16px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.07);
          cursor: pointer;
          transition: background 100ms;
        }
        .sms-consent:hover { background: rgba(255,255,255,0.04); }

        .sms-checkbox {
          width: 14px;
          height: 14px;
          border: 1px solid rgba(255,255,255,0.2);
          background: rgba(255,255,255,0.04);
          flex-shrink: 0;
          margin-top: 1px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: border-color 100ms, background 100ms;
          cursor: pointer;
        }
        .sms-checkbox.checked {
          border-color: #c5a55a;
          background: rgba(197,165,90,0.15);
        }
        .sms-checkbox-mark {
          width: 6px;
          height: 6px;
          background: #c5a55a;
          display: none;
        }
        .sms-checkbox.checked .sms-checkbox-mark { display: block; }

        .sms-consent-text {
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          color: rgba(255,255,255,0.25);
          line-height: 1.75;
          letter-spacing: 0.03em;
        }
        .sms-consent-text a {
          color: #c5a55a;
          text-decoration: none;
        }
        .sms-consent-text a:hover { text-decoration: underline; }

        /* ── Error ── */
        .sms-error {
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          letter-spacing: 0.1em;
          color: #e05a4a;
          padding: 10px 14px;
          border: 1px solid rgba(224,90,74,0.25);
          background: rgba(224,90,74,0.06);
        }

        /* ── Submit ── */
        .sms-submit {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 13px 22px;
          background: #c5a55a;
          color: #0a0a08;
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          border: none;
          cursor: pointer;
          transition: background 120ms, transform 80ms;
          width: 100%;
        }
        .sms-submit:hover { background: #d4b46a; transform: translateY(-1px); }
        .sms-submit:active { transform: translateY(0); }

        .sms-form-footer {
          padding: 14px 28px 18px;
          border-top: 1px solid rgba(255,255,255,0.05);
          font-family: 'DM Mono', monospace;
          font-size: 8px;
          color: rgba(255,255,255,0.15);
          letter-spacing: 0.1em;
          line-height: 1.7;
          text-align: center;
        }
        .sms-form-footer a {
          color: rgba(255,255,255,0.3);
          text-decoration: none;
        }
        .sms-form-footer a:hover { color: #c5a55a; }

        /* ── Success state ── */
        .sms-success {
          padding: 40px 28px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 16px;
        }

        .sms-success-icon {
          width: 48px; height: 48px;
          border: 1px solid rgba(197,165,90,0.4);
          background: rgba(197,165,90,0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          color: #c5a55a;
          margin-bottom: 8px;
        }

        .sms-success-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 32px;
          letter-spacing: 0.05em;
          color: #c5a55a;
          line-height: 1;
        }

        .sms-success-text {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          color: rgba(255,255,255,0.3);
          line-height: 1.8;
          letter-spacing: 0.04em;
          max-width: 280px;
        }

        /* ── Info strip ── */
        .sms-info-strip {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.06);
          margin-top: 20px;
        }
        @media(max-width: 768px) { .sms-info-strip { grid-template-columns: 1fr; } }

        .sms-info-item {
          background: #0f0f0d;
          padding: 20px 22px;
        }

        .sms-info-eyebrow {
          font-family: 'DM Mono', monospace;
          font-size: 8px;
          font-weight: 500;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.2);
          margin-bottom: 6px;
        }

        .sms-info-val {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 22px;
          letter-spacing: 0.04em;
          color: #c5a55a;
          line-height: 1;
          margin-bottom: 4px;
        }

        .sms-info-sub {
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          color: rgba(255,255,255,0.2);
          letter-spacing: 0.04em;
          line-height: 1.5;
        }
      `}</style>

      <div className="sms-wrap">

        {/* Breadcrumb */}
        <div className="sms-breadcrumb">
          <Link href="/">PSI</Link>
          <span className="sms-breadcrumb-sep">—</span>
          <span>SMS Sign-Up</span>
        </div>

        <div className="sms-layout">

          {/* ── Left: Hero ── */}
          <div className="sms-hero">
            <div className="sms-eyebrow">
              <span className="sms-eyebrow-dot" />
              Stay in the Loop
            </div>

            <h1 className="sms-headline">
              Polling<br />
              Updates<br />
              <span className="accent">Delivered.</span>
            </h1>

            <p className="sms-desc">
              Sign up to participate in our surveys and receive important polling updates
              via SMS. Join thousands of Americans helping shape the national data picture
              — one response at a time.
            </p>

            <div className="sms-benefits">
              {[
                {
                  icon: "◈",
                  title: "Polling Surveys",
                  desc: "Receive invitations to participate in political and market research polls — your voice counted directly.",
                },
                {
                  icon: "◉",
                  title: "Breaking Data Alerts",
                  desc: "Get notified when major polling movements occur — approval swings, ballot shifts, and trending results.",
                },
                {
                  icon: "◎",
                  title: "No Spam, No Noise",
                  desc: "Message frequency varies. We send only what's relevant. Opt out at any time by replying STOP.",
                },
              ].map(b => (
                <div key={b.title} className="sms-benefit">
                  <div className="sms-benefit-icon">{b.icon}</div>
                  <div>
                    <div className="sms-benefit-title">{b.title}</div>
                    <div className="sms-benefit-desc">{b.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="sms-footnote">
              The Public Sentiment Institute · United States<br />
              info@publicsentimentinstitute.com · Standard msg &amp; data rates may apply
            </div>
          </div>

          {/* ── Right: Form ── */}
          <div className="sms-form-panel">
            <div className="sms-form-header">
              <div className="sms-form-title">Sign Up</div>
              <div className="sms-form-sub">Secure · No spam · Opt-out anytime</div>
            </div>

            {submitted ? (
              <div className="sms-success">
                <div className="sms-success-icon">✓</div>
                <div className="sms-success-title">You're In</div>
             
                <p className="sms-success-text">
                  Thanks for signing up. Watch for a confirmation text. You'll receive polling
                  invitations and data updates from the Public Sentiment Institute.
                </p>
                <p className="sms-success-text" style={{ color: "rgba(255,255,255,0.18)", fontSize: 9 }}>
                  Reply STOP at any time to unsubscribe.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="sms-form-body">
                <div className="sms-field">
                  <label className="sms-label">
                    Email Address<span className="required">*</span>
                  </label>
                  <input
                    type="email"
                    className="sms-input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>

                <div className="sms-field">
                  <label className="sms-label">First Name</label>
                  <input
                    type="text"
                    className="sms-input"
                    placeholder="Optional"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                  />
                </div>

                <div className="sms-field">
                  <label className="sms-label">Phone Number</label>
                  <input
                    type="tel"
                    className="sms-input"
                    placeholder="+1 (555) 000-0000"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                  />
                </div>

                <div
                  className="sms-consent"
                  onClick={() => setAgreed(!agreed)}
                >
                  <div className={`sms-checkbox${agreed ? " checked" : ""}`}>
                    <div className="sms-checkbox-mark" />
                  </div>
                  <p className="sms-consent-text">
                    By submitting this form and signing up for texts, you consent to receive
                    text messages (e.g., political polling and market research/surveys) from
                    The Public Sentiment Institute at the number provided, including messages
                    sent by auto-dialer. Consent is not a condition of purchase. Msg &amp; data
                    rates may apply. Msg frequency varies. Unsubscribe at any time by replying
                    STOP or clicking the unsubscribe link (where available). Reply HELP for help.
                    See our{" "}
                    <Link href="/TermsAndConditions" onClick={e => e.stopPropagation()}>
                      Privacy Policy &amp; Terms
                    </Link>.
                  </p>
                </div>

                {error && <div className="sms-error">{error}</div>}

                <button type="submit" className="sms-submit">
                  Submit →
                </button>
              </form>
            )}

            <div className="sms-form-footer">
              © 2025 The Public Sentiment Institute · All Rights Reserved<br />
              <Link href="/terms">Privacy Policy &amp; Terms and Conditions</Link>
            </div>
          </div>
        </div>

        {/* ── Info strip ── */}
        <div className="sms-info-strip">
          {[
            { eyebrow: "Response Method", val: "SMS / Text", sub: "Surveys delivered directly to your mobile device" },
            { eyebrow: "Opt-Out", val: "Anytime", sub: "Reply STOP to any message. Instant removal." },
            { eyebrow: "Data Policy", val: "No Sale", sub: "We do not sell, trade, or transfer your PII to third parties." },
          ].map(i => (
            <div key={i.eyebrow} className="sms-info-item">
              <div className="sms-info-eyebrow">{i.eyebrow}</div>
              <div className="sms-info-val">{i.val}</div>
              <div className="sms-info-sub">{i.sub}</div>
            </div>
          ))}
        </div>

      </div>
    </>
  );
}