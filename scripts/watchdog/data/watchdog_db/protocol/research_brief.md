# Watchdog research brief

You are building watchdog profiles for the On Point Politics watchdog database, onpointpolitics.us. Today is Friday, October 23, 2026. The general election is November 3, 2026.

## Read first

1. The method: /mnt/user-data/uploads/Watchdog_Research_Protocol__1_.md. Read all of it. Follow its standards, especially: every figure has a date and a source URL; fact and inference are separated; cumulative totals are labeled and never summed with their parts; contested claims store the allegation, the denial and both sources; never store A to C when filings only show A to B and B to C; public record only, nothing on health, non political family members, or minors.
2. The reference example: /mnt/user-data/uploads/Byron_Donalds_Watchdog_File.md. It is 712KB, so do not read it whole. Read lines 1 to 60 and lines 195 to 215 and lines 436 to 460 to see the voice, the deal table, and the ledger rows. That file is Tier 1; yours is a compact Tier 2.
3. The roster row for each subject: grep the person_id in /home/claude/watchdog/out/roster/master_roster.csv. It has party, office, district, rating, FEC IDs, bioguide and committee assignments for sitting members of Congress.

## Depth: compact Tier 2

Protocol steps 1 through 8, hop two for the subject's top three blocs. You have a hard budget of about 45 tool calls per subject; spend them on the money and the decisions, not on biography. Breadth beats polish: a profile with 25 well sourced edges and a clear levers table is the goal. Never pad. If something is not findable, say so in the gaps.

What to find, in order:
1. Committees and IDs: campaign committee, leadership PAC, state political committee or super PAC aligned with the subject, the treasurer or compliance firm. For federal subjects take FEC IDs from the roster and from news; for state subjects use the state's campaign finance ID.
2. Money in: total raised with as-of date, top individual donors, top PACs and industries, self funding, the main super PAC or outside groups spending for and against, with their top funders.
3. Money out: top vendors, consultants, pollsters, media buyers.
4. Own finances: net worth range from disclosures or a dated third party estimate, businesses, stock trading controversies, sponsored travel. Public record only.
5. Enforcement: FEC, ethics office, state ethics complaints, lawsuits, with outcomes. Record the subject's response.
6. Hop two for the top three blocs: where the big donors also give, their lobbyists, their contracts with the government the subject would run or oversees.
7. Levers: what this office controls that the donor blocs want, the specific decision, when it lands, the subject's stated position or silence.
8. Votes and record: the two to five most money relevant votes, bills or executive actions, with dates.

## Sources that work and do not work

Blocked, do not retry: en.wikipedia.org, fec.gov including api.open.fec.gov, opensecrets.org, followthemoney.org. Search snippets often quote OpenSecrets and FEC figures; a figure seen only in a snippet is Status Secondary and its URL goes in the could not verify list.
Work: Ballotpedia, transparencyusa.org for state candidates in states it covers, state election and ethics sites, news outlets, ProPublica, Sludge, The Lever, NOTUS, Punchbowl, Politico, Axios, AP, local papers, Quiver Quantitative and Capitol Trades for trades, LegiStorm, Campaign Legal Center, CREW, court coverage.
Read the article body through WebFetch for any figure over $100,000 when you can. Note the outlet and date.

## Interest bloc tags

Use these exact strings so boards color consistently. Pick the one that fits the donor's own business.
Billionaire megadonor; School choice and family; Gambling; Detention vendors; Utilities and energy; Utilities and data centers; Oil and gas; Developers and construction; Real estate; Insurance and tort; Crypto and finance; Wall Street and banking; AI industry; Tech; Sugar and agriculture; Health care and pharma; Defense contractors; Labor unions; Pro-Israel; Trump world; Party and leadership; Ideological groups; Self funding; Small donors; Enforcement and disclosure; Legislative leadership; Opponent context; Rival context.
If none fits, add a short new tag and mention it in your reply.

## Output: five files per subject

Write into /home/claude/watchdog/out/people/STATE/PERSON_ID/ where STATE is the two letter code and PERSON_ID is the roster person_id exactly. Create the folder.

### meta.json
```json
{
  "person_id": "FL-byron-donalds",
  "name": "Byron Donalds",
  "party": "Republican",
  "state": "FL",
  "office_sought": "Governor",
  "current_office": "U.S. House FL-19",
  "opponents": ["FL-david-jolly"],
  "vehicles": [{"name": "Friends of Byron Donalds PAC", "id": "FL DOE 89043", "kind": "state political committee", "treasurer": "Bradley T. Crate, Red Curve Solutions"}],
  "top_blocs": ["Billionaire megadonor", "Gambling", "Detention vendors"],
  "headline_total": {"amount_usd": 0, "label": "raised across all vehicles", "as_of": "2026-09-30", "source": "URL"},
  "research_tier": "Tier 2 compact",
  "compiled": "2026-10-23",
  "next_filing": "the next filing deadline that will update these numbers"
}
```

### edges.csv
Written with Python's csv module. One row per money or relationship edge. Columns in this order:
subject_id, donor_or_entity, type, amount, amount_usd, cumulative, date_or_as_of, recipient_vehicle, interest_bloc, source, hop, status, note
- amount: as reported, text. amount_usd: plain number with no symbols, blank for relationship edges. cumulative: yes or no.
- type: Individual, Corporation, PAC, Political committee, Super PAC, Tribe, Trade association, Union, Party, Candidate transfer, Self funding, Public funds, Contract, Grant, Vendor payment, Independent expenditure for, Independent expenditure against, Relationship.
- recipient_vehicle: the committee or entity receiving the money. For money out rows the subject's committee is donor_or_entity and the vendor is recipient_vehicle. For hop two rows, the upstream or sideways entity is donor_or_entity and the hop one donor or another politician is recipient_vehicle.
- source: a bare URL.
- hop: 1 or 2 or 3. status: Confirmed, Secondary, Provisional, Contested.
Relationship edges: treasurer, consultant, spouse who is a political actor, business owned, board seat, endorsement, lawsuit party, lobbyist. Leave amount blank.

### levers.csv
Columns: decision, who_holds_it_now, when, which_donors_care, stake, subject_position, source

### profile.md
The fixed structure from protocol step 10, compact. No em dashes, no hyphens used as punctuation, no arrows, and no parentheses anywhere in the prose; use commas and separate sentences instead. Hyphens inside words like pro-Israel are fine. Sections:
1. Title line: "# NAME Watchdog File", then Subject, Compiled, Data cutoff, Next scheduled data drop lines.
2. Bottom line up front: three to five interests with both large money and a live decision.
3. Committee structure and treasurer.
4. One short section per top bloc: money in with names, amounts and dates; what they want; the lever; what the subject has done or said; documented facts first, then a paragraph that starts "Inference:".
5. Own finances and disclosure history.
6. Enforcement and controversies, each with the subject's response.
7. Deal table: Interest, Money in, Ask, Lever, Stake, Decision date.
8. Levers table and a short calendar of decisions from November 2026 through 2028.
9. What we could not verify, including every URL whose body you did not read.
Keep it roughly 1,200 to 2,500 words per subject.

### notes.md
Four sections per research thread: Takeaway, Cited findings with inline URLs, Inferences, Gaps. This is the audit trail.

## Accuracy over coverage

Do not use memory for figures, dates or donor names; every figure must come from a page you fetched or a search result you can cite, and a snippet only figure is Secondary. Names of donors and amounts are the product; a wrong one is worse than a missing one. Allegations go in only with the subject's denial or response if one exists, and with Contested status when disputed.

## Reply

When done, reply in under 150 words: subjects completed, edge count per subject, the single most notable finding per subject, any new bloc tags, and the biggest gaps.
