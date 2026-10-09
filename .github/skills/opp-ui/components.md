# Components

Full CSS for every class below is in `site.css` (extracted verbatim from the mock).
Full behavior JS is in `site.js`. Port them into React components; the class names
and structure should carry over one to one.

## Masthead `.top`
Sticky, `rgba(10,7,17,.72)` + `backdrop-filter: blur(18px) saturate(140%)`, 66px tall,
1px `--line` bottom border. Left: white lockup SVG at 44px. Middle: six links
`Polls · Forecast · Maps · Results · Early Vote · TPSI`. Results gets `.live` (pulsing
red dot, only when `RESULTS_LIVE` is true). Right: `.btn` Search and `.btn.gold`
The Weighting Room. Under 960px hide the nav links and Search, keep the logo and
gold button, add a hamburger.

Replaces `Navbar.tsx` NAV array:
```ts
const NAV = [
  { href: "/polls", label: "Polls" },
  { href: "/forecast", label: "Forecast" },
  { href: "/maps", label: "Maps" },
  { href: "/results", label: "Results", live: RESULTS_LIVE },
  { href: "/maps/early-vote", label: "Early Vote" },
  { href: "/tpsi", label: "TPSI" },
];
```

## Ticker `.ticker-bar`
38px bar under the masthead. Left label `36 DAYS OUT` in gold mono with a right
border. Track is a marquee (`@keyframes marquee`, 46s linear, duplicated content
so it loops seamlessly, pauses on hover). Items: `<b>OH Sen</b>Brown <i class="d">D +5.2</i>`.
Feed it from `model.json` marquee races.

## Buttons `.btn`
Pill, 9px 16px, Manrope 700 13px, `--glass2` fill, `--line2` border, lift 1px on hover.
- `.btn.g` gradient fill, no border, `--shadow-grad`. One per page.
- `.btn.gold` gold fill, dark text. Weighting Room only.
- `.btn.white` white fill, dark text. Secondary CTAs on dark bands.
- `.btn.sm` 6px 12px, 12px text.

## Card `.card`
`--glass` fill, 1px `--line`, `--r` radius. `.glass` variant adds the top highlight
and big shadow for the hero KPI stack. `.card-h` header row: 14px 18px padding,
bottom border, title `h3` 16px 700, right side `.eye` or `.pill` or `.seg`.
`.card-b` 18px padding.

## Segmented control `.seg`
Pill track at white 6%, buttons Manrope 700 12px, active is white fill with dark text.

## Pills `.pill`
11px 700 uppercase 0.08em, 4px 9px, pill radius.
`.d` `.r` `.t` `.i` tinted party backgrounds at 18%. `.live` solid red with glow animation.

## KPI tile `.kpi`
Grid `1fr auto`. Label 12.5px 600 mute, value Sora 800 34px tabular, sub line 12px,
split bar 6px (`.bar i` widths animate from 0), sparkline SVG 110x44 on the right.
`.kpi.ctrl` is the control odds tile with three `.big` numbers.

## Race row `.race`
Grid `44px 1fr auto`, 11px 18px padding, top border, hover `--glass2`.
State in mono 700, `who` with `<b>` names and a `<small>` sub line, `.mg` margin
right aligned in mono with the leader's last name below in `--mute2`.

## Results row `.res-row`
Grid `14px 1fr 64px 70px`. Color square, name (+ `.chk` green check when called),
pct mono 700, votes mono 500 mute. `.prog` 5px bar with gradient fill for expected vote.
Winner square uses the deep party shade, runners up the pale tint.

## Table `.tbl`
13px, headers 10.5px uppercase 0.1em mute, cells 10px 12px with bottom border,
`.n` cells mono right aligned. `tr.avg` is the pinned OnPoint average row with
white 5% background and bold text. Always first row.

## Story card `.story`
Card with a 16:9 `.thumb` (SVG art or mini county map), mono uppercase label bottom
left, then h3 16px, p 13px mute, meta 12px mute2. Lifts 3px on hover.

## CTA band `.band`
Two radial gradients (blue top left, red bottom right) over `--bg3`, `--line2` border,
grid `1.2fr .8fr`, gold eyebrow, Sora headline, buttons right aligned, watermark icon
at 15% opacity bottom right.

## Footer `.foot`
`rgba(17,0,25,.6)`, top border, five columns `2fr 1fr 1fr 1fr 1fr`, white lockup,
uppercase 11px column headers, 13px links in `--mute`, bottom row with copyright and legal.

## Tooltip `.tip`
Fixed, `rgba(17,0,25,.94)` + blur, `--line2` border, 10px radius, 12.5px, min width 180.
Title row bold Sora 13px, then `.row` flex space between with mono values.
Positioned 14px from the cursor, flips when near the right or bottom edge, hides on scroll.
