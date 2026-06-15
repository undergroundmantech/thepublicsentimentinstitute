# U.S. Voter Registration — Latest Statewide & County-Level Dataset

Snapshot of the **latest available official voter-registration counts** for all 50 states + DC,
at **statewide** and **county (or county-equivalent)** granularity, with party breakdowns where states
register by party. Compiled June 2026 for The Public Sentiment Institute.

- **51 jurisdictions** (50 states + DC)
- **3,541 county/sub-state units** with registration totals
- **8,487 party-by-unit** rows (31 states register by party)
- **National total: 221,055,784 registered** (50 states + DC; North Dakota has no registration)

## Files

| File | What it is |
|---|---|
| `states/<ABBR>.json` | Per-state detail: statewide total, full county list, party breakdowns, exact source URL + as-of date, notes. The authoritative records. |
| `states_summary.csv` | One row per state: statewide total, as-of date, party-reg flag, unit count, data quality, source. |
| `counties_all.csv` | One row per county/unit: `state_abbr, state_fips, unit_label, unit_name, unit_fips, total_registered, as_of_date, source_quality`. |
| `party_long.csv` | Long format party registration: `state_abbr, unit_name, unit_fips, party, registered` (party-registration states only). |
| `manifest.json` | Machine-readable index of all 51 jurisdictions with key metadata. |

## Methodology

- One independent research pass per state, pulling from the **official election authority** (Secretary of State /
  State Board / Division of Elections). The **single most recent** report was used for each state and its exact
  printed "as of" date recorded — cadences differ (weekly, monthly, quarterly, annual, or only at the general election),
  so **as-of dates are NOT uniform** (see below). This is expected and tracked per-state in `as_of_date`.
- Every state's county figures were reconciled against its published statewide total. **48 of 51 reconcile at 0.0%.**
- Numbers are integers; `total_registered` follows each state's own basis (active vs active+inactive), documented in each
  file's `as_of_notes`.

## "Latest" is not the same date everywhere

Most states are **2026** (many May/June 2026). These publish county-level registration only at the **November 2024
general election** (their most recent county-level release): **AR, GA, HI, IL, IN** (Nov 2024) and **MO** (Dec 2024).
Other lagged-but-latest: **MA** (Feb 2025), **VT** (Apr 2025 statewide), **TN** (Jun 2025), **CT** (Oct 2025),
**KS, MI** (Nov 2025). All are the freshest *county-level* data those states publish.

## Special cases

- **North Dakota** — the only state with **no voter registration**. `statewide_total_registered` is null;
  `ND.json` documents this and includes a `ballots_cast` equivalent (Nov 2024) instead.
- **Alaska** — no counties; reported by the **40 state House Districts** (`county_unit_label: "house district"`).
- **DC** — by **8 wards**. **CT** (169 towns), **NH** (243 towns/places), **RI** (39 municipalities),
  **MA** (14 counties, rollup of 351 towns), **VT** (14 counties) — New England registers by town.
- **Illinois** — 108 election jurisdictions (102 counties + 6 city boards). **Virginia** — 133 localities
  (95 counties + 38 independent cities). **Missouri** — 116 units (114 counties + St. Louis City + Kansas City board).
- **Party registration**: 31 of the 51 jurisdictions register voters by party (DC included); the other 20 do not
  (`registers_by_party: false`, party fields null). Party category names vary by state and are preserved as each state reports them.

## Data-quality flags (`data_quality`)

- `complete` / `high` / `verified` — official source, sums reconcile. (48 states)
- `partial` — **OH** and **VT**: statewide headline is current, but the **county breakdown is EAC EAVS 2024**
  (as of 2024-11-05), so county sums do not equal the current headline. See `county_breakdown_source` /
  `county_breakdown_as_of` in those files.
- `not_applicable` — **ND** (no registration).

## Refresh notes

- **OH**: re-pull the 88-county table from the Ohio SOS DATA Act dashboard (`data.ohiosos.gov`) once it is out of
  maintenance, to replace the EAVS-2024 county backfill with same-date data.
- **VT**: county breakdown is derived (EAVS town→county); VT SOS publishes no official sub-state table.
- **AR, GA, HI, IL, IN, MO**: refresh county data after the next general election (or whenever those SOS offices post
  a newer county-level report).
- Several SOS sites (AZ, GA, MI, MN, NV, NY, OH, RI, WI) sit behind bot protection; data was retrieved from the
  official files via archives/mirrors/API endpoints where needed — sources noted per file.

_Sources: each `states/<ABBR>.json` carries the exact `source_url` and `source_name`. Fallback county data, where used,
is the U.S. Election Assistance Commission (EAC) 2024 EAVS Public Release v2.0._
