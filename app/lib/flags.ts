// Feature gates. Build-time constants — Next inlines NODE_ENV/NEXT_PUBLIC_*
// at compile, so gated UI is absent from prod bundles, not just hidden.

// The Situation Room ships dark for now: visible in dev, hidden in production
// until the desk launches it. Flip it on in prod later by setting
// NEXT_PUBLIC_SITUATION_ROOM=on (Vercel env) — no code change needed.
export const SHOW_SITUATION_ROOM =
  process.env.NEXT_PUBLIC_SITUATION_ROOM === "on" || process.env.NODE_ENV !== "production";
