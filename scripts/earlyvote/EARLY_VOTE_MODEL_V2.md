# Early vote party estimate, version 2

Built October 1 2026 on the fc_v47 forecast run and the October 1 early vote feed.

## The problem it solves

Fourteen states report their early ballots with no party attached:
- Hawaii and Vermont;
- Illinois, Indiana, Maryland on requests, Michigan and Minnesota;
- Mississippi, Montana, North Dakota and Ohio;
- Virginia, Wisconsin, and Idaho on requests.

These states hold 6.7 million of the 17.0 million mail ballot requests in the feed. The Early Vote page estimates the party mix of those ballots county by county, with simulation ranges.

## What was wrong with version 1

1. **It ran on a different electorate than the forecast.**
   - Version 1 rebuilt each county from its 2024 Trump share plus the swing inside the TPSI sample, about two points toward Democrats.
   - The forecast runs on D+12.
   - So the early vote page and the forecast disagreed on who is voting.
2. **It treated every request as a self selected mail voter.**
   - In Vermont and Hawaii every registered voter is mailed a ballot, so a request is the voter file.
   - Version 1 put the full mail skew on Vermont and Hawaii and read their requests as D+59 and D+53.
3. **One skew for every state.**
   - It took no account of permanent mail lists or excuse requirements.
   - Indiana and Mississippi limit mail ballots mostly to voters 65 and older.
4. **It had no way to use the demographics a state publishes.**
   - Michigan reports its requests by age.
5. **Its check compared party identification with party registration directly.**
   - That is why Kentucky and Oklahoma looked so far off.

## How version 2 works

**1. The forecast's electorate.**
- Every county starts from the 1,152 voter types the forecast simulates in it, each with its turnout chance in the D+12 environment.
- The types are by age, race, college, party, vote history and Trump approval.
- Five states with no 2026 statewide race fall back to a regression of county party mix on 2024 lean, fitted on every forecast county: Indiana, Missouri, North Dakota, Utah and Washington.

**2. Ballot rules by state, from the NCSL tables.**

| Rule | States in the no party group |
|---|---|
| Every voter is mailed a ballot | Hawaii, Vermont |
| Permanent mail list open to any voter | Illinois, Maryland, Michigan, Minnesota, Montana, Virginia |
| Any voter can request | Idaho, North Dakota, Ohio, Wisconsin |
| Excuse needed, most often age | Indiana, Mississippi |

**3. How each voter type votes.**
- A multinomial logit on 2,313 TPSI likely voters with a definite plan gives every type its chance of voting by mail, early in person or on Election Day.
- The inputs are party, age, race, college, vote history, local lean and the state's rule. Party and age effects are allowed to differ by rule.
- A county's mail voters are its forecast voters times their mail chance, type by type.
- In a universal mail state, a request is a registered voter. The registration chance is set so that each state's file matches the feed's request count. The eventual returns are the electorate itself.

TPSI likely voters by state rule:

| Rule | Mail | Early in person | Election Day |
|---|---|---|---|
| Universal | 45 | 13 | 42 |
| Permanent list | 23 | 11 | 67 |
| Request | 14 | 17 | 69 |
| Excuse | 6 | 22 | 72 |

Among voters 65 and older, mail runs 66, 40, 25 and 14 percent across the same four rules.

**4. Calibration on states that publish party.**

Florida, North Carolina, Pennsylvania and New Jersey report requests by party and publish registration. The check compares two tilts, in log odds of Republican to Democratic:
- **Reported:** requesters against registered voters.
- **Model:** mail voters against the whole electorate.

| State | Reported | Model, uncalibrated | Model, that state held out |
|---|---|---|---|
| Florida | −0.55 | −0.60 | −0.61 |
| North Carolina | −0.90 | −0.58 | −0.55 |
| Pennsylvania | −0.97 | −0.83 | −0.74 |
| New Jersey | −0.70 | −0.89 | −0.99 |

- The best scale is 0.99, so the mode model's skew is kept as fitted.
- Leaving any one state out moves the scale by at most 0.12.
- The spread across states, about 0.25 in log odds, is the honest error for a single state, and the simulation carries it.

**5. Demographic raking.**
- Party mixes by age and by race ship for every state and mode.
- When a state publishes its ballots by age or race, as Michigan does by age, the page reweights the estimate to the actual mix.
- Feed age bands are split across the model's four bands by the years they share.

**6. Returned ballots.**
- Party return rates are still measured live from the states that publish party on both requests and returns.
- Universal mail states now take their own return rates, once Colorado or Nevada post returns.
- In a universal mail state, a county's return rate is read against the share of ballots that will ever come back, about the forecast's turnout, not against every ballot mailed. That way the early season tilt fades as returns approach turnout.

**7. The live check on Maryland and Idaho returns now compares tilts, not levels.**
- Idaho's registration runs far more Republican than its party identification, because of its closed primary. Version 1 read that as a model error and shifted every state's returns 0.32 toward Republicans.
- On tilts:
  - Idaho's model comes in about right, 0.17 too mild.
  - Maryland's comes in 0.51 too steep.
- Held out tests show the two disagree: calibrating on one moves the other further off.
- The shift is now shrunk by that disagreement as well as by ballot volume, and stands at 0.04.

**8. Uncertainty.** Each of the 200 draws refits the mode model on a bootstrap resample, draws the skew scale from its leave one out spread, and adds a state party shock of 0.05 in log odds.

## Results on the October 1 feed

Nationwide, reported party plus the estimate:

| | Version 1 | Version 2 |
|---|---|---|
| Requested | D+19.8 | D+19.4, range D+22.6 to D+16.9 |
| Returned | D+42.8 | D+47.1, range D+52.6 to D+41.7 |

By state, with counties weighted by adults; the page itself weights by each county's reported ballots:

| State | Rule | Requests, v1 | Requests, v2 | v2 80 percent range | In person, v1 | In person, v2 |
|---|---|---|---|---|---|---|
| Hawaii | universal | D+53.3 | D+19.5 | D+21.6 to D+17.4 | D+40.9 | D+14.8 |
| Vermont | universal | D+59.3 | D+35.0 | D+36.6 to D+33.4 | D+49.4 | D+33.4 |
| Illinois | permanent | D+39.2 | D+43.6 | D+52.8 to D+36.1 | D+26.8 | D+32.1 |
| Maryland | permanent | D+53.3 | D+59.5 | D+67.2 to D+53.5 | D+43.6 | D+50.2 |
| Michigan | permanent | D+25.0 | D+31.7 | D+42.6 to D+22.4 | D+9.6 | D+19.0 |
| Minnesota | permanent | D+29.5 | D+36.3 | D+46.4 to D+28.0 | D+15.8 | D+23.7 |
| Montana | permanent | D+0.1 | D+9.4 | D+21.4 to R+0.4 | R+15.9 | R+4.8 |
| Virginia | permanent | D+31.6 | D+34.7 | D+44.4 to D+26.4 | D+18.8 | D+23.1 |
| Idaho | request | R+24.6 | R+22.0 | R+11.8 to R+30.6 | R+39.2 | R+31.9 |
| North Dakota | request | R+21.7 | R+20.9 | R+10.4 to R+28.9 | R+36.6 | R+29.3 |
| Ohio | request | D+11.6 | D+16.1 | D+26.0 to D+7.6 | R+3.3 | D+8.2 |
| Wisconsin | request | D+24.0 | D+25.7 | D+34.8 to D+18.3 | D+8.9 | D+18.3 |
| Indiana | excuse | D+2.5 | D+9.0 | D+20.5 to R+2.6 | R+12.9 | R+18.9 |
| Mississippi | excuse | R+3.9 | R+3.9 | D+6.7 to R+14.9 | R+18.5 | R+28.8 |

- Hawaii and Vermont move the most, as their requests are now read as the voter file.
- Most other states move a few points toward Democrats, because the electorate is now the forecast's D+12 electorate.
- The ranges are wider than in version 1. That is deliberate: the calibration states differ from each other by about that much.

## Limits

- **Party identification, not registration.** Figures cannot be compared one to one with registration counts.
- **Small cells.** The excuse states rest on few TPSI mail voters, about 30. Their party and age effects lean on the national fit through the penalty on the rule interactions.
- **Registration totals are typed in.** They come from the state releases and need refreshing: Florida August 31, North Carolina January 3, Pennsylvania August, New Jersey November 2025, Maryland August, Idaho October 1.
- **The calibration is fixed at build time.** It uses October 1 requests. Rebuilding the file as requests grow will refresh it.

## Files

- `scripts/earlyvote/build_party_model.py`: version 2. Version 1 is kept as `build_party_model_v1.py`.
- `public/earlyvote-party-model.json`: 800 KB, with no respondent level data.
- `app/maps/early-vote/lib.ts` and `EarlyVoteDesk.tsx` on OnPoint; `app/earlyvote/` on the TPSI copy.

Rebuild with:

```
TPSI_DB=TPSI_Unified_Respondent_Dataset.csv TPSI_COUNTY=TPSI_Trump_Approval_By_County_Combined_FULL.csv FC_DIR=/tmp/fc_v47 python3 scripts/earlyvote/build_party_model.py
```
