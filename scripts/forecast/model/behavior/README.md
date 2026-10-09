# TPSI voter behavior layer

Run of September 29 2026. Every Senate, governor and House race was re-run with this layer. The House also took the new district polls listed at the end.

## What the layer does

Every simulated voter type is built from real TPSI respondents who share its age, race, education, party and vote history. The layer reads six turnout motivations from those respondents, gives each voter type its own reasons to vote, lets every simulation move those reasons, and estimates how loosely each type holds its party vote.

| Motivation | Read from |
|---|---|
| Commitment | stated likelihood of voting, a concrete ballot plan, already voted |
| Habit | past voting in 2018 to 2024 |
| Social | how many close friends and family will vote |
| Intensity | strongly or somewhat approving or disapproving of Trump |
| Grievance | difficulty affording daily costs, and wrong track |
| Activation | strong answers on the niche questions: mass deportation, a candidate taking pro Israel PAC money, who is to blame for the Kirk assassination, the groyper question, and a wide gap in trust between the parties |

## Why voters show up

A ridge fitted model of each respondent's TPSI likely voter score on the six motivations, plus age, race, college and party, gives each motivation's weight in log odds per standard deviation. It fits the score closely, with a correlation of 0.90 across 4,118 respondents.

| Motivation | Weight |
|---|---|
| Habit | 1.21 |
| Commitment | 1.00 |
| Social | 0.77 |
| Intensity | 0.13 |
| Grievance | −0.05 |
| Activation | −0.12 |

The finding is clear. Once a respondent's voting habit, ballot plan and social circle are known, how strongly they feel about Trump adds only a little. Economic strain and strong niche opinions add nothing, and lean slightly the other way. Strong opinions on the niche questions do track engagement on their own: activation correlates 0.45 with commitment. But they do not bring out voters beyond what commitment already measures.

In every race, habit and commitment are the two leading reasons the projected electorate turns out at a higher rate than the adult population:
- Across the 71 statewide races, habit lifts the electorate by 0.53 to 0.93 in log odds, and commitment by 0.32 to 0.59.
- Each race note names that race's top two reasons.

## Turnout drops and coalition movement

Every simulation now draws a shock to the weight of each motivation, shared nationally with a spread of 0.25 of the weight, plus a state level shock of 0.15. Approval intensity has two separate shocks, one for approvers and one for disapprovers. That lets soft approvers stay home while strong disapprovers surge. The shocks change who votes, never how anyone votes.

Each race also reports deterministic scenarios. Over the 71 races, the two party margin moves by:

| Scenario | Mean | Range |
|---|---|---|
| Turnout 15 percent lower, falling on the least likely voters | R+0.8 | R+1.9 to D+2.2 |
| Everyone in the voter file votes | D+8.2 | R+9.7 to D+18.4 |
| Low commitment voters stay home | R+0.3 | R+1.2 to D+1.5 |
| Commitment matters less, a surge of irregular voters | D+0.7 | R+2.1 to D+2.2 |
| Soft Trump disapprovers stay home | D+0.3 | D+0.1 to D+0.4 |
| Soft Trump approvers stay home | D+0.05 | D+0.0 to D+0.1 |

The coalition story is consistent across states:
- A lower turnout electorate is more partisan and less independent. In New Hampshire, a 15 percent drop raises the Democratic share of voters by 0.8 points, raises the Republican share by 0.7 points and lowers the independent share by 1.5 points.
- A high turnout electorate is younger, more independent and more Democratic.

The same turnout drop and low commitment scenarios are written for every House district in `behavior_turnout_drop_shift` and `behavior_low_commitment_shift`. Their means are R+0.4 and D+0.1.

## Ticket splitting

TPSI respondents who reported a 2024 vote and gave a 2026 generic ballot choice switched party 6.8 percent of the time:

| Party and vote history | Switched |
|---|---|
| Democrats who voted in both 2022 and 2024 | 4.6 percent |
| Republicans who voted in both 2022 and 2024 | 5.5 percent |
| Independents who voted in both | 7.9 percent |
| Independents who voted only in 2024 | 13 percent |
| Irregular voters of either party | 13 to 17 percent |

Each voter type votes Democratic for Senate with probability pS and for governor with probability pG. The share voting Democratic in both races is set between two limits: the least splitting those two chances allow, and the most. It sits at the type's own looseness from the switching table:

P of both Democratic = min of pS and pG, less looseness × that minimum less the floor, where the floor is the larger of zero and pS + pG − 1.

Applied back to the respondents' own 2024 and 2026 choices, this reproduces their switching rate. The same switching rate also sets how much of the state level shock a state's Senate and governor races share: 1 less 3 × the electorate's switch rate, between 0.5 and 0.92. That is 0.80 in New Hampshire.

| State | Split ticket voters, percent | Largest split pairing | Other pairing | Least possible | Simulations with a split result |
|---|---|---|---|---|---|
| Alaska | 23.1 | Sullivan and Kreiss-Tomkins 21.1 | Peltola and Wilson 2.0 | 19.2 | 39.3 |
| Idaho | 13.4 | Achilles and Little 10.3 | Risch and Pickens 3.1 | 7.7 | 1.6 |
| New Hampshire | 12.6 | Pappas and Ayotte 11.5 | Sununu and Warmington 1.1 | 10.5 | 91.9 |
| Oklahoma | 12.6 | Hern and Munson 10.3 | Thomas and Mazzei 2.3 | 8.2 | 8.6 |
| Oregon | 11.3 | Merkley and Drazan 10.4 | Smith and Kotek 1.0 | 9.4 | 2.9 |
| Nebraska | 10.5 | Osborn and Pillen 8.5 | Ricketts and Walz 2.1 | 6.7 | 58.7 |
| Wyoming | 10.0 | Hageman and Casner 7.2 | Byrd and Barlow 2.8 | 4.9 | 0.1 |
| Alabama | 9.1 | Moore and Jones 6.5 | Wess and Tuberville 2.5 | 4.5 | 2.6 |
| Tennessee | 8.9 | Hagerty and Green 6.8 | Bradshaw and Blackburn 2.1 | 4.8 | 2.7 |
| Iowa | 8.5 | Hinson and Sand 5.7 | Turek and Lahn 2.8 | 3.8 | 23.6 |
| Texas | 8.4 | Talarico and Abbott 6.4 | Paxton and Hinojosa 2.0 | 4.5 | 51.8 |
| South Dakota | 8.3 | Rounds and Ahlers 5.4 | Bengs and Rhoden 2.9 | 3.0 | 13.4 |
| South Carolina | 8.0 | Andrews and Wilson 4.8 | Graham and Johnson 3.2 | 2.7 | 25.9 |
| Florida | 7.9 | Moody and Jolly 5.4 | Nixon and Donalds 2.5 | 3.3 | 39.5 |
| Ohio | 7.8 | Brown and Ramaswamy 5.3 | Husted and Acton 2.5 | 3.0 | 26.4 |
| Kansas | 7.7 | Hamilton and Masterson 4.4 | Marshall and Holscher 3.3 | 2.9 | 30.2 |
| Arkansas | 7.6 | Cotton and Love 3.9 | Shoffner and Sanders 3.7 | 1.7 | 0.8 |
| Massachusetts | 7.4 | Markey and Minogue 5.6 | Deaton and Healey 1.8 | 4.1 | 0.0 |
| New Mexico | 7.3 | Lujan and Hull 5.3 | Marker and Haaland 1.9 | 3.6 | 1.9 |
| Georgia | 7.2 | Ossoff and Jackson 5.4 | Collins and Bottoms 1.8 | 4.1 | 32.0 |
| Maine | 6.9 | Collins and Pingree 5.6 | Jackson and Charles 1.4 | 4.4 | 25.2 |
| Colorado | 6.7 | Hickenlooper and Marx 4.7 | Baisley and Weiser 2.0 | 3.0 | 0.5 |
| Rhode Island | 6.2 | McKay and Foulkes 3.5 | Reed and Guckian 2.7 | 1.9 | 0.0 |
| Illinois | 6.0 | Stratton and Bailey 4.0 | Tracy and Pritzker 2.0 | 2.3 | 0.0 |
| Michigan | 5.7 | Rogers and Benson 3.2 | El-Sayed and James 2.5 | 1.6 | 16.8 |
| Minnesota | 5.4 | Tafoya and Klobuchar 3.3 | Flanagan and Demuth 2.2 | 2.2 | 3.1 |

Split voters are mostly independents and voters with irregular histories. In New Hampshire 30 percent of independents split, against 10 percent of Democrats and 8 percent of Republicans. Where one party's candidate runs well ahead of the other race, that party's opponents supply most of the splitters, as Republicans do for Osborn and Brown. The run summary holds each state's split by party, approval, age, race and vote history, and its five heaviest splitting counties.

## Effect on the forecast

| | Before | After |
|---|---|---|
| Senate control counting Osborn | 78 percent | 79 percent |
| Senate control without Osborn | 77 percent | 77 percent |
| Governor control | 87 percent | 86 percent |
| House control | 90 percent | 89 percent, mean 245 seats |

- Statewide margins moved by at most 0.5 points; the mean was D+0.1.
- The 80 percent outcome ranges widened by an average of 0.2 points, as the turnout shocks add real uncertainty about who votes.
- The largest win probability moves were Nebraska Senate, from 55 to 59 percent for Osborn, and South Carolina governor, from 20 to 23 percent.

## New House polls

The House model took every general election district poll ending August 15 or later from the state pages and the poll trackers: 36 polls in 29 districts. They were entered by the same rule as the September 19 sweep:
- a 45 day recency half life;
- the square root of sample size, with a floor of 400;
- 0.7 for a partisan sponsor, and 1.5 points moved off each candidate against that sponsor;
- no poll at 20 percent undecided or more.

The previous entry for each district counts as one nonpartisan 500 sample reading dated August 15, so the older record still matters.

Districts polled for the first time: CO-8, NC-9, NC-11, NH-1, TN-5, TN-9, TX-15, TX-28, TX-34, TX-35 and VA-1. UT-2's two Crosby internals stayed out at 23 and 25 percent undecided.

| District | Before | After | Win chance for the Democrat, before and after |
|---|---|---|---|
| CO-8 | D+16.6 | D+7.7 | 99 and 85 |
| TX-15 | R+4.6 | D+1.0 | 25 and 55 |
| TX-35 | D+2.1 | R+1.7 | 62 and 39 |
| PA-1 | R+2.0 | D+0.1 | 38 and 51 |
| NH-1 | D+14.0 | D+8.7 | 97 and 89 |
| TX-34 | D+12.2 | D+7.1 | 97 and 86 |
| NC-11 | D+5.6 | D+2.4 | 80 and 65 |
| ME-2 | D+2.0 | D+0.3 | 62 and 52 |

## Limits

- TPSI has no question on a respondent's own Senate or governor vote. Ticket splitting therefore rests on switching between the 2024 vote and the 2026 generic ballot, applied to the model's own race by race preferences. A direct split ticket question in the next wave would test it.
- The motivation weights are fitted to the TPSI likely voter score, which is itself built from intent, ballot plan, history and contacts. Their large weights are partly by construction. The small weights on intensity, grievance and activation are the new evidence.
- The niche items were not asked in every wave; unasked items score as average.

## Files

- `behavior.py`: motivations, weights, looseness, the shock loadings and the race audit.
- `ticket_split.py`: pairs each state's Senate and governor voter types after a run.
- `dynamic_mode.py` and `house_dyn.py`: the simulation shocks.
- `house_mode.py`: the new district poll entries.
- `BEHAVIOR=0` turns the layer off.
