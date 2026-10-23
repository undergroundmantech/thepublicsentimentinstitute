# On Point Politics Watchdog Database

Built October 23, 2026. One folder per person for every sitting member of Congress, every sitting governor, and every 2026 general election nominee for U.S. House, U.S. Senate and governor. 1,222 people in all.

Open index.html first. It is a searchable, sortable table of everyone with links into each folder.

## What is in each person folder

people/STATE/PERSON_ID/

| File | What it holds |
|---|---|
| profile.md | The watchdog file. Hand researched subjects follow the protocol's fixed structure. Queued subjects hold the roster facts, race, committees, office levers and, once the pipeline runs, the FEC money section |
| board.html | Connections board. Subject at the hub, money vehicles on the first ring, direct donors and vendors grouped by bloc on the second, upstream and sideways money on the third, decisions on the desk on the rim. Click any node for its rows and sources. Built wherever there are money edges |
| edges.csv | Hand researched edges in the Ledger import schema |
| edges_fec.csv | Edges written by the FEC pipeline, same schema, kept separate so a rerun never overwrites hand research |
| levers.csv | Decisions this office controls, who holds them, when they land, which donors care. Queued subjects have template rows from their office and committee assignments |
| notes.md | Research notes with Takeaway, Cited findings, Inferences and Gaps. The audit trail |
| meta.json | IDs, vehicles, treasurer, top blocs, headline total, research tier |
| fec_summary.md, fec_meta.json | Written by the pipeline |

## Root files

| File | What it holds |
|---|---|
| index.html | Searchable index of all 1,222 people |
| ledger_master.csv | Every edge from every folder in one file, with an origin column saying hand research or FEC pipeline. This is the Ledger import |
| research_queue.csv | Everyone not yet hand researched, in priority order |
| roster/master_roster.csv | The roster: party, state, district, office sought, race status, rating, FEC IDs, bioguide, committees, groups, research priority |
| roster/incumbents_congress.csv | Sitting Congress as of Sept 24, 2026 from the unitedstates congress-legislators dataset, with committees |
| roster/nominees_g1.csv to g8.csv | The eight regional nominee rosters with source URLs per row |
| protocol/ | The research protocol and the two briefs the research agents work from |
| pipeline/ | The FEC pipeline |
| scripts/ | Rebuild scripts for folders, boards, index and ledger |

## Research status

Hand researched at compact Tier 2, October 23, 2026: the governor races in Georgia, Michigan, Arizona, Pennsylvania, Ohio and Wisconsin, both nominees each. Byron Donalds is the Tier 1 reference file, imported with its original board and all 423 ledger rows.

Everyone else is queued. Priority 1 is governor nominees and sitting governors, 2 is Senate nominees and sitting senators, 3 is House nominees in Toss Up and Lean races, 4 is everyone else.

## Running the FEC pipeline

FEC.gov and OpenSecrets were blocked from the research workspace, so federal money comes from this pipeline, run in the Ledger Codespace or any machine with internet.

```
pip install requests
export FEC_API_KEY=your_key            free at https://api.data.gov/signup/
python3 pipeline/fec_pull.py --priority 1,2,3 --limit 20     a test batch
python3 pipeline/fec_pull.py --skip-done                      everyone, resumable
python3 scripts/build_all.py                                  rebuild boards, ledger and index
```

Per federal subject it pulls: cycle totals, committees and treasurers, leadership PACs, every PAC and committee receipt, individuals at $5,000 and up in aggregate, top donor employers, self funding and loans, unitemized small dollar total, top vendors, leadership PAC gifts to other candidates, independent expenditures for and against, the top funders of the biggest outside groups, and where the top PAC donors also give.

A standard key allows 1,000 calls an hour and the full run is roughly 10,000 calls, so about ten hours. Email APIinfo@fec.gov for the 7,200 an hour tier and pass --rate 7000 to finish in under two. Every response is cached in pipeline/cache, so stopping and restarting costs nothing. After each filing deadline, rerun with --refresh. The next one is the post general report due December 3, 2026.

Things to check in pipeline output before publishing:
- Challengers without an FEC ID in the roster are matched by name search. fec_summary.md says when the match came from search; confirm those IDs.
- Bloc tags on pipeline rows come from keyword rules in pipeline/blocs.py. They are a first pass. Edit the rules when you identify a donor and rerun.
- Leadership PAC disbursements by recipient can include vendors, not only candidates.
- Amounts summed across several receipts are marked cumulative and should not be added to their parts.

Governors and other state candidates are not in FEC. Their money comes from hand research in state systems; transparencyusa.org covers several states cleanly.

## Standards

Everything follows protocol/Watchdog_Research_Protocol.md. Every figure carries a date and a source. Status is Confirmed for a primary filing or a fully read article, Secondary for a snippet or secondhand figure, Provisional for something awaiting a filing, Contested where sources disagree, with both sides stored. Hand researched profiles were written by research agents from sources fetched on October 23, 2026, and the rows marked Confirmed mostly rest on news articles read in full rather than on the filings themselves. Verify any figure against the filing before it goes in a headline, a tweet or a video.

## Known roster caveats

- Louisiana House races are an open primary on November 3 with a December 12 runoff, so all Democratic and Republican candidates there are listed as primary pending.
- Alaska uses top four, California and Washington use top two; everyone who advanced is listed.
- The incumbent dataset is current to September 24, 2026. The regional roster agents found no delegation changes after that date.
- current_office is blank for many challengers whose prior office could not be confirmed from a source.
- Third party and independent candidates are included only where competitive.
