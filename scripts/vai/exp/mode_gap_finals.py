#!/usr/bin/env python3
"""Statewide vote-method gaps from the MEDSL method aggregates (final precinct returns summed by the source's own mode label).

Class: DERIVED_FROM_FINALS. These are end-of-count totals by ballot method. They are NOT point-in-time releases: they say how
different the methods' electorates are, not in what order, or how big, the batches arrived. They bound the order of magnitude of
the early-versus-late selection gap sigma_g; they do not estimate it. No county dispersion exists in this input, so rho_gap cannot be
estimated from it.

gap_log = log((B_m + 0.5)/(A_m + 0.5)) - log((B_ed + 0.5)/(A_ed + 0.5)) for each non-election-day method m with at least 5,000 two-party votes,
side A = D, side B = R. Usage: mode_gap_finals.py <medsl-agg.json> <out.json>
"""
import hashlib
import json
import math
import sys

src, out = sys.argv[1], sys.argv[2]
raw = open(src, "rb").read()
d = json.loads(raw)
ED = {"ELECTION DAY", "ELECTION_DAY"}
rows = []
for c in d["contests"]:
    m = c["modes"]
    ed = next((m[k] for k in m if k in ED), None)
    if not ed or ed["D"] + ed["R"] < 5000:
        continue
    for k, v in m.items():
        if k in ED or k == "TOTAL" or v["D"] + v["R"] < 5000 or "," in k or "/" in k:
            continue
        gap = math.log((v["R"] + 0.5) / (v["D"] + 0.5)) - math.log((ed["R"] + 0.5) / (ed["D"] + 0.5))
        rows.append({"year": c["year"], "state": c["state"], "office": c["office"], "district": c["district"], "method": k,
                     "twoParty": v["D"] + v["R"], "shareOfTwoParty": None, "gapLogRB": round(gap, 4)})
    tot = sum(r["twoParty"] for r in rows if (r["year"], r["state"], r["office"], r["district"]) == (c["year"], c["state"], c["office"], c["district"])) + ed["D"] + ed["R"]
    for r in rows:
        if (r["year"], r["state"], r["office"], r["district"]) == (c["year"], c["state"], c["office"], c["district"]):
            r["shareOfTwoParty"] = round(r["twoParty"] / tot, 4)
abs_gaps = sorted(abs(r["gapLogRB"]) for r in rows)
q = lambda p: abs_gaps[min(len(abs_gaps) - 1, int(p * len(abs_gaps)))]
res = {
    "schema": "vai-mode-gap-finals/1",
    "class": "DERIVED_FROM_FINALS",
    "notPointInTime": True,
    "input": {"file": "medsl-agg.json", "sha256": hashlib.sha256(raw).hexdigest()},
    "definition": __doc__.split("gap_log =")[1].split("Usage")[0].strip(),
    "n": len(rows),
    "absGapQuantiles": {"q25": q(0.25), "median": q(0.5), "q75": q(0.75), "q90": q(0.9), "max": abs_gaps[-1]},
    "rows": rows,
    "interpretation": "Sample is the states where MEDSL labels methods (GA, AZ, IA, AK, SC, NY): a handful of states, not a random draw. v1 sigma_g (0.08 to 0.30) sits inside this range but is not estimated from it.",
}
open(out, "w").write(json.dumps(res, indent=1) + "\n")
print(len(rows), res["absGapQuantiles"])
