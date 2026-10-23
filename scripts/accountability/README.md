# Accountability Index

`python3 scripts/accountability/build_index.py` reads the source files in `data/` and writes `public/accountability/index.json`, which every /accountability page reads at build time.

Source files, each read on Oct 22 2026 from public pages:

- `roster.json` current members from unitedstates/congress-legislators
- `aipac.json` TrackAIPAC Israel Lobby Total per member, plus governors, candidates and the administration in `others`
- `money.json` FEC candidate page totals, receipts and other committee contributions
- `trades.json` Quiver Quantitative last year trading table
- `aff.json` America First Foundation total grade
- `scorecards.json` LCV and Heritage Action scores
- `card_acu.json`, `card_cfg.json`, `card_ppunch.json`, `card_aflcio.json`, `card_hrc.json` CPAC, Club for Growth, ProgressivePunch, AFL-CIO and Human Rights Campaign scores, each keyed by bioguide

To refresh, replace a source file with a newer read in the same shape and rerun the script. Weights, scales and grade cutoffs sit at the top of the script; the method page reads the weights and coverage counts from the output, so update its formula text if a scale changes.
