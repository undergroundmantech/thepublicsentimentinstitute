# County citizenship and realistic limits

Run of September 30 2026. Every Senate, governor and House race was re-run with both changes.

## 1. County citizen rates

**Source:** the Census Bureau's Citizen Voting Age Population special tabulation, 2020 to 2024 ACS five year, county level, released January 30 2026. It covers 3,144 counties.

**How it enters:**
- Each county's adults are multiplied by that county's own citizen share for four race groups.
- The groups are: White alone not Hispanic, Black alone not Hispanic, Hispanic, and everyone else as Asian and other.
- Each rate is pulled toward its state's rate with 300 adults of weight, so a county with only a few hundred Hispanic adults does not swing on sampling noise.

The single national rates were 0.985, 0.95, 0.77 and 0.80. The national totals from the new file are 0.984, 0.954, 0.743 and 0.804, so the national Hispanic rate was a little high. The county spread is what matters:

| County | Hispanic citizen share of adults |
|---|---|
| Bernalillo, NM | 0.90 |
| El Paso, TX | 0.84 |
| Maricopa, AZ | 0.77 |
| Webb, TX | 0.76 |
| Los Angeles, CA | 0.73 |
| Miami Dade, FL | 0.70 |

**Effect on each state's citizen electorate:**

| State | Citizen adults, before and after | Hispanic share of likely voters, before and after |
|---|---|---|
| New Mexico | 1.44M and 1.55M | 35.6 and 38.2 |
| Arizona | 5.25M and 5.34M | 19.7 and 20.2 |
| Texas | 20.11M and 19.90M | 27.2 and 27.0 |
| California | 26.62M and 26.19M | 28.2 and 27.8 |
| Florida | 16.48M and 16.18M | 19.6 and 19.4 |
| Nevada | 2.24M and 2.23M | 19.2 and 17.9 |
| Georgia | 7.90M and 7.84M | 6.3 and 5.1 |

The census leg moved by at most 0.4 points in any race. Its biggest effect is on who the modeled electorate is, so it shows up in the group tables, the ticket splitting and the turnout scenarios more than in the margins.

## 2. Realistic ceilings and floors

Every limit is read from data. Every limit is soft: inside the range nothing changes, and past it a value bends toward the limit and can pass it by at most 0.12 in log odds.

**County support.** A county's lean relative to its state is stable from cycle to cycle.
- Its 2026 ceiling and floor come from the most and least Democratic it has run relative to its state in every result the model holds for it. That means the 2016, 2020 and 2024 presidential results and its past races for this office.
- Extra room is added for the county's 2016 to 2024 trend, and for a 2026 primary whose electorate ran well to one side of the county's usual lean.
- When a county tops out, the statewide level the polls set is kept. The votes the capped county cannot give come from counties that still have room.
- 27 county projections topped out across all 71 races, out of 4,591.

**Turnout.**
- A county's 2026 turnout stays between 0.70 of its certified 2022 midterm turnout and the lesser of three ceilings: 1.35 times 2022, 1.02 times its 2024 presidential turnout, and 0.88 of its citizen adults.
- Six states had no Senate or governor race on their 2022 ballot: Delaware, Mississippi, Montana, New Jersey, Virginia and West Virginia. Their 2022 turnout was depressed, so their midterm ceiling is 1.6 times 2022.
- Every simulated voter type's turnout chance stays between 2 and 97 percent.
- 86 counties were capped, and none needed a floor.

**Group support inside a county.**
- A county can move each voter type from its national baseline only as far as TPSI respondents show that race and party group varying across the eight regions, plus 0.45 in log odds.
- Black Democrats vary little from region to region; white independents vary a great deal.
- A group that reaches its limit tops out, and the rest of the county has to move instead.
- On average 11 percent of a race's voters sit at their group's limit, with a median of 7 percent and the most in New Hampshire governor at 46 percent. The simulation shocks then move every voter from there, so the state's range of outcomes is not narrowed.

**Statewide group ranges.**
- Each group's center is its Pew validated two party vote from 2024 and 2020, moved by this year's national environment: +0.25 in log odds from the 2024 result to the model's 2026 anchor.
- The range around that center is 0.35 in log odds, plus the TPSI regional spread for the group capped at 0.25.
- White voters vary too much by state for any honest statewide limit. They have none, and they absorb what the other groups cannot.

| Group | Pew 2024 | Pew 2020 | 2026 floor | 2026 ceiling |
|---|---|---|---|---|
| Black | 84.7 | 92.0 | 79.5 | 96.4 |
| Hispanic | 51.5 | 62.9 | 42.7 | 79.8 |
| Asian and other | 58.8 | 70.0 | 50.1 | 84.5 |

**Where the Black floor bound.** In 38 races, Black voters had come out of the model below 79.5 percent Democratic. The TPSI panel itself has Black respondents at only 76 percent Democratic on the generic ballot, and Pew's validated 2024 vote was 85.

| Race | Black Democratic share, before | After |
|---|---|---|
| Mississippi Senate | 70.2 | 78.5 |
| Alabama Senate | 71.4 | 78.8 |
| Louisiana Senate | 72.8 | 79.1 |
| Texas Senate | 73.4 | 79.4 |
| South Carolina Senate | 74.8 | 79.2 |
| Vermont governor | 54.4 | 79.7 |

Georgia governor, at 80.7, was already inside its range. The Asian and other floor bound in six races. The Hispanic range never bound.

Both crosstab builders and the simulated voter types use the same limits. The group tables on the race pages therefore show the topped out groups.

## Effect on the forecast

| | Before | After |
|---|---|---|
| Senate control counting Osborn | 78 percent | 78 percent |
| Senate control without Osborn | 76 percent | 76 percent |
| Governor control | 86 percent | 87 percent |
| House control | 89 percent | 89 percent, mean 245.5 seats |

Statewide margins moved by at most 0.3 points, in West Virginia. The limits mainly change how each race's vote is spread across counties and groups, not the toplines the polls set.

## Limits of this component

- The group support bands come from TPSI regional samples, which are small for Black, Hispanic and Asian independents. The bands are widened in any county they cannot otherwise fit, which happened in up to 75 counties in a race and in none in others.
- The Black floor is deliberately lenient at 79.5 percent, because TPSI's own panel runs below validated vote studies. A floor closer to 85 would follow Pew more tightly and TPSI less.
- House districts get the turnout limits for voter types and the county citizen rates. They do not get a district support envelope, because the model holds only one or two past results per district.

## Files

- `bounds.py`: the limits.
- `respondent_v2.py`: the county citizen rates.
- `census/cvap_county_2020_2024.csv`: the compact county table.
- `senate_mode.py`, `dynamic_mode.py`, `voters.py`, `crosstabs.py` and `house_dyn.py`: the hooks.
- `BOUNDS=0` turns the limits off, and `CVAP_COUNTY=0` restores the national citizen rates.
