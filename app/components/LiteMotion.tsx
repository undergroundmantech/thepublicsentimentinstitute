"use client";
// Keeps light rendering honest after the first paint. The head script in app/lib/lite.ts decides light rendering;
// this component then:
//   pauses every looping CSS animation on the page, the blinking cursors, scan lines, sheens, pulses and beams,
//     except small spinners that tell the reader something is loading. One shot entrances still play.
//   pauses any SVG that animates itself.
//   keeps data-phone in step with rotation and window resizing.
// It sweeps once the page settles and again whenever the page adds content, at most every 700 ms.
import { useEffect } from "react";
import { usePathname } from "next/navigation";

const SPINNER = /spin/i;

function sweep() {
  const root = document.documentElement;
  if (!root.hasAttribute("data-lite") || typeof document.getAnimations !== "function") return;
  for (const a of document.getAnimations()) {
    if (a.playState !== "running") continue;
    const timing = (a.effect as KeyframeEffect | null)?.getTiming?.();
    if (!timing || timing.iterations !== Infinity) continue;
    const name = (a as CSSAnimation).animationName || "";
    const el = (a.effect as KeyframeEffect | null)?.target as Element | null;
    // a figure meant to move, such as Pointy on the polling timelines, keeps moving
    if (el?.closest?.("[data-motion-ok]")) continue;
    if (SPINNER.test(name) && el) { const r = el.getBoundingClientRect(); if (r.width <= 80 && r.height <= 80) continue; }
    try { a.currentTime = 0; a.pause(); } catch { /* the animation already ended */ }
  }
  document.querySelectorAll<SVGSVGElement>("svg").forEach((s) => { if (s.querySelector("animate,animateTransform,animateMotion")) { try { s.pauseAnimations(); } catch { /* not an SVG root */ } } });
}

export default function LiteMotion() {
  const path = usePathname();
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia?.("(max-width: 860px)");
    const phone = () => { if (mq?.matches) root.setAttribute("data-phone", ""); else root.removeAttribute("data-phone"); };
    mq?.addEventListener?.("change", phone);
    // the footer groups start folded on a phone
    if (mq?.matches) document.querySelectorAll<HTMLDetailsElement>("footer details.fgrp[open]").forEach((d) => { d.open = false; });
    if (!root.hasAttribute("data-lite")) return () => mq?.removeEventListener?.("change", phone);
    let t = 0;
    const soon = () => { if (t) return; t = window.setTimeout(() => { t = 0; sweep(); }, 700); };
    const first = window.setTimeout(sweep, 400);
    const mo = new MutationObserver(soon);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    return () => { mo.disconnect(); clearTimeout(first); if (t) clearTimeout(t); mq?.removeEventListener?.("change", phone); };
  }, []);
  // a new page brings new loops
  useEffect(() => { const id = window.setTimeout(sweep, 500); return () => clearTimeout(id); }, [path]);
  return null;
}
