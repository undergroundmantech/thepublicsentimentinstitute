"""Spending tracker data for the forecast desk: public/forecast/spending.json.

Where the money is going in every Senate, House and governor race, and where each
party is putting its weight. The measures are objective, read straight off the filings:

  money for each side   the nominee's campaign spending plus outside money for the
                        nominee or against the opponent, FEC cycle to date, from the
                        Oct 14 finance books the model uses (scripts/forecast/model/finance)
  outside money         independent expenditures for each side, from race_finance.csv
  party groups          the leadership super PACs each party's congressional leaders run
                        or fund: WinSenate and HMP for Democrats, SLF PAC, Security Is
                        Strength PAC and CLF for Republicans, from outside_spenders.csv
  focus share           the race's share of that side's national money in the chamber,
                        and of its party groups' money: the objective read of where each
                        party is putting its weight
  per voter             all money in the race over the 2024 presidential vote there

Governors do not file with the FEC. Their figures are the state filing totals in
gov_finance.json, whose reporting periods differ by state, so they are shown with their
period and are not ranked against each other on a common date.

Inputs
  FIN  folder with sen_finance.json, house_finance.json, gov_finance.json, fin_ref.json
       (default scripts/forecast/model/finance)
  PKG  folder with the finance package CSVs race_finance.csv and outside_spenders.csv
       (default scripts/forecast/model/finance/package); file names may carry a prefix
Run from the site root:  python3 scripts/forecast/build_spending.py
"""
import glob, json, os, math, re
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FIN = os.environ.get("FIN", os.path.join(ROOT, "scripts/forecast/model/finance"))
PKG = os.environ.get("PKG", os.path.join(FIN, "package"))
OUT = os.path.join(ROOT, "public/forecast/spending.json")
MODEL = os.path.join(ROOT, "public/forecast/model.json")


def pkg(name):
    hits = sorted(glob.glob(os.path.join(PKG, f"*{name}.csv")))
    if not hits:
        raise SystemExit(f"missing {name}.csv in {PKG}")
    return pd.read_csv(hits[-1], low_memory=False)


num = lambda x: 0.0 if x is None or (isinstance(x, float) and math.isnan(x)) else float(x)
r0 = lambda x: int(round(num(x)))

SEN = json.load(open(os.path.join(FIN, "sen_finance.json")))
HOU = json.load(open(os.path.join(FIN, "house_finance.json")))
GOV = json.load(open(os.path.join(FIN, "gov_finance.json")))
REF = json.load(open(os.path.join(FIN, "fin_ref.json")))
RF = pkg("race_finance").set_index("race")
OS = pkg("outside_spenders")
M = json.load(open(MODEL))

PARTY_GROUPS = {
    "D": {"WinSenate": "senate", "HMP": "house"},
    "R": {"SLF PAC": "senate", "Security Is Strength PAC": "senate", "CLF": "house"},
}
GROUP_LABEL = {"WinSenate": "WinSenate", "HMP": "House Majority PAC", "SLF PAC": "Senate Leadership Fund",
               "Security Is Strength PAC": "Security Is Strength PAC", "CLF": "Congressional Leadership Fund"}


def pkg_key(office, k, book):
    st = k[:2]
    if office == "senate":
        return f"{st}-S-00"
    fr = book.get("file_race") or k
    return f"{fr[:2]}-H-{fr[3:]}"


def outside_for(race_key, book):
    """Outside groups working for each side in one race, general election rows only:
    rows marked for a party, or for that side's nominee by FEC name."""
    rows = OS[OS.race == race_key]
    noms = {s: {f"for {n}" for n in (book.get(s, {}).get("fec_name") or [])} for s in ("D", "R")}
    out = {"D": {}, "R": {}}
    for _, r in rows.iterrows():
        h = str(r["helps"])
        side = h if h in ("D", "R") else next((s for s in ("D", "R") if h in noms[s]), None)
        if not side:
            continue
        out[side][r["spender"]] = out[side].get(r["spender"], 0.0) + num(r["total"])
    return out


def voters(office, k):
    if office == "house":
        return num(REF.get("house", {}).get(k, {}).get("voters")) or None
    key = k if office == "senate" else k + "G" if not k.endswith("G") else k
    v = REF.get("statewide", {}).get(key, {}).get("voters")
    return num(v) or None


races = {r["id"]: r for r in M["races"]}
by_office = {"senate": [], "house": [], "governor": []}

for office, book_all in (("senate", SEN), ("house", HOU)):
    for k, b in book_all.items():
        rid = f"sen-{k}" if office == "senate" else f"house-{k}"
        race = races.get(rid)
        if not race:
            continue
        pk = pkg_key(office, k, b)
        rf = RF.loc[pk] if pk in RF.index else None
        groups = outside_for(pk, b)
        side = {}
        for s in ("D", "R"):
            x = b.get(s, {})
            g = groups[s]
            party = {n: r0(v) for n, v in g.items() if n in PARTY_GROUPS[s]}
            top = sorted(((n, v) for n, v in g.items()), key=lambda t: -t[1])[:3]
            side[s] = {
                "total": r0(x.get("individual")),
                "campaign": r0(x.get("spent")),
                "outside": r0(x.get("outside_for")),
                "raised": r0(x.get("receipts")),
                "cash": r0(x.get("cash_on_hand")),
                "party": sum(party.values()),
                "partyGroups": party,
                "top": [[n, r0(v)] for n, v in top if v >= 1000],
                "mix": x.get("mix") or {},
            }
        ie = {"D": r0(rf["ie_pro_d"]) if rf is not None else None, "R": r0(rf["ie_pro_r"]) if rf is not None else None}
        tot = side["D"]["total"] + side["R"]["total"]
        v = voters(office, k)
        as_of = sorted({d for d in (b.get("D", {}).get("as_of") or []) + (b.get("R", {}).get("as_of") or []) if d},
                       key=lambda d: (d[6:], d[:2], d[3:5]))
        rec = {
            "id": rid, "office": office, "st": race["st"], "name": race["name"],
            "dem": race["dem"], "gop": race["gop"],
            "margin": race["est"]["margin"], "prob": race["est"]["prob"],
            "D": side["D"], "R": side["R"], "ie": ie,
            "total": tot, "perVoter": round(tot / v, 2) if v else None, "voters": r0(v) if v else None,
            "shareD": round(side["D"]["total"] / tot, 4) if tot > 0 else None,
            "asOf": as_of[-1] if as_of else None,
        }
        if office == "senate" and b.get("adimpact"):
            a = b["adimpact"]
            rec["adimpact"] = {k2: v2 for k2, v2 in a.items() if k2 not in ("source",)}
        by_office[office].append(rec)

for k, b in GOV.items():
    st = k[:2]
    rid = f"gov-{st}"
    race = races.get(rid)
    if not race:
        continue
    side = {}
    for s in ("D", "R"):
        items = b.get(s, {}).get("items") or []
        raised = next((num(v) for lab, v in items if v is not None and "raised" in str(lab).lower()), 0.0)
        cash = next((num(v) for lab, v in items if v is not None and "cash" in str(lab).lower()), 0.0)
        lab = next((str(l) for l, v in items if "raised" in str(l).lower()), "raised")
        ga = b.get("google_ads") or {}
        side[s] = {"raised": r0(raised), "cash": r0(cash), "raisedLabel": lab.strip(),
                   "googleAds": r0(ga.get("d" if s == "D" else "r")),
                   "assoc": r0(ga.get("dga" if s == "D" else "rga"))}
    tot = side["D"]["raised"] + side["R"]["raised"]
    v = voters("governor", st)
    by_office["governor"].append({
        "id": rid, "office": "governor", "st": st, "name": race["name"], "dem": race["dem"], "gop": race["gop"],
        "margin": race["est"]["margin"], "prob": race["est"]["prob"],
        "D": side["D"], "R": side["R"], "total": tot,
        "perVoter": round(tot / v, 2) if v else None, "voters": r0(v) if v else None,
        "shareD": round(side["D"]["raised"] / tot, 4) if tot > 0 else None,
        "basis": b.get("basis"), "checked": b.get("checked"), "source": b.get("source"),
    })

# focus shares: each race's share of a side's money in the chamber, and of its party groups
summary = {}
for office in ("senate", "house"):
    L = by_office[office]
    natl = {s: sum(r[s]["total"] for r in L) for s in ("D", "R")}
    natp = {s: sum(r[s]["party"] for r in L) for s in ("D", "R")}
    nato = {s: sum(r[s]["outside"] for r in L) for s in ("D", "R")}
    for r in L:
        r["focus"] = {s: round(r[s]["total"] / natl[s], 4) if natl[s] else 0 for s in ("D", "R")}
        # outside money moves to where a party thinks a seat is in play; a nominee's own
        # fundraising does not, so this is the headline read of each party's focus
        r["outsideFocus"] = {s: round(r[s]["outside"] / nato[s], 4) if nato[s] else 0 for s in ("D", "R")}
        r["oneParty"] = abs(r["margin"]) >= 99
        r["partyFocus"] = {s: round(r[s]["party"] / natp[s], 4) if natp[s] else 0 for s in ("D", "R")}
    groups = {s: {} for s in ("D", "R")}
    for r in L:
        for s in ("D", "R"):
            for n, v in r[s]["partyGroups"].items():
                groups[s][n] = groups[s].get(n, 0) + v
    summary[office] = {
        "D": natl["D"], "R": natl["R"], "partyD": natp["D"], "partyR": natp["R"], "outsideD": nato["D"], "outsideR": nato["R"],
        "groups": {s: [[GROUP_LABEL.get(n, n), v] for n, v in sorted(groups[s].items(), key=lambda t: -t[1])] for s in ("D", "R")},
        "races": len(L),
    }
    L.sort(key=lambda r: -r["total"])
G = by_office["governor"]
summary["governor"] = {"D": sum(r["D"]["raised"] for r in G), "R": sum(r["R"]["raised"] for r in G), "races": len(G)}
for r in G:
    r["focus"] = {s: round(r[s]["raised"] / summary["governor"][s], 4) if summary["governor"][s] else 0 for s in ("D", "R")}
G.sort(key=lambda r: -r["total"])

out = {
    "meta": {
        "built": M["meta"]["updated"],
        "fecThrough": max((r["asOf"] for o in ("senate", "house") for r in by_office[o] if r.get("asOf")),
                          key=lambda d: (d[6:], d[:2], d[3:5]), default=None),
        "partyGroups": {s: [GROUP_LABEL[n] for n in PARTY_GROUPS[s]] for s in ("D", "R")},
        "sources": [
            "FEC candidate and independent expenditure filings, cycle to date, via the finance package of Oct 14 2026",
            "State campaign finance filings for governors, periods as labeled",
            "AdImpact aired spending through Sept 30 2026 where noted",
        ],
    },
    "summary": summary,
    "races": by_office,
}
json.dump(out, open(OUT, "w"), separators=(",", ":"))
print(OUT, {o: len(v) for o, v in by_office.items()}, os.path.getsize(OUT))
for o in ("senate", "house"):
    print(o, "D", round(summary[o]["D"] / 1e6, 1), "R", round(summary[o]["R"] / 1e6, 1), "party", summary[o]["groups"])
    for r in by_office[o][:8]:
        print("  ", r["id"], round(r["total"] / 1e6, 1), "D", r["shareD"], "focus", r["focus"], "party", r["partyFocus"], "out", r["outsideFocus"], "pv", r["perVoter"], "m", r["margin"])
