# On Point Sketchbook Style Kit

The look from the promo, packaged for the website: paper and ink, pencil hatching, stop motion boil, film grain, static flashes, the 3D coin logo, Pointy in sketch style, slammed headlines, taped cards and hatched bars.

Everything is plain CSS and plain JS. The React files are thin wrappers for the Next.js app.

## What is in the zip

Unzip at the root of the site repo. It creates two folders and touches nothing else.

```
public/sketchbook/                 served at /sketchbook on the live site
  pencil-hatch.png                 pencil texture used by the Pointy filter
  onpoint-logo.svg                 On Point logo mark
  pointy/pointy-*.svg              idle, think, point-pointer, sit-ballot, wave-hello

onpoint-sketchbook/
  styles/sketchbook.css            every token, component and animation
  js/sketchbook.js                 runtime: filters, grain, static, reveals, coin, Pointy
  js/sketchbook.d.ts               types for TypeScript
  js/sk-maps.js                    map engine: hatched states, flat wash counties, hover ring
  js/sk-maps.d.ts                  types for TypeScript
  react/SkHatchMaps.tsx            mount once next to the page content, runs the map engine
  react/SketchProvider.tsx         mount once in app/layout.tsx
  react/Pointy.tsx                 <Pointy pose="think" />
  react/CoinLogo.tsx               <CoinLogo size={180} />
  react/NarrowHeadline.tsx         <NarrowHeadline words={['we','called','it']} />
  react/StatSlam.tsx               big counting number with a label
  react/SketchMap.tsx              the promo's map moves: outline draw in, flip sweep, lift, 3D state slab
  react/Reveal.tsx                 slam, whip, pop or flip anything in on scroll
  tools/find-hardcoded-colors.mjs  lists colors in app/ that should become tokens
  demo/index.html                  every component on one page
```

## Turn it on

One edit, in `app/layout.tsx`:

```tsx
import '../onpoint-sketchbook/styles/sketchbook.css';
import SketchProvider from '../onpoint-sketchbook/react/SketchProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="sk-paper">
        <SketchProvider tone="default">{children}</SketchProvider>
      </body>
    </html>
  );
}
```

Keep whatever is already inside your layout. Only the two imports, the `sk-paper` class and the provider wrapper are new.

The provider sets `data-sk` on the page. That remaps the site's existing variables, so `--ink`, `--mute`, `--edge`, `--glass`, `--gold`, `--pd`, `--pr` and `--grad` all switch to paper and ink without touching each page. Panels that hardcode white text on dark backgrounds will need a swap. Find them with:

```
node onpoint-sketchbook/tools/find-hardcoded-colors.mjs app
```

## Deploy

```
unzip -o OnPoint_Sketchbook_Style_Kit.zip
git add -A
git commit -m "Sketchbook style kit"
git push
```

## Two tones

Loud is the default: full grain, scanlines, static flash on every page change, strong pencil boil. Use it for the home desk, forecasts, Watchdog and social landing pages.

Pro is calmer for polling clients: light grain, no scanlines, no static flash, gentle boil. Same layout and type.

```tsx
<SketchProvider tone="pro">
```

Or scope it to one section with `data-sk-tone="pro"` on any wrapper. The demo has a button to flip between them.

## Tokens

All in section 1 of `sketchbook.css`. Change them there and the whole site follows.

| Token | Value | Use |
|---|---|---|
| `--sk-paper` | #e9e5dc | page background |
| `--sk-ink` | #141218 | text, borders, shadows |
| `--sk-purple` | #6b2fd6 | brand accent |
| `--sk-black` | dark panels | Watchdog, footers |
| `--sk-d`, `--sk-r` | Dem blue, GOP red | maps and margins |
| `--sk-d-safe` to `--sk-d-lean`, `--sk-r-safe` to `--sk-r-lean`, `--sk-tilt`, `--sk-toss` | rating ramp | map fills |
| `--sk-good`, `--sk-bad` | green, red | approve and disapprove, called right and missed |
| `--sk-font-d`, `--sk-font-b`, `--sk-font-m` | display, body, mono | fall back to the site's own fonts |
| `--sk-grain`, `--sk-scan`, `--sk-vignette`, `--sk-boil` | overlay strength | lower them for a quieter page |

## Components

Type
* `.sk-big` slammed hero headline
* `.sk-h2`, `.sk-h3`, `.sk-label` and `.sk-label.purple`
* `.sk-narrow` inside an `h2.sk-narrow-wrap` for the squeezed justified headline
* `.sk-underline` pencil underline, `.sk-circled` hand drawn circle, `.sk-strip` black tape strip
* `.sk-accent` purple word, `.sk-grad-text` logo gradient word

Surfaces
* `.sk-paper` textured paper, `.sk-grid` graph paper, `.sk-dark` black panel, `.sk-rings` notebook holes
* `.sk-card` with `.tilt-l`, `.tilt-r`, `.flat`, `.dark`
* `.sk-tape` with `.tl`, `.tr`, `.bl`, `.br` on any card
* `.sk-browser` window frame, `.sk-torn-bottom` ripped edge

Controls
* `.sk-btn`, `.sk-btn.ghost`, `.sk-btn.purple`
* `.sk-tab` and `.sk-tab.on`
* `.sk-stamp` with `.good`, `.bad`, `.ink`
* `.sk-chip` with `.d`, `.r`, `.toss`
* `.sk-bubble` speech bubble

Data
* `.sk-stat` big number with label, add `.good` or `.dark`
* `.sk-bar` hatched bar, set `style="--v:.6"` for 60 percent
* `.sk-hatch-d`, `-r`, `-toss`, `-purple`, `-good`, `-bad`, `-ink` as fills for anything
* `.sk-legend`, `.sk-table`, `.sk-check` animated checklist, `.sk-terminal`

Layout
* `.sk-nav`, `.sk-hero`, `.sk-footer`

## Motion

Add to any element. They play once when it scrolls into view.

* `data-sk-reveal="slam"` drops in hard with a static flash
* `data-sk-reveal="whip"` slides in from the side
* `data-sk-reveal="pop"`, `"flip"`, `"mask"`
* `data-sk-delay="250"` to stagger
* `data-sk-count="409"` counts up, with `data-sk-prefix="$"` and `data-sk-suffix="B"`
* `data-sk-type="text"` types it out
* `.sk-draw` on an SVG draws its lines in
* `.sk-boil` on any SVG makes its lines wobble like stop motion
* `.sk-pencil` turns any SVG into a pencil sketch

Pointy and the coin in plain HTML:

```html
<div data-sk-pointy="wave-hello" data-sk-wave style="width:190px"></div>
<div data-sk-pointy="idle" data-sk-run style="width:150px"></div>
<div data-sk-coin style="width:200px;height:200px"></div>
```

In React use `<Pointy pose="think" />` and `<CoinLogo />`.

Everything respects reduced motion. Visitors who turn animation off get the static look with no boil, grain movement or flashes.

## Maps

Fill states and counties with the hatch patterns the runtime adds to the page:

```
fill="url(#sk-h-d-safe)"   fill="url(#sk-h-r-lean)"   fill="url(#sk-h-toss)"
fill="url(#sk-h-good)"     fill="url(#sk-h-bad)"
```

Patterns exist for safe, likely and lean on both sides, plus tossup, purple, good, bad and ink. Add `class="sk-boil"` to the map's outline group for the wobble.

## Election desk

Section 10 of `sketchbook.css`. The data dense pieces for forecast, results and race pages. The demo shows all of them wired to one map.

* `.sk-tabsline` office tabs with a marker underline, put `.on` or `aria-current="page"` on the open one
* `.sk-seg` segmented switch, for States and Counties
* `.sk-desk` three column layout with two `.sk-rail` columns around the map. The left rail drops under the map on tablets and everything stacks on phones
* `.sk-score` party scoreboard, add `.d` or `.r`, and `.win` for the majority
* `.sk-race` closest race card, add `.d` or `.r`. Children: `.st` state, `.sk-tag`, `.m` margin, `.vs` matchup
* `.sk-tag` small label, with `.flip`, `.win` and `.live`
* `.sk-panel` quiet data card with a `header` row and a `.big` number
* `.sk-meter` seat bar with a majority tick: `style="--d:49;--r:51;--of:100;--at:51"`
* `.sk-tiles` and `.sk-tile` action tiles, `.sk-btn.wide` full width button
* `.sk-vs` head to head matchup card
* `.sk-chip.fine`, `.sk-chip.ink`, `.sk-chip.marker`

Line weights now come from three tokens: `--sk-line` for hero pieces, `--sk-line-2` for data cards, `--sk-line-1` for rows and chips. `--sk-marker` is the highlighter yellow, used only for seats that changed hands and for the hovered shape.

## How maps are handled

`js/sk-maps.js` reads every map on the page and tags each partisan shape with `data-sk-fill`. Section 11 of `sketchbook.css` draws from those tags. Nothing is written to `fill` or `style`, so React can re-render a map on every vote drop without a fight.

* States and other big shapes are drawn in pencil hatching, three strengths a side
* Counties, districts and any map drawn small get a flat ink wash on a five step ramp, pale for close and deep for safe. A map counts as fine grained when it has more than sixty partisan shapes, when many of them are small on screen, or when its shapes carry `.county`, `.district`, `data-fips`, `data-county` or `data-cd`
* Outlines keep one weight at every zoom: ink between states, a fine grey line between counties
* The hovered shape gets a highlighter and ink ring drawn on top of the whole map, so its border is never half hidden by a neighbor
* Candidate maps in the primaries keep their own colors

Hooks for your own map markup:

```
data-sk-nohatch            on a wrapper: leave this map's colors alone
data-sk-noring             on a wrapper: keep the site's own hover treatment
data-sk-draw="flat"        on a wrapper: force the flat wash, or "hatch" to force hatching
class="sk-off"             a state with no race this year, also data-up="0"
class="sk-flipline"        a seat that changed hands. Draw it in a group after the states so it sits on top,
                           followed by a second copy with class="sk-flipline-ink" for the dashed ink line
class="sk-sel"             the open state or county, also aria-selected="true"
class="sk-maplabel"        a state label on a paper halo
```

Put a map inside `.sk-mapstage` for the graph paper frame, with `.sk-maplegend` under it. Legend swatches are `.sk-sw` with `d3 d2 d1 t r1 r2 r3 i off flip`, and `.sk-ramp` shows the county wash.

On the home globe the hovered state is redrawn last with the same highlighter ring, labels sit on a paper halo, and the legend swatches match the pencil the globe is drawn with.

## Map moves from the promo

`react/SketchMap.tsx` gives any SVG map the commercial's look. The 2028 home and state pages already use it.

* `InkDefs` adds the wobble filter, the pencil hatch and the lift shadow to a map
* `InkOutline` draws the thick hand drawn outline that traces itself in
* `sweepDelays` makes the states or counties flip in from left to right
* `Lift` pops the hovered state or county off the page
* `Slab3D` shows one state as a floating 3D paper cutout, like the state close ups in the ad
* `useInView` holds the animation until the map scrolls into view
* `useBoil` keeps the lines wobbling like stop motion
* `usePxScale` keeps lines the same weight on a wide state like Texas and a tall one like Maine
* `HatchDefs` gives a map the eight rating hatches as patterns, the same densities as the kit's state maps
* `washColor`, `washInk` and `washStep` give counties the five step ink wash, pale for close and deep for safe
* `Lift` now draws the highlighter ring under the lifted shape

The 2028 maps draw their own fills, so they carry `data-sk-nohatch` and `data-sk-noring` to keep the site wide map engine from redrawing them a second time.

Put `sk-map-extrude` on the svg for the thick paper edge, `sk-map-flip` on the group of fills, and `sk-map-wait` or `sk-map-go` on the wrapper.

## Pointy

The Pointy files in `public/sketchbook/pointy` are the November 2026 design: the gradient P disc, two big eyes, white gloves and the red and blue sneakers. Each limb carries its own joint, so he can run, wave and blink. On the site he gets a light stop motion wobble. Pass `pencil` to the runtime for the full pencil sketch look.

## Preview

Open `onpoint-sketchbook/demo/index.html` through any local server, for example `npx serve .` from the repo root, then go to `/onpoint-sketchbook/demo/`.
