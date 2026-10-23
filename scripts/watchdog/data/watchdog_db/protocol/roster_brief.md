# Roster brief: 2026 general election nominees and current officeholders

Today is Friday, October 23, 2026. The 2026 general election is November 3, 2026.

Goal: for each state assigned to you, produce a verified list of every person in these groups:

1. Every 2026 general election nominee for U.S. House in every district, U.S. Senate (regular and special elections), and Governor. Include Democratic and Republican nominees, and any independent or third party candidate who is genuinely competitive or polling above 5 percent. For top two or top four states (California, Washington, Alaska, Louisiana where relevant), list everyone who advanced to the general. If a race has a runoff still pending, list the runoff candidates and say so.
2. The current sitting governor of the state, even if not on the ballot.
3. Any change to the state's current U.S. House or Senate delegation since September 24, 2026: deaths, resignations, appointments, special election winners, vacancies. The incumbent roster at /home/claude/watchdog/out/roster/incumbents_congress.csv is current as of September 24, 2026; check your states against it.

Sources: Ballotpedia works well through WebFetch. Useful pages: "United States House of Representatives elections in STATE, 2026", "United States Senate election in STATE, 2026" and "United States Senate special election in STATE, 2026", "STATE gubernatorial election, 2026". Ballotpedia pages are long and WebFetch may truncate, so ask the fetch prompt for just the general election candidates, and fetch the per district page such as "STATE's 3rd Congressional District election, 2026" when the statewide page is truncated. WebSearch is the fallback. Do not use your memory for nominees; primaries in 2026 ran into September, so verify every name from a source fetched now. en.wikipedia.org, fec.gov and opensecrets.org are blocked for you; do not retry them.

Output: write one CSV with Python's csv module so quoting is correct, at the path given in your task. Columns, in this order:

person_id, name, party, state, district, office_sought, role, race_status, current_office, incumbent_in_seat, competitive_rating, source_url, notes

Rules for columns:
- person_id: STATE two letter code, a hyphen, then the lowercase name slug with hyphens, for example FL-byron-donalds. Use the name the candidate campaigns under. For people already in incumbents_congress.csv reuse that file's person_id exactly.
- party: Democrat, Republican, Independent, Libertarian, Green, or the party name as listed.
- district: district number for House, AL for at large, blank for Senate and Governor.
- office_sought: U.S. House, U.S. Senate, U.S. Senate special, Governor, or blank for a sitting governor not on the ballot and for delegation members not running for anything in 2026.
- role: incumbent, challenger, open seat, sitting governor not running, delegation member not running, delegation member running for other office.
- race_status: nominee, advanced top two, runoff pending, primary pending, withdrawn after nomination, or not on ballot.
- current_office: what they hold now, for example U.S. House FL-19, State Senator, Attorney General, none.
- incumbent_in_seat: name of the current holder of the seat being sought.
- competitive_rating: Cook, Sabato or Inside Elections rating if you can find it quickly, otherwise blank.
- source_url: the page you verified the row from.
- notes: one short line, for example "replaced Lindsey Graham by appointment Oct 2026" or "self funding".

Include every current member of the state's House and Senate delegation as a row too, even when they are retiring or running for something else, with role delegation member not running or delegation member running for other office. A person appears once per office sought; a House member running for governor gets one row with office_sought Governor.

When done, reply with: the CSV path, row count, anything you could not verify, and a list of any delegation changes since September 24, 2026.
