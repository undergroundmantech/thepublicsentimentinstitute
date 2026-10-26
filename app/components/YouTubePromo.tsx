"use client";
// A small card that invites readers to subscribe on YouTube. It slides in at the bottom corner on a wide screen and as a
// short strip above the tab bar on a phone, never over the page's content, and only once a reader has stayed a while:
// 25 seconds on the site or half way down a page. Closing it keeps it away for four days; subscribing keeps it away for
// ninety. Pages where readers record the screen or watch live returns never show it.
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ev } from "@/app/lib/ev";
import { YT_SUB } from "@/app/lib/youtube";
import YouTubeIcon from "./YouTubeIcon";
import { videoPromoActive } from "./VideoPromo";
import "./youtube.css";

const KEY = "opp.yt.until";
const SKIP = [/^\/results\/monitor/, /^\/brasil/, /^\/maps\/electoral/, /^\/embed/, /^\/on-point-polling\/portal/, /^\/swingometer\/studio/];
const day = 864e5;

function copy(path: string) {
  if (path.startsWith("/maps/early-vote")) return { t: "Early vote breakdowns on YouTube", s: "Every state's ballots read in a few minutes, and the turnout signals we're watching." };
  if (path.startsWith("/forecast") || path === "/swingometer" || path === "/what-if") return { t: "The forecast, explained on YouTube", s: "Why races move, what the polls miss, and the map, race by race." };
  if (path.startsWith("/polls")) return { t: "The polls, explained on YouTube", s: "Which polls matter, which ones lean, and what the averages say." };
  if (path.startsWith("/results")) return { t: "Election night on YouTube", s: "Calls, counties and what is still out, live on November 3." };
  return { t: "Watch On Point on YouTube", s: "Forecast breakdowns, early vote reads and election night coverage." };
}
const read = () => { try { return Number(localStorage.getItem(KEY) || 0); } catch { return 0; } };
const hold = (days: number) => { try { localStorage.setItem(KEY, String(Date.now() + days * day)); } catch { /* storage off: it shows again next visit */ } };

export default function YouTubePromo() {
  const path = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const skip = SKIP.some((r) => r.test(path));
  useEffect(() => {
    if (skip || open || read() > Date.now()) return;
    let done = false;
    let retry = 0;
    // never on top of another dialog, such as the first visit welcome: wait until it is gone, then a few seconds more
    const modal = () => !!document.querySelector('[role="dialog"][aria-modal="true"]');
    const show = (why: string) => {
      if (done) return;
      // the newest video pop up goes first: this card stays away the visit it showed
      if (videoPromoActive()) { done = true; cleanup(); return; }
      if (modal()) { window.clearTimeout(retry); retry = window.setTimeout(() => show(why), 8000); return; }
      done = true; setOpen(true); ev("YouTube promo shown", { why }); cleanup();
    };
    const t = window.setTimeout(() => show("time"), 25000);
    const onScroll = () => {
      const h = document.documentElement; const max = h.scrollHeight - h.clientHeight;
      if (max > 600 && h.scrollTop / max > 0.5) show("scroll");
    };
    const cleanup = () => { window.clearTimeout(t); window.clearTimeout(retry); window.removeEventListener("scroll", onScroll); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return cleanup;
  }, [path, skip, open]);
  if (!open || skip) return null;
  const c = copy(path);
  const close = () => { hold(4); setOpen(false); ev("YouTube promo closed", { from: "card" }); };
  return (
    <aside className="ytp" role="complementary" aria-label="On Point on YouTube">
      <a className="ytp-go" href={YT_SUB} target="_blank" rel="noopener" onClick={() => { hold(90); setOpen(false); ev("YouTube subscribe", { from: "card" }); }}>
        <YouTubeIcon size={34} />
        <span className="ytp-t"><b>{c.t}</b><small>{c.s}</small></span>
        <span className="ytp-b">Subscribe</span>
      </a>
      <button type="button" className="ytp-x" onClick={close} aria-label="Close">×</button>
    </aside>
  );
}
