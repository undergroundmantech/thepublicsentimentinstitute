# Governor depolarization backtest, Sept 28 2026

- `collect.py` pulls each race's statewide history from `senate_mode.history` and the presidential frames into `history_statewide.csv`.
- `fit.py` fits governor and Senate races on the national House environment, the state's presidential lean and, for governors, the incumbent party. It writes `gov_fit.csv`.
- `loyo.py` scores fixed and fitted settings leaving one cycle out.

Incumbent party running, 2014, 2018 and 2022, is coded by hand in `fit.py`. The scripts use the absolute paths of the machine they ran on; change the paths at the top to rerun them.
