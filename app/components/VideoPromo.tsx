"use client";
// The pop up for the newest On Point video, with Pointy pointing at it. A card in the bottom corner on a wide screen and a
// strip above the tab bar on a phone, never over the page itself. It comes up once a reader has had a moment on the
// page, 6 seconds or a quarter of the way down, 3 seconds on the pages the video is about, and waits for any open
// dialog such as the first visit welcome. The video plays inside the card. Closing it keeps it away for two days,
// three showings at most; playing it or opening it on YouTube keeps it away for good. It is per video, so a new
// LATEST_VIDEO shows again to everyone. While it is up or after it showed this visit, the YouTube subscribe card waits.
//
// Events, all with the video id, through ev() so the site's feature flags, video-promo among them, ride along:
//   Video promo shown        why: time, scroll
//   Video promo play         from: thumb, button
//   Video promo YouTube      from: card, player
//   Video promo subscribe    from: player
//   Video promo closed       state: unplayed, playing
//   Video promo Pointy       from: bubble
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ev } from "@/app/lib/ev";
import { LATEST_VIDEO as V, videoEmbed, videoUrl } from "@/app/lib/latestVideo";
import { YT_SUB } from "@/app/lib/youtube";
import { Pointy } from "./home/Mascot";
import YouTubeIcon from "./YouTubeIcon";
import "./videopromo.css";

const KEY = `opp.vp.${V.id}`;
const SESSION = "opp.vp.session";
const SKIP = [/^\/results\/monitor/, /^\/brasil/, /^\/maps\/electoral/, /^\/embed/, /^\/on-point-polling\/portal/, /^\/swingometer\/studio/];
const day = 864e5;
type State = { until: number; shows: number; done?: boolean };
const read = (): State => { try { return { until: 0, shows: 0, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { until: 0, shows: 0 }; } };
const write = (s: State) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage off: it may show again next visit */ } };
const mark = () => { try { sessionStorage.setItem(SESSION, V.id); } catch { /* storage off */ } };

/** True while the video promo is up or has already shown this visit; the YouTube subscribe card waits on it. */
export function videoPromoActive(): boolean {
  if (typeof document === "undefined") return false;
  if (document.querySelector(".vpp")) return true;
  try { return sessionStorage.getItem(SESSION) === V.id; } catch { return false; }
}

export default function VideoPromo() {
  const path = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const shownPath = useRef(path);
  const skip = SKIP.some((r) => r.test(path));
  useEffect(() => {
    if (skip || open) return;
    const s = read();
    if (s.done || s.shows >= 3 || s.until > Date.now()) return;
    let done = false, retry = 0;
    const modal = () => !!document.querySelector('[role="dialog"][aria-modal="true"]');
    const show = (why: string) => {
      if (done) return;
      if (modal()) { window.clearTimeout(retry); retry = window.setTimeout(() => show(why), 6000); return; }
      done = true; shownPath.current = path;
      write({ ...read(), shows: read().shows + 1 }); mark();
      setOpen(true); ev("Video promo shown", { video: V.id, why }); cleanup();
    };
    const hot = V.hot.some((r) => r.test(path));
    const t = window.setTimeout(() => show("time"), hot ? 3000 : 6000);
    const onScroll = () => {
      const h = document.documentElement; const max = h.scrollHeight - h.clientHeight;
      if (max > 400 && h.scrollTop / max > 0.25) show("scroll");
    };
    const cleanup = () => { window.clearTimeout(t); window.clearTimeout(retry); window.removeEventListener("scroll", onScroll); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return cleanup;
  }, [path, skip, open]);
  if (!open || skip) return null;

  const finish = () => write({ ...read(), done: true });
  const play = (from: string) => { setPlaying(true); finish(); ev("Video promo play", { video: V.id, from }); };
  const close = () => {
    if (!read().done) write({ ...read(), until: Date.now() + 2 * day });
    setOpen(false); setPlaying(false);
    ev("Video promo closed", { video: V.id, state: playing ? "playing" : "unplayed" });
  };
  return (
    <aside className={`opp vpp${playing ? " is-playing" : ""}`} role="complementary" aria-label="New On Point video">
      <Pointy className="vpp-pty keep quip" pose="point" prop="megaphone" size={124} look={1}
        say={<button type="button" className="vpp-say" onClick={() => { play("button"); ev("Video promo Pointy", { video: V.id, from: "bubble" }); }}>{V.pointy}</button>} />
      <div className="vpp-card">
        <button type="button" className="vpp-x" onClick={close} aria-label="Close">×</button>
        {playing ? (
          <div className="vpp-player">
            <iframe src={videoEmbed(V.id)} title={V.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
          </div>
        ) : (
          <button type="button" className="vpp-thumb" onClick={() => play("thumb")} aria-label={`Play: ${V.title}`}>
            <img src={V.thumb} alt="" width={960} height={540} loading="lazy" decoding="async" />
            <span className="vpp-playbtn" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M8 5v14l11-7z" fill="currentColor" /></svg></span>
          </button>
        )}
        <div className="vpp-body">
          <span className="eye g">New video</span>
          <b className="vpp-title">{V.title}</b>
          {!playing ? <small className="vpp-hook">{V.hook}</small> : null}
          <div className="vpp-acts">
            {playing ? (
              <a className="btn g vpp-go" href={YT_SUB} target="_blank" rel="noopener" onClick={() => ev("Video promo subscribe", { video: V.id, from: "player" })}>Subscribe</a>
            ) : (
              <button type="button" className="btn g vpp-go" onClick={() => play("button")}>Watch now</button>
            )}
            <a className="vpp-yt" href={videoUrl(V.id)} target="_blank" rel="noopener" onClick={() => { finish(); ev("Video promo YouTube", { video: V.id, from: playing ? "player" : "card" }); }}>
              <YouTubeIcon size={18} />On YouTube
            </a>
          </div>
        </div>
      </div>
    </aside>
  );
}
