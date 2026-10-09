# Motion

Rule: motion runs once on load or in response to the reader. Nothing loops over
content the reader is trying to read. The only continuous animations are the
ambient orbs behind the page, the ticker marquee, and the live dot.

| Element | Effect | Timing |
|---|---|---|
| `.orb` x3 | fixed, blurred 90px circles in #064bf9, #83449c, #f9064b at 42% / 42% / 22% opacity, `drift` translate + scale | 22s ease-in-out alternate, staggered -8s and -14s |
| `.grain` | fixed dot grid, white 6%, 22px cell, masked to fade out by 70% of the viewport | static |
| `[data-count]` | count up from 0 with cubic ease out, keeps the decimal places of the target | 1400ms on load |
| `.bar i`, `.seatbar i`, `.prog i` | width from 0 to `data-w`% | 1.1 to 1.4s cubic-bezier(.2,.8,.2,1), 150ms after load |
| `.usmap path`, `.cmap path` | opacity 0 to 1 | 600ms / 500ms, per path delay 12ms / 4ms |
| `.chart .line` | stroke-dasharray 2000 draw in | 2.4s cubic-bezier(.4,0,.2,1) |
| `.chart .dot` | fade in | 600ms, 8ms per dot |
| `.chart .end` | drop shadow glow in the series color | static |
| `.nav a.live::before` | pulse ring | 1.8s infinite, only when results are live |
| `.pill.live` | box shadow glow | 2s infinite |
| `.ticker-track` | translateX 0 to -50%, content duplicated | 46s linear infinite, pauses on hover |
| `.kpi`, `.story`, `.btn` hover | translateY -1 to -3px, border to `--line2` | 150 to 200ms |
| `.race` hover | background `--glass2` | 150ms |
| Countdown | recomputed every 30s from `2026-11-03T19:00:00-05:00` | live |

`prefers-reduced-motion: reduce` disables every animation and transition and
forces map paths, chart lines and dots to their resting state.

Implementation note for Next.js: the count up, bar widths and map fade ins are
plain CSS animations plus a small `useEffect` that sets `style.width` from
`data-w` after mount. No animation library needed.
