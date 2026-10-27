# Site UI audit register

Issues that were seen during feature work but are outside that work's scope. Each one is logged here and left untouched.

| # | Viewport | Component | Symptom | Cause | Status |
|---|----------|-----------|---------|-------|--------|
| 1 | 1280 px desktop | Site header / nav | Horizontal overflow: document `scrollWidth` 1430 at a 1280 px viewport. The overflowing nodes are the header `.right` cluster, `.btn.gold`, `.orb` and the ticker. | Unverified. The suspect is the fixed-width right cluster plus the ticker, which do not shrink below roughly 1430 px. | Deferred to Fable 5.1. Seen during Race History Phase 1/2 captures; not caused by the Race History component, which reports no overflow at 1280 or 390 px. |
