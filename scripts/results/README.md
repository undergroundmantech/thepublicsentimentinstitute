# Results scripts

Run in this order after a forecast update:

1. `python3 scripts/results/build_2026_expected.py` writes public/results/2026/index.json and the per state files in public/results/2026/st.
2. `python3 scripts/results/build_globe_counties.py` writes public/results/2026/counties_ll.json for the monitor globe.
3. `node scripts/results/fix_globe_winding.mjs` reverses any county ring that d3 would read as covering the whole globe. Always run it after step 2, or zoomed states fill with colour.

## Test returns

Before the first polls close at 2026-11-03T23:00Z, civicAPI publishes test returns. The monitor and every race desk hide them until then. Add `?test=1` to any monitor or race URL to preview the test returns; a banner marks them as test data.

## House districts on the monitor

`node scripts/results/build_globe_districts.mjs` turns the forecast district map in public/forecast/geo.json back into longitude and latitude and writes public/results/2026/districts_ll.json. Rerun it whenever geo.json changes.
