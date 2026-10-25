"""Donor coalitions (Oct 25 2026): the 2026 House and Senate donor map turned into a model input and a site dataset.

Inputs, in scripts/forecast/donors/data:
  candidates.json     every 2026 House and Senate candidate: itemized individual dollars through Sep 30 2026 (total,
                      mapped to counties), donations (n), home state share of those dollars, total raised through Sep 30
  money_sources.json  where each campaign's money came from, Jan 1 2025 to Jun 30 2026: mapped individuals, unmapped
                      individuals, PACs, party, self funding, other
  county_bands.json   every county: donations by size band (under $200, $200 to $999, $1,000 to $2,499, $2,500 and up),
                      and the five candidates who raised the most there with their dollars by band
  meta.json           the map's build notes
Plus the site's public/forecast/model.json and pres24_counties.json.

The model signal, for every race with a Democratic or independent and a Republican nominee on file. Each part is measured
against what a race with the same partisan lean would show, from a fit across all 400 plus races, so the national
platform gap (ActBlue raised far more than WinRed) and the state's lean never count as an edge:
  instate  the Democrat's share of the two nominees' in state individual dollars
  breadth  the Democrat's share of the two nominees' donations, a count of people giving rather than dollars
  small    how much more of the Democrat's in state money comes in gifts under $200 than the Republican's
  reach    how far into the other side's counties each nominee's in state donors reach, from the county map
Each residual is divided by its spread across races and the available parts are averaged into z. Inside one spread of
normal nothing moves (z shrinks by 0.75 toward zero); past it the donor term is 0.02 logit per unit, capped at 0.05,
then enters the fundamentals and census legs the way the money term does, so a well polled race barely moves.
Governors file with the states, not the FEC, so they carry no donor term.

Usage: python3 -I scripts/forecast/donors/build_donors.py SITE_DIR [OUT_SIGNALS]
Writes public/forecast/donors.json (the site's Donor coalitions page) and the model signal file (default
/tmp/fcrun/donors/donor_signals.json), read by the model through DONOR_SIGNALS.
"""
import json, math, os, sys
import numpy as np
from collections import defaultdict

SITE = sys.argv[1]
OUT_SIG = sys.argv[2] if len(sys.argv) > 2 else "/tmp/fcrun/donors/donor_signals.json"
D = os.path.join(SITE, "scripts", "forecast", "donors", "data")
J = lambda p: json.load(open(p, encoding="utf-8"))
C = J(os.path.join(D, "candidates.json"))
SRC = J(os.path.join(D, "money_sources.json"))
BANDS = J(os.path.join(D, "county_bands.json"))["counties"]
META = J(os.path.join(D, "meta.json"))
model = J(os.path.join(SITE, "public", "forecast", "model.json"))
pres = J(os.path.join(SITE, "public", "forecast", "pres24_counties.json"))["c"]
cnames = J(os.path.join(SITE, "public", "forecast", "counties.json")).get("_n", {})
FIPS = {"AL": "01", "AK": "02", "AZ": "04", "AR": "05", "CA": "06", "CO": "08", "CT": "09", "DE": "10", "FL": "12", "GA": "13", "HI": "15", "ID": "16", "IL": "17", "IN": "18", "IA": "19", "KS": "20", "KY": "21", "LA": "22", "ME": "23", "MD": "24", "MA": "25", "MI": "26", "MN": "27", "MS": "28", "MO": "29", "MT": "30", "NE": "31", "NV": "32", "NH": "33", "NJ": "34", "NM": "35", "NY": "36", "NC": "37", "ND": "38", "OH": "39", "OK": "40", "OR": "41", "PA": "42", "RI": "44", "SC": "45", "SD": "46", "TN": "47", "TX": "48", "UT": "49", "VT": "50", "VA": "51", "WA": "53", "WV": "54", "WI": "55", "WY": "56"}
logit = lambda p: math.log(min(max(p, 1e-4), 1 - 1e-4) / (1 - min(max(p, 1e-4), 1 - 1e-4)))

# ------------------------------------------------------------- each candidate's county money, from the top five lists
by_cand = defaultdict(dict)  # cand_id -> fips -> [b1..b4]
for f, row in BANDS.items():
    for cid, b in row.get("top", []):
        by_cand[cid][f] = b
d2 = {f: (v[0] / (v[0] + v[1])) for f, v in pres.items() if v[0] + v[1] > 0}
votes24 = {f: sum(v) for f, v in pres.items()}


def instate_profile(c):
    st = FIPS.get(c["state"]); cs = by_cand.get(c["cand_id"], {})
    rows = {f: b for f, b in cs.items() if st and f.startswith(st)}
    tot = sum(sum(b) for b in rows.values())
    bands = [sum(b[i] for b in rows.values()) for i in range(4)]
    cen = sum(sum(b) * d2[f] for f, b in rows.items() if f in d2) / max(1, sum(sum(b) for f, b in rows.items() if f in d2)) if rows else None
    exp_in = (c.get("total") or 0) * (c.get("home_state_share") or 0)
    return {"tot": tot, "bands": bands, "centroid": cen, "coverage": (tot / exp_in) if exp_in > 0 else None, "rows": rows}


# ------------------------------------------------------------- the nominees in each race
def mid(race_id):
    st, d = race_id.split("-")
    if d == "S": return f"sen-{st}"
    return f"house-{st}-{'01' if d == 'AL' else d.zfill(2)}"


MOD = {r["id"]: r for r in model["races"]}
noms = defaultdict(list)
for c in C:
    if c.get("nominee") and c.get("active", True): noms[mid(c["race_id"])].append(c)
races = []
for rid, cs in noms.items():
    m = MOD.get(rid)
    if not m: continue
    dname, rname = (m.get("dem") or "").lower(), (m.get("gop") or "").lower()
    def pick(slot, party):
        nm = dname if slot == "D" else rname
        best = [c for c in cs if c["display_name"].lower() == nm] or [c for c in cs if c["display_name"].split()[-1].lower() in nm] or [c for c in cs if c["party"] == party]
        return best[0] if best else None
    D_, R_ = pick("D", "DEM"), pick("R", "REP")
    if D_ is R_: R_ = None
    races.append({"id": rid, "office": m["office"], "st": m["st"], "pvi": m.get("pvi") or 0.0, "D": D_, "R": R_, "m": m})


def ok(c): return c is not None and (c.get("total") or 0) > 0 and c.get("status") in ("complete", "missing_q3", "other")


# ------------------------------------------------------------- what a race of this lean normally shows
def fit(X, ys):
    """Least squares on lean and incumbency, so an incumbent's donor list, which the model already credits through
    incumbency, does not count again here."""
    A = np.column_stack([np.ones(len(X)), np.asarray(X, float)])
    coef, *_ = np.linalg.lstsq(A, np.asarray(ys, float), rcond=None)
    res = np.asarray(ys, float) - A @ coef
    sd = float(np.sqrt((res ** 2).sum() / max(1, len(ys) - A.shape[1])))
    return [float(c) for c in coef], sd


feat = {}
for r in races:
    D_, R_ = r["D"], r["R"]
    if not (ok(D_) and ok(R_)): continue
    inD, inR = D_["total"] * (D_.get("home_state_share") or 0), R_["total"] * (R_.get("home_state_share") or 0)
    f = {"x": -r["pvi"] / 100.0, "inc": -(r["m"].get("inc") or 0), "sen": 1 if r["office"] == "senate" else 0}
    if inD + inR > 20000: f["instate"] = logit(inD / (inD + inR))
    if (D_.get("n") or 0) + (R_.get("n") or 0) > 200: f["breadth"] = logit(D_["n"] / (D_["n"] + R_["n"]))
    pD, pR = instate_profile(D_), instate_profile(R_)
    if pD["tot"] > 50000 and pR["tot"] > 50000 and (pD["coverage"] or 0) > 0.35 and (pR["coverage"] or 0) > 0.35:
        f["small"] = pD["bands"][0] / pD["tot"] - pR["bands"][0] / pR["tot"]
        # reach: how far each side's donors sit from its own base, the Democrat's toward redder counties and the Republican's toward bluer
        f["reach"] = (pR["centroid"] - 0.5) - (0.5 - pD["centroid"]) if pD["centroid"] is not None and pR["centroid"] is not None else None
        if f["reach"] is None: f.pop("reach")
    r["pD"], r["pR"] = pD, pR
    feat[r["id"]] = f

fits = {}
for k in ("instate", "breadth", "small", "reach"):
    pts = [((f["x"], f["inc"], f["sen"]), f[k]) for f in feat.values() if k in f]
    if len(pts) >= 12: fits[k] = fit([p[0] for p in pts], [p[1] for p in pts]) + (len(pts),)

K_DONOR, DEAD, CAP = 0.02, 0.75, 0.05
signals = {"statewide": {}, "house": {}}
for rid, f in feat.items():
    zs = {}
    for k, (cf, sd, n) in fits.items():
        if k in f and sd > 0: zs[k] = (f[k] - (cf[0] + cf[1] * f["x"] + cf[2] * f["inc"] + cf[3] * f["sen"])) / sd
    if not zs: continue
    z = sum(zs.values()) / len(zs)
    zc = math.copysign(max(0.0, abs(z) - DEAD), z)
    shift = max(-CAP, min(CAP, K_DONOR * zc))
    rec = {"z": round(z, 3), "parts": {k: round(v, 3) for k, v in zs.items()}, "shift_logit": round(shift, 4), "applies": abs(shift) > 0}
    race = next(r for r in races if r["id"] == rid)
    if race["office"] == "senate": signals["statewide"][race["st"]] = rec
    else: signals["house"][f"{race['st']}-{rid.split('-')[2]}"] = rec
    race["sig"] = rec

os.makedirs(os.path.dirname(OUT_SIG), exist_ok=True)
json.dump({"built": META.get("built_at"), "through": META.get("as_of_transactions"), "k": K_DONOR, "dead": DEAD, "cap": CAP,
           "fits": {k: {"coef": [round(c, 4) for c in v[0]], "sd": round(v[1], 4), "n": v[2]} for k, v in fits.items()}, **signals},
          open(OUT_SIG, "w"), indent=1)


# ------------------------------------------------------------- the site dataset: who gives, and where, next to who votes
def sources(cid):
    s = SRC["candidates"].get(cid)
    if not s: return None
    return {k: s.get(k) for k in ("mapped", "individuals_unmapped", "pacs", "party", "self_funding", "other", "total")}


cmap = J(os.path.join(SITE, "public", "forecast", "counties.json"))


def coalition(r, side, prof):
    """Donor dollars against votes, by kind of county: the nominee's in state donor money and the race's projected votes
    in counties grouped by their 2024 presidential lean and by size."""
    rows = cmap.get(r["id"]) or {}
    st = FIPS[r["st"]]
    # the county lists hold each county's top five candidates, so a nominee with little money is missing from most of
    # them; below a third of their in state money found, no county breakdown is shown
    if not rows or not prof or prof["tot"] <= 0 or (prof["coverage"] or 0) < 0.35: return None
    groups = [("Strong D", lambda p: p >= 0.6), ("Lean D", lambda p: 0.5 <= p < 0.6), ("Lean R", lambda p: 0.4 <= p < 0.5), ("Strong R", lambda p: p < 0.4)]
    out, vt = [], sum(v[3] for k, v in rows.items() if isinstance(v, list)) or 1
    mine = lambda v: (v[1] if side == "D" else v[2])
    mtot = sum(mine(v) for k, v in rows.items() if isinstance(v, list)) or 1
    for name, test in groups:
        fs = [f for f in rows if isinstance(rows[f], list) and f in d2 and test(d2[f])]
        don = sum(sum(prof["rows"].get(f, [0, 0, 0, 0])) for f in fs)
        out.append({"g": name, "donors": round(don / prof["tot"], 4), "voters": round(sum(rows[f][3] for f in fs) / vt, 4),
                    "votes": round(sum(mine(rows[f]) for f in fs) / mtot, 4), "n": len(fs)})
    sizes = sorted([f for f in rows if isinstance(rows[f], list)], key=lambda f: -rows[f][3])
    cum, big = 0, set()
    for f in sizes:
        if cum / vt >= 0.5: break
        big.add(f); cum += rows[f][3]
    for name, sel in (("Largest counties, half the vote", lambda f: f in big), ("Everywhere else", lambda f: f not in big)):
        fs = [f for f in sizes if sel(f)]
        don = sum(sum(prof["rows"].get(f, [0, 0, 0, 0])) for f in fs)
        out.append({"g": name, "donors": round(don / prof["tot"], 4), "voters": round(sum(rows[f][3] for f in fs) / vt, 4),
                    "votes": round(sum(mine(rows[f]) for f in fs) / mtot, 4), "n": len(fs), "size": True})
    top = sorted(prof["rows"].items(), key=lambda kv: -sum(kv[1]))[:8]
    return {"groups": out, "top": [{"f": f, "name": cnames.get(f, f), "usd": sum(b), "bands": b, "d2": round(d2.get(f, 0.5), 3)} for f, b in top]}


def cand_out(c, prof):
    if not c: return None
    return {"id": c["cand_id"], "name": c["display_name"], "party": c["party"][:1], "raised": c.get("raised"), "itemized": c.get("total"),
            "donations": c.get("n"), "home": c.get("home_state_share"), "status": c.get("status"), "through": c.get("raised_through") or c.get("data_through"),
            "sources": sources(c["cand_id"]), "bands": prof["bands"] if prof and prof["tot"] > 0 and (prof["coverage"] or 0) >= 0.35 else None,
            "instate_mapped": prof["tot"] if prof else None, "coverage": round(prof["coverage"], 3) if prof and prof["coverage"] else None,
            "centroid": round(prof["centroid"], 4) if prof and prof["centroid"] is not None and (prof["coverage"] or 0) >= 0.35 else None}


out_races = []
for r in sorted(races, key=lambda r: (r["office"] != "senate", r["id"])):
    pD = r.get("pD") or (instate_profile(r["D"]) if r["D"] else None)
    pR = r.get("pR") or (instate_profile(r["R"]) if r["R"] else None)
    item = {"id": r["id"], "office": r["office"], "st": r["st"], "name": r["m"]["name"], "pvi": r["pvi"], "m": r["m"]["est"]["margin"],
            "D": cand_out(r["D"], pD), "R": cand_out(r["R"], pR), "sig": r.get("sig")}
    if r["office"] == "senate":
        item["coalition"] = {"D": coalition(r, "D", pD), "R": coalition(r, "R", pR)}
    out_races.append(item)

# national: donations by size band, all counties, and the states that give most per voter
nb = [sum(v["n"][i] for v in BANDS.values()) for i in range(4)]
st_n = defaultdict(lambda: [0, 0, 0, 0]); st_v = defaultdict(int)
for f, v in BANDS.items():
    s = next((k for k, x in FIPS.items() if f.startswith(x)), None)
    if not s: continue
    for i in range(4): st_n[s][i] += v["n"][i]
for f, n in votes24.items():
    s = next((k for k, x in FIPS.items() if f.startswith(x)), None)
    if s: st_v[s] += n
states = sorted([{"st": s, "donations": sum(v), "per1k": round(1000 * sum(v) / max(1, st_v[s]), 1), "small": round(v[0] / max(1, sum(v)), 3)} for s, v in st_n.items()], key=lambda x: -x["per1k"])
counties = {f: [sum(v["n"]), round(1000 * sum(v["n"]) / max(1, votes24.get(f, 0)), 1) if votes24.get(f) else None, round(v["n"][0] / max(1, sum(v["n"])), 3)] for f, v in BANDS.items()}
moved = sorted([x for x in out_races if x.get("sig") and x["sig"]["applies"]], key=lambda x: -abs(x["sig"]["shift_logit"]))
json.dump({"meta": META, "fits": {k: {"coef": [round(c, 4) for c in v[0]], "sd": round(v[1], 4), "n": v[2]} for k, v in fits.items()},
           "k": K_DONOR, "dead": DEAD, "cap": CAP, "national": {"bands_n": nb, "parties": META["topline_basis"]["parties"], "by_source": META["by_source"]},
           "states": states, "counties": counties, "races": out_races, "moved": [x["id"] for x in moved]},
          open(os.path.join(SITE, "public", "forecast", "donors.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(f"donors: {len(out_races)} races, {len(feat)} with both nominees on file, {len(moved)} past the dead zone; fits " +
      ", ".join(f"{k} n={v[2]} lean={v[0][1]:.2f} inc={v[0][2]:.2f} sd={v[1]:.3f}" for k, v in fits.items()))
for x in moved[:25]: print(" ", x["id"], x["sig"])
