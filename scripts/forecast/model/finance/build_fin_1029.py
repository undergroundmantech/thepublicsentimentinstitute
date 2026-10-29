"""Oct 28 2026 late, at the user's request: Senate Majority PAC affiliates' last major buy, $61.3M, added to the
Democratic side's outside money in nine Senate races on top of fin_1025d. Spending per voter is updated for those
races; the statewide reference mean and spread stay as in fin_1025d, so every race is still measured against the same
yardstick as the races not rerun."""
import json, os, numpy as np
SRC, OUT = "/tmp/fcrun/fin_1025d", "/tmp/fcrun/fin_1029"
SMP = {"OH": 21663173, "MI": 8292300, "TX": 8051212, "IA": 7602763, "KS": 5730807,
       "ME": 4411105, "AK": 2337808, "NH": 2152416, "MS": 1028583}
LABEL = "outside for, Senate Majority PAC affiliates final buy Oct 28"
s = json.load(open(f"{SRC}/sen_finance.json")); r = json.load(open(f"{SRC}/fin_ref.json"))
for st, amt in SMP.items():
    D = s[st]["D"]
    D["outside_for"] = float(D["outside_for"]) + amt
    D["individual"] = float(D["individual"]) + amt
    D["items"] = D["items"] + [[LABEL, float(amt)]]
    D["smp_final_buy_1028"] = float(amt)
    rec = r["statewide"][st]; rec["total"] = float(rec["total"]) + amt; rec["spv"] = rec["total"] / rec["voters"]
for name, obj in (("sen_finance.json", s), ("fin_ref.json", r)):
    p = f"{OUT}/{name}"
    if os.path.exists(p): os.unlink(p)
    json.dump(obj, open(p, "w"), indent=1)
print("added", sum(SMP.values()), r["statewide_ref"], {k: round(r["statewide"][k]["spv"], 1) for k in SMP})
