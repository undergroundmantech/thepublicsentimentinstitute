// Feature gates. Build-time constants — Next inlines NODE_ENV/NEXT_PUBLIC_*
// at compile, so gated UI is absent from prod bundles, not just hidden.

// The Situation Room ships dark for now: visible in dev, hidden in production
// until the desk launches it. Flip it on in prod later by setting
// NEXT_PUBLIC_SITUATION_ROOM=on (Vercel env) — no code change needed.
export const SHOW_SITUATION_ROOM =
  process.env.NEXT_PUBLIC_SITUATION_ROOM === "on" || process.env.NODE_ENV !== "production";

// The Forecast desk (/forecast) is still in progress: visible in dev, hidden
// in production even once site-v2 is live. Launch it later by setting
// NEXT_PUBLIC_FORECAST=on (Vercel env) — no code change needed.
export const SHOW_FORECAST =
  process.env.NEXT_PUBLIC_FORECAST === "on" || process.env.NODE_ENV !== "production";

// The whole site-v2 redesign behind one gate. Every forked route's page.tsx
// switches between its *V1 (the live production site) and *V2 (redesign)
// body; v2-only routes (/forecast, /voterregistration, /results/race/[id])
// 404 when it is off. `npm run dev` defaults it ON (pass
// NEXT_PUBLIC_SITE_V2=off to preview the v1 site locally); builds default
// OFF until launch — set NEXT_PUBLIC_SITE_V2=on (Vercel env) and redeploy.
//
// This constant is for RENDER-TIME checks only (notFound() gates, layout).
// The forked page.tsx switchers and next.config.ts must keep the
// `process.env.NEXT_PUBLIC_SITE_V2 === "on"` check INLINE: client-bundle
// inclusion is decided from the import graph before this imported constant
// folds, so switching on SITE_V2 there would ship both site versions to
// every visitor.
export const SITE_V2 = process.env.NEXT_PUBLIC_SITE_V2 === "on";
