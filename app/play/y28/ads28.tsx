"use client";
// Campaign 2028's ads, placed the way Google asks games to place them:
//   breaks    a full screen ad at a natural pause, between weeks, between primary turns, before the returns and at
//             the end, through the AdSense Ad Placement API (H5 Games Ads). Google decides how often one actually
//             shows, using the frequency hint on the AdSense tag in the root layout.
//   rewards   an ad the player chooses to watch for something in the game, a sponsor's money drop, a free poll or a
//             rested candidate. The button only appears when Google has an ad ready.
//   units     the site's ordinary ad panel below the game frame and on the result screen, never inside the map or
//             next to the buttons the player clicks.
// Until the account is approved for H5 Games Ads, breaks and rewards quietly do nothing and the game plays as before.
import React, { useEffect, useRef, useState } from "react";
import SiteAd from "@/app/components/AdUnit";

export const SLOT = "1176653089";

type AdW = Window & { adsbygoogle?: unknown[]; adBreak?: (o: Record<string, unknown>) => void; adConfig?: (o: Record<string, unknown>) => void };
const w = () => (typeof window === "undefined" ? null : (window as AdW));
const push = (o: Record<string, unknown>) => { const x = w(); if (!x) return false; try { (x.adsbygoogle = x.adsbygoogle || []).push(o); return true; } catch { return false; } };

// the game leaves the browser's own full screen before an ad, since nothing outside the game would show over it; the
// game's frame stays up, so the screen looks the same
let leaveNative: (() => void) | null = null;
export const onLeaveNative = (fn: (() => void) | null) => { leaveNative = fn; };
let mute: ((on: boolean) => void) | null = null;
export const onMute = (fn: ((on: boolean) => void) | null) => { mute = fn; };

let configured = false;
export function adSetup() {
  if (configured || !w()) return; configured = true;
  push({ preloadAdBreaks: "on", sound: "on" });
}

let lastBreak = 0;
/** A full screen ad at a natural pause. Resolves when it is over, or right away when no ad shows. */
export function adBreak(name: string, type: "start" | "next" | "browse" = "next"): Promise<void> {
  return new Promise((done) => {
    const x = w(); if (!x) return done();
    // never two in a row: Google spaces them too, this only saves a wasted request
    if (Date.now() - lastBreak < 25_000) return done();
    adSetup(); let over = false, showing = false; const finish = () => { if (!over) { over = true; mute?.(false); done(); } };
    const ok = push({
      type, name,
      beforeAd: () => { showing = true; lastBreak = Date.now(); if (document.fullscreenElement) leaveNative?.(); mute?.(true); },
      afterAd: () => mute?.(false),
      adBreakDone: finish,
    });
    if (!ok) finish();
    setTimeout(() => { if (!showing) finish(); }, 1500); // the API answers at once when it has nothing; never hold the game
  });
}

/** An ad the player chooses to watch for a reward. ready is true once Google has one; show plays it. */
export function useReward(name: string, key: string | number) {
  const [ready, setReady] = useState(false); const show = useRef<(() => void) | null>(null); const cb = useRef<((ok: boolean) => void) | null>(null);
  useEffect(() => {
    adSetup(); setReady(false); show.current = null; let live = true;
    push({
      type: "reward", name,
      beforeAd: () => { if (document.fullscreenElement) leaveNative?.(); mute?.(true); },
      afterAd: () => mute?.(false),
      beforeReward: (fn: () => void) => { if (!live) return; show.current = fn; setReady(true); },
      adViewed: () => { cb.current?.(true); cb.current = null; },
      adDismissed: () => { cb.current?.(false); cb.current = null; },
      adBreakDone: () => { if (live) { setReady(false); show.current = null; } },
    });
    return () => { live = false; };
  }, [name, key]);
  const play = (then: (ok: boolean) => void) => { if (!show.current) return; cb.current = then; show.current(); };
  return { ready, play };
}

/** A sponsor button: watch an ad, get the reward. Hidden until an ad is ready. */
export function RewardBtn({ name, k, label, note, onReward, className }: { name: string; k: string | number; label: string; note: string; onReward: () => void; className?: string }) {
  const { ready, play } = useReward(name, k);
  if (!ready) return null;
  return <button type="button" className={className ?? "px-btn sm y28-reward"} onClick={() => play((ok) => { if (ok) onReward(); })}><small>Watch a sponsor message</small>{label}<em>{note}</em></button>;
}

/** A display ad in the site's one ad panel, the same look as every other ad on the site. */
export function AdUnit({ minH, className }: { format?: string; minH?: number; className?: string; k?: string }) {
  return <SiteAd minH={minH} className={className} />;
}

/** Wide enough for a rail ad beside the game frame with Google's 150 pixel gap from the game. */
export function useWide(min = 1480) {
  const [wide, setWide] = useState(false);
  useEffect(() => { const m = window.matchMedia(`(min-width: ${min}px)`); const f = () => setWide(m.matches); f(); m.addEventListener("change", f); return () => m.removeEventListener("change", f); }, [min]);
  return wide;
}
