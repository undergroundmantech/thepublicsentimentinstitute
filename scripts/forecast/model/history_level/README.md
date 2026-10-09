# Office history level, Sept 29 2026

Each Senate and governor race now reads its own last two results for that office when setting the statewide level.

## How the level is built

- `table.py` builds `hist_level.json` from `../depolarization/history_statewide.csv`.
- Each of the last two results for the same office is moved to 2026 by:
  - the change in the national House environment since that year, in full for the Senate and at 0.6 for governors;
  - the change in the state's presidential lean;
  - for governors, the change in incumbency.
- The most recent result is weighted 0.65 and the one before it 0.35.
- The table is recentered so its median matches the model. The history adds each state's own habit for the office, not a second national environment.

## How it enters the model

The level blends into the statewide target in `senate_mode.py`.

| Setting | Weight on the statewide level |
|---|---|
| Senate, no polls or one polling house | 0.20 |
| Governor, no polls or one polling house | 0.30 |
| Open seat | 0.4 of the above |

The weight fades by three quarters as a race reaches eight polling houses.

Environment switches:

- `HIST_LEVEL=0` turns the term off.
- `HIST_H_SEN`, `HIST_H_GOV` and `HIST_H_OPEN` set the weights.

## Backtest

`bt.py` scores each blend weight h, leaving the target year out of the fundamentals fit. The fundamentals stand-in is the national environment plus the state's presidential lean, plus incumbency for governors.

| | Target years | Races | Error with no history | Best h | Error at best h |
|---|---|---|---|---|---|
| Governor | 2018 and 2022 | 71 | 16.8 points | 0.6 | 13.5 points |
| Senate | 2014 and 2020 | 54 | 13.4 points | 0.4 | 10.9 points |

Errors are root mean square, in points of margin.

In the polarized 2020 Senate cycle the best h was only 0.2. The live model's fundamentals are much stronger than this stand-in, so the weights are set below the backtest optimum.
