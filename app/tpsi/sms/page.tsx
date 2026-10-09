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
    <div className="opp sms">
      <style>{`
        .sms .sms-benefit { display: grid; grid-template-columns: 110px 1fr; gap: 14px; padding: 14px 18px; border-top: 1px solid var(--line); }
        .sms .sms-benefit:first-child { border-top: 0; }
        .sms .sms-benefit .eye { padding-top: 3px; }
        .sms .sms-benefit b { display: block; font: 700 15px var(--font-d); }
        .sms .sms-benefit p { font-size: 14px; margin: 4px 0 0; }
        .sms .sms-foot { padding: 12px 18px; border-top: 1px solid var(--line); font-size: 12px; color: var(--mute); }
        .sms .sms-form { display: grid; gap: 14px; }
        .sms .sms-field { display: grid; gap: 6px; }
        .sms .sms-label { font: 700 10.5px var(--font-m); letter-spacing: .12em; text-transform: uppercase; color: var(--mute); }
        .sms .sms-label .req { color: var(--ink); margin-left: 3px; }
        .sms .sms-input { width: 100%; padding: 11px 14px; border-radius: 10px; border: 1px solid var(--line2); background: var(--glass2); color: var(--ink); font: 500 14px var(--font-b); outline: none; transition: border-color .15s, box-shadow .15s; -webkit-appearance: none; }
        .sms .sms-input::placeholder { color: var(--mute2); }
        .sms .sms-input:focus-visible { border-color: var(--hi); box-shadow: 0 0 0 3px rgba(var(--line-rgb),.18); outline: none; }
        .sms .sms-consent { display: grid; grid-template-columns: 18px 1fr; gap: 12px; align-items: start; padding: 14px; border-radius: 10px; border: 1px solid var(--line); background: var(--glass); cursor: pointer; transition: border-color .15s; }
        .sms .sms-consent:hover { border-color: var(--line2); }
        .sms .sms-consent:focus-visible { outline: 2px solid var(--hi); outline-offset: 2px; }
        .sms .sms-box { width: 18px; height: 18px; border-radius: 5px; border: 1px solid var(--line2); background: var(--glass2); display: grid; place-items: center; margin-top: 1px; }
        .sms .sms-box.on { background: var(--hi); border-color: var(--hi); }
        .sms .sms-box.on i { width: 8px; height: 8px; border-radius: 2px; background: var(--bg); display: block; }
        .sms .sms-consent p { font-size: 12px; line-height: 1.6; color: var(--mute); margin: 0; }
        .sms .sms-consent a { color: var(--ink); text-decoration: underline; text-underline-offset: 2px; }
        .sms .sms-error { font-size: 13px; color: var(--ink); padding: 10px 14px; border-radius: 10px; border: 1px solid var(--line2); background: var(--glass2); }
        .sms .sms-submit { width: 100%; justify-content: center; padding: 12px 18px; font-size: 14px; }
        .sms .sms-submit:focus-visible { outline: 2px solid var(--hi); outline-offset: 3px; }
        .sms .sms-done { text-align: center; display: grid; gap: 10px; justify-items: center; padding: 18px 4px; }
        .sms .sms-done .ok { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: rgba(61,220,151,.14); color: var(--win); font-weight: 800; font-size: 18px; }
        .sms .sms-done p { font-size: 14px; margin: 0; max-width: 34ch; }
        .sms .sms-legal { font-size: 11.5px; color: var(--mute2); text-align: center; margin-top: 14px; }
        .sms .sms-legal a { color: var(--mute); text-decoration: underline; text-underline-offset: 2px; }
        @media (max-width: 600px) { .sms .sms-benefit { grid-template-columns: 1fr; gap: 6px; } }
      `}</style>

      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/tpsi">TPSI</Link><span className="sep">/</span><span>SMS updates</span></nav>
      <header className="ph">
        <div className="eye g">Stay in the loop</div>
        <h1>Polling updates, <em>delivered</em></h1>
        <p className="lede">Sign up to participate in our surveys and receive important polling updates via SMS. Join thousands of Americans helping shape the national data picture, one response at a time.</p>
        <div className="pmeta"><span>Texts from <b>The Public Sentiment Institute</b></span><span>Opt out <b>Reply STOP</b></span></div>
      </header>

      <div className="layout sms-layout">
        <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
          <div className="card">
            <div className="card-h"><h3>What you will get</h3><span className="eye" style={{ marginLeft: "auto" }}>SMS program</span></div>
            <div>
              {[
                { k: "Surveys", title: "Polling surveys", desc: "Receive invitations to participate in political and market research polls, your voice counted directly." },
                { k: "Alerts", title: "Breaking data alerts", desc: "Get notified when major polling movements occur: approval swings, ballot shifts and trending results." },
                { k: "Frequency", title: "No spam, no noise", desc: "Message frequency varies. We send only what's relevant. Opt out at any time by replying STOP." },
              ].map(b => (
                <div key={b.title} className="sms-benefit">
                  <span className="eye mono">{b.k}</span>
                  <div><b>{b.title}</b><p>{b.desc}</p></div>
                </div>
              ))}
            </div>
            <div className="sms-foot">The Public Sentiment Institute · United States · info@publicsentimentinstitute.com · Standard msg &amp; data rates may apply</div>
          </div>
          <div className="grid3">
            {[
              { eyebrow: "Response method", val: "SMS / Text", sub: "Surveys delivered directly to your mobile device" },
              { eyebrow: "Opt out", val: "Anytime", sub: "Reply STOP to any message. Instant removal." },
              { eyebrow: "Data policy", val: "No sale", sub: "We do not sell, trade, or transfer your PII to third parties." },
            ].map(i => (
              <div key={i.eyebrow} className="card tile">
                <span className="eye">{i.eyebrow}</span>
                <span className="v" style={{ fontSize: 22 }}>{i.val}</span>
                <span className="s">{i.sub}</span>
              </div>
            ))}
          </div>
        </div>

        <aside className="side">
          <div className="card">
            <div className="card-h"><h3>Sign up</h3><span className="eye" style={{ marginLeft: "auto" }}>Opt out anytime</span></div>
            <div className="card-b">
              {submitted ? (
                <div className="sms-done" role="status">
                  <div className="ok" aria-hidden="true">✓</div>
                  <h3 style={{ fontSize: 20 }}>You&rsquo;re in</h3>
                  <p>
                    Thanks for signing up. Watch for a confirmation text. You'll receive polling
                    invitations and data updates from the Public Sentiment Institute.
                  </p>
                  <p style={{ fontSize: 12, color: "var(--mute)" }}>Reply STOP at any time to unsubscribe.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="sms-form" noValidate>
                  <div className="sms-field">
                    <label className="sms-label" htmlFor="sms-email">Email address<span className="req">*</span></label>
                    <input id="sms-email" type="email" className="sms-input" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
                  </div>
                  <div className="sms-field">
                    <label className="sms-label" htmlFor="sms-first">First name</label>
                    <input id="sms-first" type="text" className="sms-input" placeholder="Optional" value={firstName} onChange={e => setFirstName(e.target.value)} autoComplete="given-name" />
                  </div>
                  <div className="sms-field">
                    <label className="sms-label" htmlFor="sms-phone">Phone number</label>
                    <input id="sms-phone" type="tel" className="sms-input" placeholder="+1 (555) 000-0000" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" />
                  </div>

                  <div
                    className="sms-consent"
                    role="checkbox"
                    aria-checked={agreed}
                    tabIndex={0}
                    onClick={() => setAgreed(!agreed)}
                    onKeyDown={e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); setAgreed(!agreed); } }}
                  >
                    <span className={`sms-box${agreed ? " on" : ""}`} aria-hidden="true"><i /></span>
                    <p>
                      By submitting this form and signing up for texts, you consent to receive
                      text messages (e.g., political polling and market research/surveys) from
                      The Public Sentiment Institute at the number provided, including messages
                      sent by auto-dialer. Consent is not a condition of purchase. Msg &amp; data
                      rates may apply. Msg frequency varies. Unsubscribe at any time by replying
                      STOP or clicking the unsubscribe link (where available). Reply HELP for help.
                      See our{" "}
                      <Link href="/terms" onClick={e => e.stopPropagation()}>
                        Privacy Policy &amp; Terms
                      </Link>.
                    </p>
                  </div>

                  {error && <div className="sms-error" role="alert">{error}</div>}

                  <button type="submit" className="btn g sms-submit">Submit</button>
                </form>
              )}
              <div className="sms-legal">
                © 2025 The Public Sentiment Institute · All Rights Reserved<br />
                <Link href="/terms">Privacy Policy &amp; Terms and Conditions</Link>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
