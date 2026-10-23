# On Point Politics Watchdog Research Protocol

**Purpose:** A repeatable method for building a full financial and influence profile of any candidate, officeholder, or political entity for the watchdog database at onpointpolitics.us.
**Reference case:** The Byron Donalds file, October 2026, which was built with this exact process.
**Version:** 1.0, October 23, 2026

## The core idea

Every profile is built in hops. Hop zero is the subject. Hop one is everyone who gives money to the subject or takes money from the subject. Hop two is where that money came from before it reached the donor, where else that donor sends money, and the specific decision the donor is buying into. Hop three, used only for major players, is the network behind the hop two entities. A profile is complete when every major hop one donor has a documented hop two chain and a documented decision on the subject's desk.

The question the profile must answer is not "who gave money." It is "who gave money, what do they want, what does this office actually control, and what happens to ordinary people if they get it."

## Standards that apply to every line

1. Every figure carries a date or an as-of period. A number without a date does not go in the database.
2. Every figure carries a source URL. Prefer primary filings. Secondary coverage is acceptable when the filing is not retrievable, but mark it as secondary.
3. Separate documented fact from inference. Inference is allowed and useful, but it is labeled and stored in its own field.
4. Cumulative totals are labeled cumulative and are never summed with the component gifts that make them up.
5. Contested claims carry a contested flag and a one line statement of who says what. The subject's denial is recorded alongside the allegation.
6. Provisional claims, meaning anything reported ahead of the filing that will confirm it, carry a provisional flag and the date of the filing that will confirm or kill it.
7. Never overstate a chain. If A funds B and B funds C, the database stores A to B and B to C. It does not store A to C unless a filing shows it.
8. Public record categories only. The profile covers money, contracts, votes, appointments, business ownership, litigation, and public statements. It does not store health, family members who are not themselves political actors, or anything about minors.
9. Record what the subject or allies said in response when a critic's allegation is stored.

## Step 1: Frame the subject

Before any searching, write down:

- Full name, every committee the subject controls or benefits from, and the official IDs. For Florida candidates this means the Division of Elections account number for each political committee and the candidate account. For federal candidates this means the FEC committee ID for the campaign, any leadership PAC, and any joint fundraising committee.
- The treasurer and compliance firm. The treasurer links committees across state and federal lines and often links the subject to other politicians who use the same shop.
- The office sought and the list of things that office actually controls. For a Florida governor this list is appointments to the Public Service Commission, the Gaming Control Commission, water management districts, university boards, agency heads, emergency declarations, compact negotiation, bill signing and veto, the budget, and clemency and suspension powers. Write this list first, because every donor will eventually be mapped to one item on it.
- The opponent or rival set, so the file can say who did not give and where the same interests placed their other bets.
- The second office. For an executive, there is usually a second office the same interests need, such as the attorney general or the legislative leadership. Identify it at the start.

## Step 2: Hop one, the money in

Pull every receipt for every committee identified in step one.

**State level, Florida:** Florida Division of Elections campaign finance database at dos.elections.myflorida.com. Export the contributions for each political committee and candidate account. The site blocks some automated access, so an export from a browser session is the reliable path. Transparency USA and FollowTheMoney mirror much of this with cleaner aggregation. Seeking Rents by Jason Garcia, Florida Politics, Florida Phoenix, Tampa Bay Times, Miami Herald and Florida Bulldog publish weekly donor breakdowns that identify who is behind LLC names.

**Federal:** FEC.gov individual contribution search, committee receipts, independent expenditure search, and the raw filing viewer. OpenSecrets for industry aggregation, top contributors by cycle, and PAC profiles. Both sites rate limit; plan for exports rather than page by page reads.

**For each donor record:**

- Donor name as filed and the real person or company behind it. LLC and committee names are resolved by searching Sunbiz for Florida entities, the state corporate registry for other states, and the same donor coverage above.
- Donor type: individual, corporation, PAC, political committee, tribe, trade association, union, party committee, candidate transfer, public funds.
- Amount, date, recipient vehicle.
- Interest bloc tag. The current tag list is: Billionaire megadonor; School choice and family; Gambling; Detention vendors; Utilities and energy; Utilities and data centers; Developers and construction; Insurance and tort; Crypto and finance; AI industry; Sugar and agriculture; Pro-Israel; Trump world; Enforcement and disclosure; Legislative leadership; Opponent context; Rival context. Add tags when a subject needs them; do not force a donor into a wrong tag.
- Industry, from the donor's own business, not from a guess.

**Thresholds.** Everything $10,000 and up at the state level gets a full record. Below that, aggregate by industry unless the donor is interesting for another reason, such as a vendor with a state contract or a person who appears in a later hop. At the federal level, record every PAC gift and every individual over $5,000, and record smaller gifts from people who appear elsewhere in the file.

**Outside money.** Search independent expenditures for and against the subject in every race. Identify the super PAC, its treasurer, its top funders, and its vendors. Shell committees with a Staples or UPS Store address are a flag; record the address.

## Step 3: Hop one, the money out

Pull the expenditures for every committee.

- Vendors: media buyers, consultants, pollsters, compliance, security, fundraising firms. Record the firm, the principal, and whether the firm also serves other politicians or a party.
- Transfers between the subject's own committees, especially federal to state or candidate to political committee. Note the date relative to announcements; a transfer within days of a new candidacy is a common FEC issue.
- Payments to individuals, especially aides, family, or people who appear in the donor file.
- Contributions from the subject's leadership PAC to other politicians. This is the subject's own network of favors.

## Step 4: The subject's own money

- Financial disclosures: the House or Senate Clerk's disclosure database for federal officials, the Florida Commission on Ethics Form 6 for state officials and candidates. Pull every year filed and every amendment. Amendments are a story in themselves; record what changed and when.
- Periodic transaction reports and stock trades: Capitol Trades, Quiver Quantitative, Unusual Whales. Cross reference trades against committee assignments and against bills the subject sponsored. A trade in a regulated sector by a member of the regulating committee is recorded with both the trade and the committee.
- Business ownership: Sunbiz and other state registries for every LLC listed on a disclosure, plus the spouse's entities. Record formation date, officers, registered agent, and any name changes.
- Nonprofits: ProPublica Nonprofit Explorer and GuideStar for 990s. Record management fees, related party payments, and officer compensation.
- Liabilities: mortgages, student loans, credit lines, with the lender and the year.
- Income sources: salary, partnership income, book deals, speaking fees, spouse income.
- Sponsored travel: the Clerk's gift travel database and LegiStorm. Record who paid for every trip.
- Third party net worth estimates with the outlet and date, because the ranges on disclosures are wide.

## Step 5: Enforcement and disclosure history

- FEC matters under review: search the FEC enforcement database for the subject's name and every committee. Record the complaint date, who filed it, the general counsel recommendation, the commission vote, and the outcome.
- Office of Congressional Ethics and House Ethics referrals.
- Florida Commission on Ethics complaints.
- Campaign Legal Center, Public Citizen, Common Cause, Citizens for Responsibility and Ethics complaints. These organizations publish the complaint text, which is often the best summary of a chain.
- Court dockets for litigation involving the subject, the spouse, or their companies. CourtListener for federal, the county clerk sites for Florida circuit courts.
- FEC Reports Analysis Division letters, which flag refund demands and reporting problems.
- Criminal and arrest history only as already reported by established outlets, stated neutrally, with the disposition.

## Step 6: Hop two, upstream and sideways

For every donor above the threshold and every outside group:

- Where did the donor's money come from? For a super PAC or political committee, pull its own receipts. For a conduit committee, pull both sides and record the dates; same day in and out is a flag.
- Where else does the donor give? Pull the donor's full giving in the current cycle and the prior one. Record the other recipients, especially the second office identified in step one, legislative leadership, the party, and the subject's rivals.
- Who are the donor's lobbyists? Florida lobbyist registration at floridalobbyist.gov lists principals and firms. Record the firm and whether it also lobbies for a competing interest.
- What contracts does the donor hold with the government the subject would run? Florida's vendor payment data, emergency management procurement records, and agency contract databases. Record contract value, amount paid, amount owed, and the date of any gift relative to the award.
- What is the donor's business position? For a company, the revenue segment that depends on the office. For an individual, the holdings and the public statements about what they want.

## Step 7: Hop two, the decision on the desk

This is the step that turns a donor list into a watchdog file. For every bloc:

- Name the specific decision: an appointment, a contract renewal, a compact, a bill, a rate case, a reimbursement, a ballot amendment, a lawsuit posture.
- Record who holds the lever now, when the decision lands, and the dollar stake to the state or to the donor.
- Record what the subject has said about it, with date and source. Record when the subject has said nothing, because silence from a candidate who has taken millions from a bloc is itself a finding.
- Record what the opponent has said, so the file can state what changes under each outcome.
- Record who loses: which services, which counties, which ratepayers, which students, which workers.

Build two tables from this step: a levers table with columns Decision, Who holds it now, When it comes up, Which donors care; and a calendar of decisions by month from the election through the next two years.

## Step 8: Votes and record

- GovTrack and Congress.gov roll call votes for federal officials; the Florida House and Senate vote records for state officials.
- Map each major vote to the bloc that cared about it and to any gift that arrived in the surrounding months. Record both the vote and the gift with dates; let the reader draw the inference, and label any inference you draw.
- Bills sponsored, with the lobbyists who registered on them.
- Letters to agencies, which are often a cleaner signal than votes.

## Step 9: Ideological and foreign-linked networks

This is where overstatement happens most, so the rules are strict.

- Trace the actual vehicle. A donor's foundation, the foundation's grantees, the grantee's grantees. Use 990s for each step. Store each step as its own edge.
- Attribute money to the person whose foundation it is. A director seat on someone else's foundation is a relationship edge, not a money edge.
- Put the largest grantee next to the controversial one, so the chain is read in proportion.
- When outlets disagree, store the disagreement: which outlet said what, on what date, and what the subject or donor said in response.
- A foreign think tank or policy shop is recorded with its funding sources, what it produced, and when funding stopped. Date the withdrawal if there was one.

## Step 10: Write the file

The deliverable has a fixed structure so profiles are comparable across subjects:

1. Bottom line up front: the four or five interests with both large money and a live decision.
2. Committee structure and treasurer.
3. One section per bloc: money in with names, amounts and dates; what they want; the lever; what the subject has done or pledged; documented facts, then labeled inference.
4. The subject's own finances and disclosure history.
5. Family business interests and the conflict question, framed structurally rather than as an accusation.
6. The deal table: ranked interests with money in, ask, lever, stake, decision date.
7. Levers table and calendar of decisions.
8. What we could not verify, including every URL whose body was not read.
9. Ledger import table.

## The Ledger import schema

Every money or relationship edge is one row. Columns:

| Column | Rule |
|---|---|
| Donor or Entity | Name as filed, with the real party in the same cell after a comma when the filed name is an LLC or committee |
| Type | Individual, Corporation, PAC, Political committee, Tribe, Trade association, Union, Party, Candidate transfer, Public funds, Contract, Grant, Relationship |
| Amount | Dollars as reported; write cumulative when it is a running total; blank for relationship edges |
| Date or As Of | Exact date when filed; otherwise the reporting period or the article date with as of |
| Recipient Vehicle | The committee, person, or entity that received it |
| Interest Bloc | One tag from the bloc list |
| Source | Markdown link to the filing or article |
| Hop | 1 for direct to or from the subject, 2 for upstream or sideways, 3 beyond |
| Status | Confirmed, Secondary, Provisional, Contested |
| Note | One line of context: what the money was for, timing relative to a decision, or the disagreement between sources |

Relationship edges, such as spouse, owner, treasurer, lobbyist, board seat, endorsement, and lawsuit party, use Type Relationship and leave Amount blank. They are what make the network graph readable.

## Source list by category

**Florida filings:** Florida Division of Elections campaign finance; Florida Commission on Ethics Form 6; Sunbiz; floridalobbyist.gov; Florida DEM and DMS vendor payment records; Florida Auditor General reports; Public Service Commission dockets; Florida Gaming Control Commission.

**Federal filings:** FEC.gov; House and Senate Clerk financial disclosures and gift travel; Office of Congressional Ethics; Congress.gov and GovTrack; Senate Lobbying Disclosure; USAspending and SAM.gov for federal contracts.

**Aggregators:** OpenSecrets; FollowTheMoney; Transparency USA; Capitol Trades; Quiver Quantitative; LegiStorm; ProPublica Nonprofit Explorer; CourtListener.

**Florida coverage that resolves names:** Seeking Rents; Florida Politics; Florida Phoenix; Florida Bulldog; Tampa Bay Times; Miami Herald; Orlando Sentinel; WUSF; WLRN; Florida Trident; Politico Florida Playbook.

**National coverage for networks:** NOTUS; Punchbowl; Sludge; The Lever; The Intercept; ProPublica; Campaign Legal Center; Bloomberg; Forbes; Wall Street Journal; New York Times; Washington Post.

**Israel and foreign policy networks:** Haaretz; Times of Israel; Calcalist; Shomrim; The Forward; Jewish Currents; Jewish Insider. Always record which of these said what, because they disagree.

**Gambling:** Sports Handle; Legal Sports Report; CDC Gaming; Covers; CardPlayer.

**Energy:** Energy and Policy Institute; CLEO Institute; PSC filings.

**Education:** The 74; Chalkbeat; Step Up for Students reports; Florida DOE.

## Verification rules before a row goes live

- Two independent sources, or one primary filing, for any figure above $100,000.
- The filing itself for any figure that will appear in a headline, a tweet, or a video.
- Read the article body, not the search snippet. If the body could not be read, the row is Secondary and the URL goes in the could-not-verify list.
- For a contested claim, the row stores the allegation, the denial, and the sources for each. It never stores the allegation alone.
- For any timing claim, such as a gift days after a contract, store both dates in the Note and let the dates speak.
- Re-check every Provisional row on the next filing deadline. Florida political committees file weekly in the final month before an election and the full schedule is on the Division of Elections site.

## Flags that deserve their own search

- A gift within fourteen days of a contract award, bill signing, or appointment.
- A conduit committee that receives and gives the same amount in the same week.
- A committee at a mail drop address.
- The same treasurer across the subject's committees and a national figure's committees.
- A spouse or family company that sells into a program the office controls.
- Amended disclosures, especially amendments filed during a campaign.
- Vendors who are owed money by the government the subject would run.
- Trades in a sector regulated by the subject's committee.
- A candidate with millions from a bloc and no public position on that bloc's live issue.
- Donors who migrated from a rival or predecessor; record the date of the switch.

## Minimum effort by subject tier

**Tier 1, statewide executive or U.S. Senate:** all ten steps, hop two for every bloc, hop three for the top five donors. Expect 100 plus entities and 200 plus edges. The Donalds file ran to 131 entities and 231 edges on the board and 423 ledger rows.

**Tier 2, U.S. House, state cabinet, legislative leadership:** steps one through eight, hop two for the top three blocs.

**Tier 3, state legislator, county official:** steps one, two, four and five, hop two only for vendors with contracts.

**Entities rather than people, such as a super PAC, a company, or a tribe:** steps two, three, six and seven, treating the entity as the subject and its officers as hop one.

## Workflow that worked

Run the research in parallel by bloc, one researcher per bloc, each writing a notes file with four sections: takeaway, cited findings, inferences, gaps. Then one writer synthesizes the notes into the fixed structure above. Then a separate pass builds the import table from the notes, not from the narrative, so numbers are not transcribed twice. Keep the notes files; they are the audit trail and they hold the URLs the writer did not use.

Expect rate limits on FEC, OpenSecrets, the Florida Division of Elections, and most newspaper sites. Export filings in a browser session before the research sprint, and give researchers the exported files rather than asking them to scrape.

## Maintenance

- Re-run step two on every filing deadline for active subjects.
- Re-run step seven when a decision on the calendar lands, and record the outcome next to the donors who cared.
- Promote Provisional rows to Confirmed or delete them within a week of the confirming filing.
- When an outlet corrects or a court rules, update the Status and the Note; do not delete the history.
