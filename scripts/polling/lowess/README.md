# PSI LOWESS trend lines: Python reference and backtest

The site computes the trend lines in `app/polling/lib/lowessTrend.ts` and draws them with
`app/polling/lib/TrendPanel.tsx` on the Polling Averages page. This folder holds the Python
reference implementation and the backtest behind the Election Day projection.

| File | What it is |
|---|---|
| `lowess.py` | Robust LOWESS, a line for line match of statsmodels' `lowess(frac, it=3, delta=0)` |
| `series.py` | One aggregate's polls turned into the smoother's input: field midpoints, margins, and published averages left out |
| `dump_polls.ts` | Exports every aggregate's polls from the site to JSON |
| `polls_snapshot_2026-09-28.json` | That export on Sept 28, 2026: 82 aggregates, 2,543 polls |
| `backtest.py` | Scores projection rules against the later polling, and on the 2024 and 2025 races whose polling ran to Election Day |
| `backtest_slope.py` | The same cut points with the recent slope carried forward, which made every horizon worse |

Refresh the snapshot from the repository root:

```bash
npx esbuild scripts/polling/lowess/dump_polls.ts --bundle --platform=node --format=cjs \
  --outfile=/tmp/dump.cjs --alias:@=. --external:react --external:react-dom --external:next \
  --external:'next/*' --loader:.tsx=tsx --jsx=automatic
node /tmp/dump.cjs > scripts/polling/lowess/polls.json
```

The backtest scripts read `polls.json` from the working directory.

## Checks

- **Python against statsmodels:** matches to within 0.002 of a point on every aggregate.
- **Site TypeScript against statsmodels:** matches to 1e-14 on random tests. All 144 current
  trend values on the site match exactly.

## Findings the site uses

**Cut points.** 1,018 across 31 aggregates. Each projection is scored against the median of
the real polls taken within a week of the target date.

**Mean miss by rule and horizon, in points:**

| Rule | 14 days | 28 days | 42 days |
|---|---|---|---|
| Latest single poll | 4.30 | 4.64 | 4.74 |
| Recent trend, 0.30 | 2.47 | 2.69 | 2.82 |
| Balanced trend, 0.45 | 2.39 | 2.66 | 2.84 |
| Long-term trend, 0.60 | 2.32 | 2.56 | 2.70 |

**Leave one race out:**

| Rule | Mean miss |
|---|---|
| 0.40 recent + 0.60 long-term, used on the site | 2.62 |
| Long-term trend alone | 2.63 |
| Blend refit in each fold | 2.65 |
| Equal thirds | 2.66 |

Every blend from 20/80 to 40/60 lands within 0.03 points of the others.

**Carrying the balanced slope forward** raised the six week miss from 3.0 to 9.8 points, so the
projection carries no slope.

**80% range.** The half width is `sqrt(12.37 + 0.1708 x days)`, about 4.3 points at 36 days.
On the 2024 presidential and 2025 governor races, 14 races and 52 cut points, it covered 96% of
outcomes.
