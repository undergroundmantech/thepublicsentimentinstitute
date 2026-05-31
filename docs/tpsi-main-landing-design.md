# TPSI Main Landing Page Design Direction

## Intent

Build the main Public Sentiment Institute landing page as an editorial product surface, not a SaaS dashboard. The reference is Eleveight structurally: open space, huge type, quiet body copy, pill buttons, sparse abstract marks, and a horizontal gallery of real work. The current direction translates that into dark mode so the supplied election artwork belongs to the page instead of sitting inside pale frames.

The translation for TPSI is: public opinion and election data shown with enough restraint that the product feels trustworthy, but enough specificity that it could only belong to a polling and forecasting institute.

## Source References

- `docs/design-assets/tpsi-landing-hero-gallery-concept.png`
- `docs/design-assets/tpsi-landing-hero-gallery-v2-concept.png`
- `docs/design-assets/tpsi-landing-midpage-concept.png`
- `docs/design-assets/tpsi-landing-footer-concept.png`
- User-provided Eleveight screenshots from May 30, 2026.

## Design Principles

1. Typography is the primary visual asset. The page should feel designed before any chart appears.
2. The homepage should show the product, not describe an abstract company.
3. White space is active. Do not fill it with chips, badges, fake metrics, or generic icon rows.
4. Use one loud accent at a time. TPSI red, blue, and purple belong inside product previews. Acid lime belongs to coverage/footer moments.
5. Cards are artifacts, not layout filler. Gallery cards represent real TPSI surfaces: polling averages, forecast ratings, live results, electoral map.
6. Motion should clarify sequence: hero settles, gallery drifts, cards respond to pointer, FAQ opens with height/opacity, footer marquee moves.
7. Avoid dark-dashboard gravity. The prior TPSI aesthetic is useful inside product previews, but the landing page itself should be pale and editorial.

## Page Structure

### Hero

Visible copy:
- H1 line 1: `Polling averages and forecasts`
- H1 line 2: `for live election results.`
- Body: `Track voter sentiment, race ratings, and election-night returns from one transparent data desk.`
- CTAs: `Polling`, `Forecasts`

Layout:
- Dark canvas with near-black page background and warm off-white typography.
- No visible nav in the first frame. The Eleveight reference uses a single mark before the headline; keep this viewport that quiet.
- Huge left-aligned H1 with generous top spacing.
- Body copy no wider than the headline block.
- Two compact rounded pill buttons. First white, second black.
- Small abstract black mark above the H1, used as visual counterweight rather than a label.
- Small black dot near the CTA row. Do not add arrow/cursor furniture here; the reference dot is cleaner.
- The product gallery must begin inside the first viewport, with enough card interior visible to prove that these are real TPSI surfaces rather than decorative tiles.
- Desktop geometry target: content column starts around 18% from the left edge in the Retina reference capture, hero mark sits near the top of the site canvas, headline begins roughly 150px below the mark, and the gallery band begins immediately after the CTA row breathing space.
- Mobile gets a slim translucent nav bar: tiny PSI mark plus compact text links. It should feel like utility chrome, not a bulky header.

### Product Gallery

Purpose:
Show what TPSI actually has before asking users to trust the brand.

Cards:
- Polling Averages: supplied dark thumbnail artwork with large white/pink type and approval trend imagery. Route to `/polling/donaldtrumpapproval`.
- Forecast: supplied dark thumbnail artwork with diverging magenta/teal model particles. Route to `/forecastratings`.
- Live Results: supplied dark thumbnail artwork with magenta/teal live map particles. Route to `/results`.

Interaction:
- Horizontal rail with slow autonomous drift.
- Let the rail begin at the viewport edge and drift immediately on desktop, creating a slight crop after load; on mobile, delay movement so the first product title stays readable.
- Cards lift, tilt, and run a restrained light sweep on hover. The product surface inside the card also responds: polling lines tighten, source pills slide, race-rating tiles step upward, live result rows shift, and electoral-map tiles move subtly.
- The gallery itself uses the supplied thumbnail images because those assets are the visual source of truth for this pass.
- Gallery cards use a white crisp small-radius frame on every item; avoid colored CSS frames around supplied thumbnail art.
- The reference card width is approximately 620 CSS px in the 2x screenshot. Do not stretch these thumbnails into oversized dashboard panels.
- Dark-mode update: supplied thumbnails sit flush with no white card barrier. The rail edges use soft side blur/fades so the images enter and leave the viewport cleanly.

### Institute Tracks

Four sparse columns:
- Polling averages
- Forecast ratings
- Live results
- Research fielding

Each has one custom abstract mark and one short factual description.

### Proof Statement

Large copy:
`A polling product should show its work, not hide it behind a dashboard skin.`

Scroll behavior:
- The proof statement is a sticky full-viewport beat.
- The proof scene is full-bleed and opaque; no previous or next section should be visible once the lettering begins.
- The statement should not fade in early from the bottom of the prior section. It begins only after the scene is pinned to the top of the viewport.
- While the section is active, the text is held in the visual center of the screen.
- Characters highlight one by one from left to right as the user scrolls.
- The text should fully resolve before the stats appear.
- After the final character is active, the statement lifts upward and rests above the proof numbers.
- The proof numbers count up underneath once the statement has resolved.
- Do not let this section become a normal static text block; the timing is the design.

Proof numbers:
- `585` approval polls in model
- `221` generic ballot polls
- `50` states in forecast map

The numbers should be oversized and quiet, not badge-like.

### Feature List And Coverage Block

Left list:
- Polling Averages
- Forecast Ratings
- Live Results
- Electoral Map
- Generic Ballot
- Gold Standard Pollsters
- Partner Research

Right block:
Acid-lime rounded rectangle titled `Coverage`, listing:
- National
- Senate
- Governor
- House
- Primaries
- Issue polls
- Custom research

Every item in the green coverage block must be a real link, with a subtle hover shift.

Mobile representation:
- The feature list becomes a compact command list with index markers, one-line labels, and a small arrow. Rows have press/focus states because mobile hover is unreliable.
- The Coverage block becomes a two-column link board inside the acid-lime panel. Links are pill-like tap targets, not a long text list.
- The section should avoid horizontal overflow and should not push the first readable feature far below the fold.

### Approach

Cards:
- Collect
- Weight
- Model
- Publish
- Explain

These may be soft cards because the reference uses them here. They should be grouped by gutters, not shadow-heavy panels.

### FAQ

Accordion rows:
- Do you run your own polls?
- How are averages weighted?
- Can campaigns request a custom poll?
- Where do live results come from?
- Can I participate in a survey?

The first row starts open. Row text should be understated and factual.

### Footer

Acid-lime band with:
- PSI mark
- Moving marquee: `Work with public sentiment * Work with public sentiment *`
- Email: `tpsinstitutecontact@gmail.com`
- Links: Polling, Forecasts, Results, Contact

## Visual Tokens

- Page background: `#050505`
- Soft surface: `#111111`
- Card surface: `#151515`
- Text: `#f4f4ef`
- Muted text: `rgba(244, 244, 239, 0.58)`
- Hairline: `rgba(255, 255, 255, 0.1)`
- Acid lime: `#b7ff00`
- TPSI red: `#e63946`
- TPSI blue: `#2563eb`
- TPSI purple: `#7c3aed`

## Motion Rules

- Hero elements load in with staggered vertical reveal and slight blur removal.
- Product gallery scrolls slowly using transform, pauses on hover.
- Cards use transform and shadow only when they represent product artifacts.
- Abstract marks may rotate or drift gently.
- FAQ expands using grid rows or max-height, not abrupt display toggles.
- Footer marquee is continuous and reduced-motion aware.

## Implementation Notes

- The landing page must neutralize the old global TPSI dark header/footer and uppercase heading styles inside `app/page.tsx`; otherwise the reference look collapses into mixed themes.
- Keep the first viewport quiet but not empty: abstract mark, H1, body, two CTA pills, dot, then the gallery. Do not add badges, news tickers, pollster logos, nav chrome, or extra furniture above the gallery.
- The gallery cards should look like built product objects, not generic CSS cards. Each card needs its own layout grammar, color world, and data hierarchy.
- Mobile is not a compressed desktop. The gallery begins with readable card titles, the footer email wraps within the viewport, and card internals can simplify before they become cramped.
- Build warnings from unrelated Recharts pages should not drive this landing page direction; keep this page self-contained unless shared chart work is explicitly requested.

## Micro-Composition Rules

- If the hero consumes the full first viewport, it fails. The gallery must show meaningful product content before the fold.
- The H1 should feel oversized but not blocky. Favor a lighter weight and tighter vertical rhythm over brute-force boldness.
- Empty right-side space should stay empty in the hero. The reference does not need a curve, blob, or secondary card.
- The CTA row needs restraint. The dot is the only cue.
- The gallery rail starts near the viewport edge rather than fully aligned to the text column, so it feels like a moving work shelf.
- Repeated sections need a separator or rhythm change before the next major idea; otherwise the page becomes a stack of text blocks.
- Product cards must expose their strongest visual object immediately. If a card's first visible area is only a heading plus empty color field, the component is not designed enough.
- Hover effects must be component-specific. A generic card lift is not enough; the internal artifact should react in a way that matches the object.

## Anti-Slop Checklist

- No hero eyebrow above the H1.
- No generic bento grid.
- No dark framed dashboard as the main homepage language.
- No fake SaaS copy like productivity, automation, or scale.
- No product surface that is unrelated to an actual TPSI route.
- No random gradients or blob/orb backgrounds.
- No repeating the same card formula for every section.
- No oversized labels inside compact controls.
- No placeholder imagery.
- No motion that exists only because animation is possible.
- No mobile text that spills outside the viewport.
