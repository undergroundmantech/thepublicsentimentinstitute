// Light rendering for phones, tablets and slower machines. The decision is made once, in <head>, before the first
// paint, and stamped on <html> as data-lite and data-phone so the CSS in app/lite.css applies from the first frame:
//   data-lite   touch screens, narrow screens, reduced motion, Data Saver, or a device with 2 GB of memory or 2 cores
//               or fewer. Drops backdrop blur, the drifting orbs, the marquee and every looping animation.
//   data-phone  screens 860px wide or less. Turns on the phone layout: the tab bar, the hiding masthead and larger
//               touch targets.
// A visitor can force either way from the console with localStorage "opp.lite" set to "1" or "0".

export const LITE_KEY = "opp.lite";

export const LITE_INIT_SCRIPT = `(function(){try{var r=document.documentElement,m=function(q){return !!(window.matchMedia&&matchMedia(q).matches)},n=navigator,o=null;try{o=localStorage.getItem("${LITE_KEY}")}catch(e){}var l=o==="1"?true:o==="0"?false:(m("(pointer: coarse)")||m("(max-width: 860px)")||m("(prefers-reduced-motion: reduce)")||!!(n.connection&&n.connection.saveData)||(n.deviceMemory||8)<=2||(n.hardwareConcurrency||8)<=2);if(l)r.setAttribute("data-lite","");if(m("(max-width: 860px)"))r.setAttribute("data-phone","")}catch(e){}})();`;

/** True when the page is in light rendering. Safe on the server, where it is false. */
export function isLite(): boolean {
  return typeof document !== "undefined" && document.documentElement.hasAttribute("data-lite");
}

/** True on a phone width screen. */
export function isPhone(): boolean {
  return typeof document !== "undefined" && document.documentElement.hasAttribute("data-phone");
}

/** Pixel ratio for canvases: full on desktop, at most 1.5 in light rendering, which is a quarter less fill work. */
export function canvasDpr(): number {
  const d = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  return Math.min(isLite() ? 1.5 : 2, d);
}

/** Minimum milliseconds between animation frames: none on desktop, about 30 frames a second in light rendering. */
export function frameGap(): number {
  return isLite() ? 33 : 0;
}
