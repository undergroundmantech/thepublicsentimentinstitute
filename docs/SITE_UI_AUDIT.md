# Site UI audit register

Issues that were seen during feature work but are outside that work's scope. Each one is logged here and left untouched.

## Established requirements for the Fable 5.1 site-wide redesign

These are not implemented yet.

**Three appearance modes**

1. **Professional Dark**: the default.
2. **Professional Light**: fully professional and editorial.
3. **Themed**: keeps Pointy, the characters, the playful illustrations and the decorative treatments.

Requirements for all three modes:

- Professional Dark and Light remove the cartoon-style presentation: mascots, characters, playful illustrations and decorative flourishes. Changing the background color is not enough.
- The homepage gets a CTA that invites visitors to turn on Themed mode.
- The chosen appearance persists across navigation and visits.
- Every surface supports all three modes: forecasts, polling, results, Race History, navigation and `/play`.
- Chart components, including Race History, polling averages and maps, read colors from shared mode tokens. They do not use hard-coded per-page values.

**Known responsive issue:** the site header overflows horizontally at 1280 px (row 1). Fix it in the site-wide responsive redesign.

| # | Viewport | Component | Symptom | Cause | Status |
|---|----------|-----------|---------|-------|--------|
| 2 | All | Race History (forecast race pages) | Win Probability, Expected Margin and Vote Totals charts implemented. They replace "The trend" on races with published history. | n/a | Implemented. Its `.rh` tokens (currently dark plus `[data-theme="light"]`) must join the shared three-mode design system below. |
| 1 | 1280 px desktop | Site header / nav | Horizontal overflow: document `scrollWidth` 1430 at a 1280 px viewport. The overflowing nodes are the header `.right` cluster, `.btn.gold`, `.orb` and the ticker. | Unverified. The suspect is the fixed-width right cluster plus the ticker, which do not shrink below roughly 1430 px. | Deferred to Fable 5.1. Seen during Race History Phase 1/2 captures; not caused by the Race History component, which reports no overflow at 1280 or 390 px. |
