On Point Politics: 2026 results vs. final forecast

1. Install:   pip install requests
2. Run:       python3 compare_results.py --counties
3. Send back: the results_out folder, zipped

Without --counties it does statewide and district results only, which takes under a minute.
With --counties it also compares every county, about 500 civicAPI reads and a few minutes.
Run it again later to pick up more counted votes. It saves every read in results_out/civic_raw.
To rerun from saved reads with no network: python3 compare_results.py --counties --civic-dir results_out/civic_raw
