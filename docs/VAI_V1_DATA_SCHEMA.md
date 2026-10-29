# Vote Arrival Intelligence v1: data schema

Status: **design**. Only the two count-order artefacts in §1 and §2 exist; everything after them is a contract for later engineering. All new code lives in isolated paths; see [VAI_V1_SONNET_IMPLEMENTATION_HANDOFF.md](VAI_V1_SONNET_IMPLEMENTATION_HANDOFF.md).

Provenance labels used throughout, with one label on every value VAI emits:

| Label | Meaning | Example |
|---|---|---|
| `VERIFIED` | Observed directly from a primary result source at a stated time | Reported votes in Maricopa at 22:41 ET |
| `OFFICIAL_STATEMENT` | A number an election official published that is not itself a tabulated count | "About 410,000 early ballots remain to be tabulated" |
| `ESTIMATED` | Produced by the VAI model, with an interval | Expected remaining votes 380k (80% interval 300k–470k) |
| `PRIOR` | Taken from the count-order ledger, the forecast or historical data before any 2026 return arrives | "Mail first" release order for Arizona |
| `UNKNOWN` | No defensible value exists | Late-arriving ballot volume in a grace-period state with no history |

These map onto the protected intel branch's `EvidenceClass` (`VERIFIED`, `HISTORICAL`, `INFERRED`, `UNKNOWN`) and `ValueKind` (`OBSERVATION`, `ESTIMATE`) as follows:

| VAI label | `evidenceClass` | `valueKind` | Extra field |
|---|---|---|---|
| `VERIFIED` | `VERIFIED` | `OBSERVATION` | none |
| `OFFICIAL_STATEMENT` | `VERIFIED` | `ESTIMATE` | `sourceTier = OFFICIAL` |
| `ESTIMATED` | `INFERRED` | `ESTIMATE` | none |
| `PRIOR` | `HISTORICAL` or `INFERRED` | `ESTIMATE` | none |
| `UNKNOWN` | `UNKNOWN` | none | none |

Use this mapping for any adapter so the two vocabularies never diverge.

---

## 1. Count-order dataset: `data/vai/count_order_2026.json` (built)

Builder: `scripts/vai/build_count_order.py`. It is deterministic apart from `builtAt`, so re-running it must produce an identical file except for that field.

```text
{
  schema: "vai-count-order/1",
  builtAt, builder,
  ledger: { file, sha256, states: 50, caveats: 12, ncslProcessingTable },
  categories: {A..D}, speedLabels: {0..2},
  rules: [ ...four usage rules, verbatim... ],
  jurisdictions: Jurisdiction[51]          // 50 states + DC stub (level DISTRICT, ledger null, NOT_IN_LEDGER)
}
```

`Jurisdiction`:

| Field | Type | Notes |
|---|---|---|
| `jurisdiction` | `{ level: "STATE"\|"DISTRICT", state, name }` | |
| `ledger` | `{ entryIndex, sourceSha256 }` | Points back to the exact ledger entry |
| `firstRelease` | `{ category: A\|B\|C\|D, label, categoryDescription, ledgerText, evidenceKind: "ESTIMATED_2026_ORDER" }` | Prior only |
| `countSpeed` | `{ code: 0\|1\|2, label }` | Prior only |
| `pollClose` | `{ ledgerEasternHour, ledgerEastern, utc, timezoneRule, splitTimezoneState, note?, verification: "LEDGER_ONLY" }` | `utc` assumes EST (UTC−5) on Nov 3, 2026. States split across time zones need per-county close times before use. |
| `ballotMethods` | `{ ledgerText }` | Verbatim |
| `releaseSequence[]` | `{ stage, ledgerText, evidenceKind: "ESTIMATED_2026_ORDER", status: "PRIOR_NOT_VERIFIED" }` | Ledger's ordered list |
| `lateCounting` | `{ ledgerText, receiptClassFromLedger: ELECTION_DAY_OR_EARLIER\|POSTMARK_GRACE\|UNCLASSIFIED }` | Cross-checked against register `{ST}-receipt-deadline` |
| `historicalPattern` | `{ ledgerText, evidenceKind: "HISTORICAL_OBSERVED_CLAIM", status: "UNVERIFIED_NOT_A_MODEL_INPUT" }` | **Must never be read by a model** |
| `changes2026` | `{ ledgerText, evidenceKind: "2026_SPECIFIC_CLAIM" }` | Verified parts are in the register |
| `confidence` | `{ ledgerCaveat, level }` | `level` is `LEDGER_CAVEATED` or `LEDGER_UNCAVEATED_UNVERIFIED` |
| `citations[]` | `{ url, tier: OFFICIAL\|FEDERAL_OFFICIAL\|SECONDARY_RESEARCH\|MEDIA, fetchStatus, retrievedAt, sha256, title }` | The text cache stays outside the repository |
| `countyExceptions[]` | `{ countyFips, field, value, registerId }` | Empty until evidenced. A statewide class never overrides a county exception. |
| `partialReporting` | `{ statewideClassAppliesToAllCounties: null, note }` | Whether some counties release in a different order |
| `dateVerified` | ISO timestamp | Retrieval time of the register check, **not** a claim that every field was verified |
| `evidenceRegisterIds[]` | `string[]` | |

## 2. Evidence register: `data/vai/evidence_register_2026.json` (built)

```text
{ schema: "vai-evidence-register/1", builtAt, statusCounts, sourcesFetched, statusMeaning, entries: Entry[] }
Entry = {
  id,            // e.g. "KS-receipt-deadline", "US-watson-v-rnc", "intel:KS-canvass", "OH-ledger-caveat"
  state,         // two-letter code, "US" for federal, "ALL" for ledger-wide classes
  claimType,     // LEGAL_RECEIPT_DEADLINE 67 | LEGAL_PREPROCESSING_PERMITTED 61 | LEDGER_CAVEAT 12 | CURE_CANVASS_WINDOW 7
                 // | LEGAL_RELEASE_RESTRICTION 6 | LEGAL_TABULATION_PERMITTED 5 | LEGAL_RELEASE_TIMING 2
                 // | HISTORICAL_OBSERVED_SEQUENCE 2 | REPORTING_UNIT 2 | LATE_ARRIVAL_RISK 1 | ESTIMATED_2026_ORDER 1
  claim,         // one sentence, plain English
  status,        // VERIFIED_PRIMARY_ANCHOR | VERIFIED_SECONDARY | VERIFIED_MEDIA_ONLY | UNRESOLVED | PRIOR_NOT_VERIFIED | UNVERIFIED_NOT_A_MODEL_INPUT
  evidence: [{ url, tier, retrievedAt, sha256, quote }],
  note,
  ledgerText?, ledgerClass?, sourceClass?,   // receipt-deadline entries: the ledger-vs-NCSL comparison
  limitations?                               // imported intel findings
}
```

Live litigation (Kansas grace period, appeal argued Nov 24) must be re-checked before the freeze in §10.

Rules:
- `quote` is at most 300 characters of verbatim source text.
- A claim is `VERIFIED_*` only if the quote is present in the retrieved text whose hash is recorded.
- Intel findings are imported by id and keep their original anchor-check date.

## 3. Live observation contract

VAI **reuses** `VoteObservation` and `LoggedObservation` from the intel branch (`app/lib/intelligence/types.ts` on `0559aad3`):

```ts
interface VoteObservation {
  raceId: string; jurisdictionId: string; jurisdictionLevel: JurisdictionLevel;
  scope: "WHOLE" | "DISTRICT_PORTION";
  method: VotingMethod;                    // ELECTION_DAY | EARLY_IN_PERSON | MAIL_ABSENTEE | PROVISIONAL | OTHER | UNKNOWN
  sides: Sides;                            // { a, b, o }
  precinctsReportingPct: number | null;    // metadata only
  sourceTimestamp: string | null; retrievedAt: string; source: string; sourceUrl: string | null; test: boolean;
}
```

VAI needs two **additive** extensions (both optional, so existing code keeps compiling):

```ts
interface VoteObservationV2 extends VoteObservation {
  candidates?: { id: string; name: string; party: string | null; votes: number }[]; // full K-candidate vector; `sides` stays for compatibility
  providerBatchId?: string | null;          // if the provider ever exposes one
}
```

`method` stays `UNKNOWN` for civicAPI. Nothing infers method from timing.

### 3.1 Feed-quality flags (per reading, derived and never edited)

| Flag | Trigger | Effect in VAI |
|---|---|---|
| `DUPLICATE_READING` | Same key, source time and votes | Ignored (logged) |
| `OUT_OF_ORDER` | Source time is earlier than the latest reading already held | Kept in the log; the current state still uses the latest source time |
| `DOWNWARD_REVISION` | A candidate's votes or the total fell versus the previous reading by source time | The current state uses the new value. The inventory model widens county variance; the operator is alerted. |
| `NO_SOURCE_TIME` | `sourceTimestamp` is null | Ordered by `retrievedAt`, flagged |
| `STALE_FEED` | No change in the race for more than X minutes while the provider reports activity elsewhere, or a fetch error | The projection is frozen with a "feed delayed" label. Uncertainty is not shrunk. |
| `UNMATCHED_REGION` | A region key is absent from the forecast county file | Counted in a coverage metric. **Never** silently dropped. |
| `TOTAL_EXCEEDS_EXPECTED` | County reported total exceeds `q99(T_c)` | The county turnout posterior is re-centred (math §2.3) and the race is flagged |
| `TEST_DATA` | `test: true` | Excluded from every estimate |

## 4. County state (derived, per race, per county, per tick)

```ts
interface VaiCountyState {
  raceId: string; countyKey: string;               // FIPS or town key; mapping recorded
  reported: { total: number; byCandidate: Record<string, number>; label: "VERIFIED"; asOf: string };
  precinctsReportingPct: number | null;            // metadata only
  officialOutstanding: { value: number; asOf: string; registerId: string; label: "OFFICIAL_STATEMENT" } | null;
  lateEligible: { mean: number | null; label: "PRIOR" | "UNKNOWN"; rule: "ELECTION_DAY_OR_EARLIER" | "POSTMARK_GRACE"; deadlineUtc: string | null };
  turnoutPosterior: { median: number; q10: number; q90: number; label: "ESTIMATED" };
  remainingPosterior: { median: number; q10: number; q90: number; label: "ESTIMATED" };
  completionEvidence: CompletionLevel;             // see §6
  flags: string[];
}
```

## 5. Race assessment (VAI output, shadow only)

```ts
interface VaiAssessment {
  raceId: string; modelVersion: string; computedAt: string;
  asOfSourceTime: string;                          // latest source time used, never retrieval time alone
  inputsHash: string;                              // sha256 of the observation slice and the frozen prior
  rule: "PLURALITY" | "MAJORITY_RUNOFF" | "MEASURE_THRESHOLD" | "RCV";
  publication: PublicationStates;                  // §7: kept separate, never merged
  reported: { total: number; byCandidate: Record<string, number>; label: "VERIFIED" };
  remaining: {
    officialOutstanding: number | null;            // OFFICIAL_STATEMENT, summed only where every county has a statement
    estimatedTotal: { median: number; q10: number; q90: number };  // ESTIMATED
    lateEligible: { median: number | null; label: "PRIOR" | "UNKNOWN" };
    byScenario: { scenarioId: string; weight: number; label: string }[]; // reporting-order mixture (math §5)
  };
  projection: {
    finalShare: Record<string, { median: number; q10: number; q90: number }>;
    margin: { median: number; q10: number; q90: number } | null;      // only when a two-way margin is meaningful
    pWin: Record<string, number> | null;           // null when the rule is RCV or calibration is not established
    pRunoff: number | null;                        // MAJORITY_RUNOFF only
    pPass: number | null;                          // MEASURE_THRESHOLD only
    requiredShareOfRemaining: Record<string, { median: number; q10: number; q90: number }>;
    calibrationStatus: "UNCALIBRATED_SHADOW" | "BACKTESTED" ;
  };
  anchor: { atZeroReporting: { marginGap: number; pGap: number } };  // self-check (math §6)
  diagnostics: { coverage: number; unmatchedVotes: number; ess: number | null; flags: string[] };
}
```

`requiredShareOfRemaining` is the share of the estimated remaining vote a candidate needs to finish first (or to reach the threshold). It is reported with the remaining-vote interval, never as a single number.

## 6. Completion evidence ladder

`CompletionLevel`, from weakest to strongest. Higher rungs require explicit evidence:

| Level | Evidence | What may be said |
|---|---|---|
| `NONE` | No returns | "No votes reported" |
| `PARTIAL` | Votes reported | "Counting" |
| `PRECINCTS_ALL_IN` | `precinctsReportingPct = 100` | "All precincts have reported. Mail, provisional and late ballots may remain." **Never** called "complete". |
| `OFFICIAL_ELECTION_NIGHT_COMPLETE` | An official statement that election-night tabulation is finished | "Election-night count finished. Ballots counted later may remain." |
| `ALL_KNOWN_BALLOTS_COUNTED` | An official statement that all received ballots are tabulated, after the receipt deadline | "All known ballots counted" |
| `CERTIFIED` | Certified result published | "Certified" |

## 7. Publication states (kept separate)

```ts
interface PublicationStates {
  reportedLead: { leaderId: string | null; votes: number; label: "VERIFIED" };       // who leads in the count
  preElectionForecast: { pWin: number; margin: number; frozenAt: string; label: "PRIOR" }; // the frozen published forecast
  liveProjection: VaiAssessment["projection"] | null;                                 // OnPoint estimate
  providerCall: { provider: string; winnerId: string; calledAt: string } | null;      // from civicAPI or another provider
  certified: { winnerId: string; certifiedAt: string; sourceUrl: string } | null;
}
```

Rules:
- A field may only be filled from its own source.
- No code path may copy one state into another. For example, a provider call never sets `liveProjection.pWin` to 1.
- Projections must never be described as calls.

## 8. County exceptions file (future): `data/vai/county_exceptions_2026.json`

```text
{ schemaVersion: "vai-county-exceptions/1",
  entries: [{ state, countyFips, field: "firstRelease"|"pollCloseUtc"|"officialOutstandingSource"|"releaseCadence",
              value, registerId, status }] }
```

Each entry needs a register id with a quote. Candidates to populate first: TX El Paso (Mountain time), the FL Panhandle counties on Central time, MI Upper Peninsula counties, AZ Maricopa and Pima (outstanding statements), NV Clark and Washoe, PA Philadelphia and Allegheny.

## 9. Historical snapshot schema (for the backtest)

```text
HistoricalSnapshot = {
  election: "2022-11-08" | "2024-11-05", state, raceKey, countyKey | "TOPLINE",
  availableAt,          // UTC: the EARLIEST time the content is provably public = archive crawl time (an upper bound on publication)
  sourceTime | null,    // only if the content states it
  archiveUrl, contentSha256, parser, parserVersion,
  votesByCandidate, totalVotes, precinctsReportingPct | null, method | null,
  provenance: "ARCHIVE_CAPTURE"
}
```

- Two snapshots with the same `contentSha256` are the same reading. Keep the earlier `availableAt`.
- `availableAt` is the **only** ordering key the backtest may use.
- Final certified results are stored separately as `HistoricalFinal` and may be read only by the scorer.

## 10. Versioning and freezing

| Artefact | Frozen when | Key |
|---|---|---|
| Count-order dataset and register | Nov 2, 2026 at 23:59 ET, with a re-check of the Kansas litigation and the caveats | `count_order_2026.json` sha256, stored in each assessment's `inputsHash` |
| Forecast prior | Last published forecast before the first poll close (Nov 3, 18:00 ET) | `model.json` and `st/*.json` sha256. Joint draws, if exported, have their own sha256. |
| VAI model | Tagged `vai-v1.x`. Hyperparameters live in `data/vai/hyper_v1.json` with their estimation provenance. | `modelVersion` |
| Observation log | Append-only; never edited | `seq` |

A change to any frozen input after the first poll close produces a **new** `modelVersion`. Earlier assessments are never rewritten.
