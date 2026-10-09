# County trend carry

Run of October 1 2026. Every Senate, governor and House race was re-run with this change.

## What was there before

The only county trend in the model was inside the office history leg. That leg took half the difference between the state's last two races for the office, times 0.55. The census leg started from the 2024 presidential result and carried no trend at all. A county that had moved the same way in 2016, 2020 and 2024 was projected as if it had stopped moving.

## What it does now

**Presidential trend.** Every county's lean relative to its state is measured twice:
- 2020 to 2024, weighted 0.6;
- 2016 to 2020, weighted 0.4.

The more recent cycle counts more.

**The 2026 primary decides how much of that trend to trust.** The county's 2026 primary electorate, relative to the state's, is compared with its 2024 general election lean.
- Where the primary moved the same way as the trend, up to 1.5 times the trend is carried.
- Where it moved the other way, as little as 0.5 times.
- Primary data was available and used in all 71 statewide races.

**How much carries.**

| Leg | Before | Now |
|---|---|---|
| Census leg, presidential trend | none | 0.35 of one cycle |
| Office history leg, presidential trend | none | 0.175 of one cycle |
| Office history leg, the office's own trend | 0.55 | 0.65 |
| House districts, 2020 to 2024 presidential trend | none | 0.60 of one cycle, primary weighted |

A midterm is about half a cycle after 2024, so a carry of 0.35 is a little more than straight line projection would give. No county term can pass 0.35 in log odds.

**The state level is untouched.** The trend term is centered on each state's turnout weighted mean. It moves votes between counties and never moves the statewide level that the polls and the national anchor set. Statewide margins moved by a mean of 0.01 points and at most 0.34, in Kentucky.

## Examples, Democratic margin

| County | Race | Before | After |
|---|---|---|---|
| Miami Dade, FL | Governor | D+15.1 | D+13.5 |
| Miami Dade, FL | Senate | D+12.6 | D+11.2 |
| Duval, FL | Governor | D+8.8 | D+9.8 |
| Webb, TX | Senate | D+39.4 | D+37.2 |
| Hidalgo, TX | Senate | D+29.5 | D+27.3 |
| Cameron, TX | Governor | D+12.6 | D+10.9 |
| Collin, TX | Senate | D+5.6 | D+6.2 |
| Kaufman, TX | Senate | R+27.8 | R+25.0 |
| Ellis, TX | Governor | R+33.0 | R+30.9 |

Heavily Latino counties continue their move to the right, and fast growing suburbs and exurbs continue their move to the left. In the House, New York City districts move toward Republicans, and upstate and suburban districts toward Democrats.

## Effect on the forecast

| | Before | After |
|---|---|---|
| Senate control counting Osborn | 77.3 percent | 77.9 percent |
| Senate control without Osborn | 74.5 percent | 75.5 percent |
| Governor control | 87.1 percent | 88.7 percent |
| House control | 89.8 percent, mean 245.6 seats | 89.2 percent, mean 246.2 seats |

Largest statewide win probability moves:
- Ohio governor, Acton: 65.6 to 67.8.
- Wisconsin governor, Crowley: 79.0 to 80.4.

House districts that changed favorite:
- PA-1, Democratic chance 50.3 to 47.4.
- ME-2, Democratic chance 51.6 to 49.8.

Largest House moves:
- NY-15: 67.4 to 58.8.
- NY-19: 9.9 to 16.2.

## Limits

- Trends do not always continue. The Latino shift of 2020 and 2024 partly reversed in some 2025 elections. The carry is held to about a straight line projection for that reason, and the primary weighting pulls it back where the 2026 electorate does not confirm it.
- A primary electorate is not a general electorate. The primary only scales the trend; it never sets the direction on its own.
- House districts hold only the 2020 and 2024 presidential results. They carry one trend leg and no office history.

## Files

- `trend.py`: the trend, the primary weighting and the centering.
- `senate_mode.py`: the census and office history hooks.
- `FLH/house_dyn.py`: the district term.
- `TREND_V2=0` restores the old behavior.
