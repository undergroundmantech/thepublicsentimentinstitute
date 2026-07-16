# PHASE 2 — Hardcoded HEX migration (grep-verifiable)

Phase 1 (tokens/fonts/logo) fixes everything that reads CSS variables. But the
codebase has ~795 hardcoded hex literals across ~60 files that will NOT update
automatically and would leave the OLD purple/red/blue palette bleeding through.
This phase migrates them.

## Legacy → new hex map (exact counts from the current build)

| Legacy hex | Count | Meaning (old) | Replace with | New meaning |
|-----------|------:|---------------|--------------|-------------|
| `#7c3aed` | 67 | primary purple | `#6d3ee9` | brand violet (mid of gradient) |
| `#9d5cf0` | 40 | purple-2 | `#8a63ef` | brand violet light |
| `#6d28d9` | 2  | purple-soft | `#5a2fd4` | brand violet deep |
| `#e63946` | 96 | red | `#c22f3b` | GOP red (light) |
| `#ff4d5a` | 3  | red-2 | `#d64550` | GOP red bright |
| `#2563eb` | 81 | blue | `#1d5fc4` | DEM blue (light) |
| `#3b82f6` | 15 | blue-2 | `#3b7bde` | DEM blue bright |
| `#0b0d1c` | 10 | ink | `#17171b` | ink |
| `#f6f7fb` | 25 | bg | `#f7f7f4` | canvas |

## ⚠️ Do NOT blind-replace — two rules

1. **Prefer tokens over literals.** Where a literal sits in a `.tsx`/`.css`
   style that could reference a variable, replace with `var(--dem)`, `var(--gop)`,
   `var(--ink)`, etc. — not another hardcoded hex. The hex map above is the
   fallback for cases where a variable can't be used (e.g. SVG `fill`, canvas
   drawing, chart libraries taking string colors).

2. **Party semantics matter.** `#2563eb`/`#e63946` are almost always party
   colors. In same-party primary pages (Dem primary, GOP primary) the SECOND
   candidate should map to `--c2` magenta, NOT the opposing party color. Review
   each polling page's candidate assignment; don't assume blue=DEM/red=GOP holds
   inside a one-party primary.

## Suggested mechanical pass (review each diff before commit)

```bash
# From repo root. Runs on app/ only, tsx/ts/css. Review with git diff after.
cd app
for pair in \
  "#7c3aed:#6d3ee9" "#9d5cf0:#8a63ef" "#6d28d9:#5a2fd4" \
  "#e63946:#c22f3b" "#ff4d5a:#d64550" \
  "#2563eb:#1d5fc4" "#3b82f6:#3b7bde" \
  "#0b0d1c:#17171b" "#f6f7fb:#f7f7f4"; do
  old="${pair%%:*}"; new="${pair##*:}"
  grep -rl "$old" . --include="*.tsx" --include="*.ts" --include="*.css" \
    | xargs -r sed -i "s/${old}/${new}/g"
  echo "migrated $old -> $new"
done
```

Case-insensitivity: some hexes appear uppercase (`#E63946`). Add an
`I`-flag pass or normalize first:
```bash
grep -ril "#E63946\|#7C3AED\|#2563EB" . --include="*.tsx" --include="*.ts" --include="*.css"
```

## Verification (must be clean before Phase 2 is "done")
```bash
# Zero legacy literals should remain:
grep -rn "#7c3aed\|#9d5cf0\|#e63946\|#ff4d5a\|#2563eb\|#3b82f6\|#0b0d1c\|#f6f7fb" \
  app --include="*.tsx" --include="*.ts" --include="*.css" -i | wc -l
# Expect: 0

# No stray Quantico/Fraunces references:
grep -rn "Quantico\|Fraunces\|font-serif\|--font-serif" app --include="*.tsx" --include="*.ts" --include="*.css" | wc -l
# Expect: 0
```

## Files with highest concentration (prioritize review)
- `app/components/PollingTimeSeriesChart.tsx` (chart string colors — likely needs `--dem`/`--gop`/`--c2` mapping, watch primary semantics)
- `app/components/SpotlightRaceCard.tsx`
- `app/components/v1/HeroElectoralMap.tsx`
- `app/forecastratings/ForecastRatingsV1.tsx` / `V2.tsx`
- `app/tpsipoll/TpsiPollV1.tsx`
- all `app/polling/<race>/page.tsx` (per-race candidate colors)
