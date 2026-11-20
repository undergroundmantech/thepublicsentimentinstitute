"use client";
import { useState } from "react";

const CSS = `
.dl { display: grid; place-items: center; padding: 56px 16px 40px; }
.dl .dl-card { width: 100%; max-width: 380px; }
.dl h1 { font-size: 26px; font-weight: 800; letter-spacing: -.03em; margin: 6px 0 16px; }
.dl label { display: grid; gap: 6px; margin-bottom: 12px; }
.dl label > span { font: 700 10.5px var(--font-m); letter-spacing: .12em; text-transform: uppercase; color: var(--mute); }
.dl input { width: 100%; padding: 11px 14px; border-radius: 10px; border: 1px solid var(--line2); background: var(--glass2); color: var(--ink); font: 500 14px var(--font-b); }
.dl input:focus-visible { outline: 2px solid var(--hi); outline-offset: 2px; }
.dl button { width: 100%; justify-content: center; padding: 12px 18px; margin-top: 4px; }
.dl button:disabled { opacity: .55; }
.dl .dl-err { margin: 12px 0 0; font-size: 13px; }
`;

export default function DeskLogin() {
  const [user, setUser] = useState(""); const [pass, setPass] = useState("");
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/desk/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user, pass }) });
      if (r.ok) { window.location.assign("/backroom/weighting"); return; }
      const b = await r.json().catch(() => ({}));
      setErr(b?.error === "not_configured" ? "Sign in is not set up on this deployment." : "That username and password do not match.");
    } catch { setErr("Could not reach the server. Try again."); } finally { setBusy(false); }
  }
  return (
    <div className="opp dl">
      <style>{CSS}</style>
      <div className="card dl-card"><div className="card-b">
        <div className="eye">On Point Polling</div>
        <h1>Sign in</h1>
        <form onSubmit={submit}>
          <label><span>Username</span><input id="dl-user" value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" autoCapitalize="none" autoCorrect="off" required disabled={busy} /></label>
          <label><span>Password</span><input id="dl-pass" type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" required disabled={busy} /></label>
          <button className="btn g" type="submit" disabled={busy}>{busy ? "Signing in" : "Sign in"}</button>
        </form>
        {err ? <p className="dl-err" role="alert">{err}</p> : null}
      </div></div>
    </div>
  );
}
