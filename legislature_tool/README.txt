On Point Politics: 2026 state legislative results vs. the final forecast

Pulls every State Senate and State House chamber from civicAPI, district by district, the same source the results desk
reads, and pairs each district with the final On Point state legislative forecast in public/forecast/statehouse.json.

1. Install:   pip install requests
2. Run, from the repo root:   python3 legislature_tool/compare_legislature.py
3. Send back: the leg_results_out folder, zipped

It reads 87 chambers, about two minutes. Run it again later to pick up more counted votes; delete leg_results_out/civic_raw
first so it reads fresh. To rerun from saved reads with no network:
python3 legislature_tool/compare_legislature.py --civic-dir leg_results_out/civic_raw
