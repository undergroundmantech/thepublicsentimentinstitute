/**
 * Resolve a CSS colour that may contain custom properties into a concrete
 * rgb()/rgba() string.
 *
 * The Canvas 2D API (fillStyle, strokeStyle, shadowColor, addColorStop) and
 * WebGL parse colours themselves and know nothing about CSS custom
 * properties, so a `var(--token)` handed to them throws or is ignored. Only
 * the CSS engine can substitute them.
 *
 * This lets a canvas keep reading the same theme tokens as the rest of the
 * page: it hands the value to a hidden element, lets the browser resolve it
 * (var() and calc() included), and reads the computed colour back. Call it at
 * draw time rather than caching, so a theme switch is picked up on the next
 * frame.
 */
let probe: HTMLSpanElement | null = null;

export function cssColor(value: string, fallback = "#888888"): string {
  if (typeof document === "undefined") return fallback;   // SSR
  if (!value || !value.includes("var(")) return value;    // already literal
  try {
    if (!probe || !probe.isConnected) {
      probe = document.createElement("span");
      probe.setAttribute("aria-hidden", "true");
      probe.style.cssText = "position:absolute;left:-9999px;top:0;width:0;height:0;pointer-events:none";
      document.body.appendChild(probe);
    }
    probe.style.color = "";
    probe.style.color = value;
    const out = getComputedStyle(probe).color;
    return out || fallback;
  } catch {
    return fallback;
  }
}
