"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const CSS = `
.pl-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;
  padding:32px 20px;background:var(--canvas);color:var(--ink);
  font-family:var(--font-body,'Geist'),system-ui,sans-serif}
.pl-card{width:100%;max-width:380px;background:var(--panel);
  border:1px solid var(--hairline);border-radius:14px;padding:30px 28px}
.pl-kicker{font-family:var(--font-numeric,'JetBrains Mono'),ui-monospace,monospace;
  font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink3)}
.pl-card h1{font-size:22px;margin:8px 0 6px;letter-spacing:-.01em}
.pl-card p.pl-deck{font-size:13px;color:var(--ink2);line-height:1.55;margin-bottom:22px}
.pl-field{display:block;margin-bottom:14px}
.pl-field span{display:block;font-family:var(--font-numeric,'JetBrains Mono'),ui-monospace,monospace;
  font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink3);margin-bottom:6px}
.pl-field input{width:100%;box-sizing:border-box;padding:10px 12px;font-size:14px;
  font-family:inherit;color:var(--ink);background:var(--panel2);
  border:1px solid var(--hairline);border-radius:8px}
.pl-field input:focus{outline:2px solid var(--ink);outline-offset:1px}
.pl-btn{width:100%;padding:11px 14px;margin-top:6px;font-family:inherit;font-size:14px;
  font-weight:600;color:var(--panel);background:var(--ink);border:none;border-radius:8px;
  cursor:pointer}
.pl-btn:disabled{opacity:.55;cursor:default}
.pl-error{margin-top:14px;font-size:12.5px;color:var(--gop);line-height:1.5}
.pl-foot{margin-top:20px;padding-top:16px;border-top:1px solid var(--hairline);
  font-size:11.5px;color:var(--ink3);line-height:1.5}
.pl-foot a{color:var(--ink2)}
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
    <div className="pl-wrap">
      <style>{CSS}</style>
      <div className="pl-card">
        <p className="pl-kicker">The Public Sentiment Institute</p>
        <h1>Portal sign in</h1>
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
          <button className="pl-btn" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {error && <p className="pl-error" role="alert">{error}</p>}

        <p className="pl-foot">
          Looking for tonight&rsquo;s results? The public board is at{" "}
          <a href="/results/tonight">/results/tonight</a>.
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
