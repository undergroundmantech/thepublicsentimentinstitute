"""Builds public/voterreg/county_party.json: every county's party counts [Democrats, Republicans, unaffiliated, other]
by FIPS, from the per state files in public/voterreg/counties, so the nationwide county map can shade party lead and
the unaffiliated share without loading every state. Units that are not counties, towns or house districts, are left out.
Run from the repo root: python3 -I scripts/voterreg/build_county_party.py
"""
import json, os
D = os.path.join("public", "voterreg", "counties")
out = {}
for f in sorted(os.listdir(D)):
    for u in json.load(open(os.path.join(D, f))).get("counties", []):
        p = u.get("party")
        if u.get("fips") and p:
            out[u["fips"]] = [p["DEM"], p["REP"], p["UNA"], p["OTH"]]
json.dump(out, open(os.path.join("public", "voterreg", "county_party.json"), "w"), separators=(",", ":"))
print(len(out), os.path.getsize("public/voterreg/county_party.json"))
