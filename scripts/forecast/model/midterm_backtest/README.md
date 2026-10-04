# 2018 and 2022 midterm backtest, Oct 3 2026

The calibration behind the Oct 3 changes to the Senate and governor model.

- `data/`: every general election poll of the 2018 and 2022 Senate and governor races on Wikipedia, starting six weeks before each election (1,128 polls after duplicates are dropped), plus each race's certified result.
- `mt_data.py`: builds `mt_races.csv`, with one row per race 31 days out and on election eve. Each row holds the live model's polling average for that day, a presidential lean and incumbency fundamentals proxy, and the result.
- `mt_calib.py` and `mt_scale.py`: spread and poll weight, fit on one cycle and scored on the other.
- `mt_weights.py`: the election eve anchor.
- `mt_house.py`: house effects, with each race left out of its own fit, over a grid of shrinkage strengths.
- `mt_corr.py`: how the misses were shared between races.
- `mt_undecided.py`: undecided break rules.
- `avg_shift.py`: how far each 2026 race's polling average moves with the poll adjustments.

Scripts expect the model folder layout in the forecast scratch copy. Paths are at the top of each file.
