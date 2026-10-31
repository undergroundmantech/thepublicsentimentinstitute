# L2 Early Vote Scraper

Pulls every state file behind early.l2datamapping.com. Each file holds counties, congressional districts, State House and State Senate districts and the statewide total, each with all registered voters, early ballots requested and early ballots returned, broken out by party, age, gender, ethnicity, marital status, income, urban and rural code, and phone and email availability.

## Run in Codespaces

    pip install -r requirements.txt
    python l2_early_scraper.py

Options:

    python l2_early_scraper.py --states FL,GA,NC
    python l2_early_scraper.py --year 2024
    python l2_early_scraper.py --no-raw

## Output in data/latest

* county_summary.csv: one row per county with FIPS, totals, returned turnout, D, R and other shares of the returned vote and of registration, the D minus R margin of each, and ret_vs_rv_shift_pts, which is how much bluer or redder the returned vote is than the county's registration.
* demographics.csv: one row per area, dimension and category with registered, requested and returned counts, each group's share of each, its turnout rate, and how many points it is over or under represented among returned ballots.
* county_wide.csv: one row per county with every metric, dimension and category as its own column, ready for modeling.
* district_summary.csv: the county summary for congressional, State House and State Senate districts.
* statewide_summary.csv: the same summary for each state and the national total.
* long.csv: every count in one long table.
* metadata.csv: L2's data date and timestamp for each file.

Each run is also saved in a timestamped folder with the raw JSON. data/history keeps county, district and statewide summaries from every run, one copy per L2 update, for the early vote tracker.

Party columns treat Democratic as D, Republican as R and everything else as other. In states without party registration, L2's party field is modeled.

## Automatic pulls

The workflow in .github/workflows runs the scraper twice a day and commits the results once this folder is pushed to a repo with Actions turned on.

Data source: L2.
