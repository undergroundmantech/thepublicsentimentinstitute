"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const CSS = `
.pl { display: grid; place-items: center; padding: 48px 0 32px; }
.pl .pl-card { width: 100%; max-width: 420px; }
.pl .pl-card h1 { font-size: clamp(28px, 4vw, 36px); font-weight: 800; letter-spacing: -.035em; margin: 8px 0 6px; }
.pl .pl-card h1 em { font-style: normal; background: var(--grad); -webkit-background-clip: text; background-clip: text; color: transparent; }
.pl .pl-deck { font-size: 14px; margin: 0 0 20px; }
.pl .pl-field { display: grid; gap: 6px; margin-bottom: 14px; }
.pl .pl-field > span { font: 700 10.5px var(--font-m); letter-spacing: .12em; text-transform: uppercase; color: var(--mute); }
.pl .pl-field input { width: 100%; padding: 11px 14px; border-radius: 10px; border: 1px solid var(--line2); background: var(--glass2); color: var(--ink); font: 500 14px var(--font-b); outline: none; transition: border-color .15s, box-shadow .15s; }
.pl .pl-field input:focus-visible { border-color: #fff; box-shadow: 0 0 0 3px rgba(255,255,255,.18); outline: none; }
.pl .pl-btn { width: 100%; justify-content: center; padding: 12px 18px; font-size: 14px; margin-top: 4px; }
.pl .pl-btn:disabled { opacity: .55; cursor: default; transform: none; }
.pl .pl-btn:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
.pl .pl-error { margin: 14px 0 0; font-size: 13px; color: var(--ink); padding: 10px 12px; border-radius: 10px; border: 1px solid var(--line2); background: var(--glass2); }
.pl .pl-foot { margin: 0; padding: 14px 18px; border-top: 1px solid var(--line); font-size: 12.5px; color: var(--mute); }
.pl .pl-foot a { color: var(--ink); text-decoration: underline; text-underline-offset: 2px; }
`;

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Confined to internal paths so a crafted ?next= cannot bounce a signed-in
  // user off-site.
  const raw = params.get("next") ?? "";
  const next = raw.startsWith("/portal/") && !raw.startsWith("//")
    ? raw
    : "/portal/florida-governor";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, pass }),
      });
      if (res.ok) {
        router.replace(next);
        router.refresh();
        return;
      }
      const body = await res.json().catch(() => ({}));
      setError(
        body?.error === "not_configured"
          ? "The portal has no credentials configured on this deployment."
          : "That username and password combination was not recognised.",
      );
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="opp pl">
      <style>{CSS}</style>
      <div className="card pl-card">
        <div className="card-h"><h3>Client portal</h3><span className="eye" style={{ marginLeft: "auto" }}>Internal</span></div>
        <div className="card-b">
          <div className="eye g">OnPoint Politics · TPSI</div>
          <h1>Sign in to the <em>portal</em></h1>
          <p className="pl-deck">
            Internal election desk. Everything behind this page is working analysis, not
            published TPSI output.
          </p>

          <form onSubmit={submit}>
            <label className="pl-field">
              <span>Username</span>
              <input value={user} onChange={(e) => setUser(e.target.value)}
                     autoComplete="username" autoCapitalize="none" autoCorrect="off"
                     required disabled={busy} />
            </label>
            <label className="pl-field">
              <span>Password</span>
              <input type="password" value={pass} onChange={(e) => setPass(e.target.value)}
                     autoComplete="current-password" required disabled={busy} />
            </label>
            <button className="btn g pl-btn" type="submit" disabled={busy}>
              {busy ? "Signing in..." : "Sign in"}
            </button>
          </form>

          {error && <p className="pl-error" role="alert">{error}</p>}
        </div>
        <p className="pl-foot">
          Looking for tonight&rsquo;s results? The public board is at{" "}
          <Link href="/results/live">/results/live</Link>.
        </p>
      </div>
    </div>
  );
}

export default function PortalLogin() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
