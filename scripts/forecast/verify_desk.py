"""Check the desk's model.json against the three published OnPoint forecast pages.

The desk is built from the same data files those pages ship, so every race, margin,
win probability, vote total and county figure has to agree exactly. Margins are
D-positive on the pages and GOP-positive on the desk, so they compare negated.
"""
import json, sys
from collections import Counter

SRC = "/mnt/user-data/outputs/forecast_html"
OUT = "/tmp/pvi/appwork/public/forecast"
H = json.load(open(f"{SRC}/onpoint-house-forecast-data.json"))
S = json.load(open(f"{SRC}/onpoint-senate-forecast-data.json"))
G = json.load(open(f"{SRC}/onpoint-governor-forecast-data.json"))
M = json.load(open(f"{OUT}/model.json"))
C = json.load(open(f"{OUT}/counties.json"))
X = json.load(open(f"{OUT}/crosstabs.json"))

FIPS2AB = {v["fips"]: k for k, v in H["states"].items() if "fips" in v}
fails, notes = [], []
def chk(ok, label, got=None, want=None):
    (notes if ok else fails).append(f"{'ok  ' if ok else 'FAIL'} {label}" + ("" if ok else f"  got {got!r} want {want!r}"))

races = {r["id"]: r for r in M["races"]}
def close(a, b, tol=0.011): return abs(a - b) <= tol

# ── 1. the race roster ──────────────────────────────────────────────────────
want_ids = set()
for ab, st in H["states"].items():
    for row in st["rows"]:
        want_ids.add(f"house-{ab}-{int(row['n']):02d}")
for page, pre in ((S, "sen"), (G, "gov")):
    for fips in page["races"]:
        if fips in FIPS2AB: want_ids.add(f"{pre}-{FIPS2AB[fips]}")
chk(want_ids == set(races), "race roster matches the pages",
    f"{len(races)} desk", f"{len(want_ids)} pages")
missing = want_ids - set(races); extra = set(races) - want_ids
if missing: fails.append(f"     missing: {sorted(missing)[:8]}")
if extra:   fails.append(f"     extra:   {sorted(extra)[:8]}")

# ── 2. every House district ─────────────────────────────────────────────────
bad_m = bad_p = bad_v = bad_c = 0
for ab, st in H["states"].items():
    for row in st["rows"]:
        r = races.get(f"house-{ab}-{int(row['n']):02d}")
        if r is None: continue
        m = row.get("m")
        if m is not None and not close(r["est"]["margin"], -m, 0.02): bad_m += 1
        v = r.get("votes") or {}
        for k, src in (("dem", "dv"), ("rep", "rv"), ("other", "ov"), ("total", "tv")):
            if int(round(row.get(src) or 0)) != int(v.get(k, -1)): bad_v += 1
        if (row.get("dem") or "No Democrat on the ballot") != r["dem"]: bad_c += 1
        if (row.get("rep") or "No Republican on the ballot") != r["gop"]: bad_c += 1
chk(bad_m == 0, "House district margins", bad_m, 0)
chk(bad_v == 0, "House district vote totals", bad_v, 0)
chk(bad_c == 0, "House candidate names", bad_c, 0)

# ── 3. Senate and governor statewide ────────────────────────────────────────
for page, pre, label in ((S, "sen", "Senate"), (G, "gov", "governor")):
    bm = bv = bc = 0
    for fips, R in page["races"].items():
        ab = FIPS2AB.get(fips)
        r = races.get(f"{pre}-{ab}")
        if r is None: continue
        # a ranked choice race is decided by its final round, so that is what the
        # desk has to carry; everything else compares against the page's margin
        rcv = R.get("rcv")
        det = round(rcv["pct"][0] - rcv["pct"][1], 2) if rcv else R.get("margin")
        if det is not None and not close(r["est"]["margin"], -det, 0.02): bm += 1
        if rcv and (r.get("rcv") or {}).get("dem") != int(rcv["votes"][0]): bm += 1
        tv = int(round(R["totalVotes"]))
        v = r.get("votes") or {}
        if v.get("total") != tv: bv += 1
        for i, key in ((0, "dem"), (1, "rep")):
            want = int(round(tv * R["statewide"][i] / 100))
            if abs(v.get(key, -1) - want) > 1: bv += 1
        if R["cands"][0][0] != r["dem"] or R["cands"][1][0] != r["gop"]: bc += 1
    chk(bm == 0, f"{label} margins", bm, 0)
    chk(bv == 0, f"{label} vote totals", bv, 0)
    chk(bc == 0, f"{label} candidate names", bc, 0)

# ── 4. counties ─────────────────────────────────────────────────────────────
bad = 0; seen = 0
for ab, st in H["states"].items():
    rows = C.get(f"house-{ab}")
    for c in st.get("counties") or []:
        seen += 1
        got = rows.get(c["f"]) if rows else None
        if not got: bad += 1; continue
        if not close(got[0], -c["m"], 0.02): bad += 1
        elif abs(got[1] - round(c["dv"])) > 1 or abs(got[2] - round(c["rv"])) > 1 or abs(got[3] - round(c["w"])) > 1: bad += 1
chk(bad == 0, f"House counties ({seen} of them)", bad, 0)
for page, pre, label in ((S, "sen", "Senate"), (G, "gov", "governor")):
    bad = 0; seen = 0
    for fips, R in page["races"].items():
        ab = FIPS2AB.get(fips); rows = C.get(f"{pre}-{ab}")
        for c in R["counties"]:
            seen += 1
            got = rows.get(c["f"]) if rows else None
            if not got: bad += 1; continue
            w = float(c["w"])
            if not close(got[0], -c["m"], 0.02): bad += 1
            elif abs(got[1] - round(w * c["p"][0] / 100)) > 1 or abs(got[2] - round(w * c["p"][1] / 100)) > 1 or abs(got[3] - round(w)) > 1: bad += 1
    chk(bad == 0, f"{label} counties ({seen} of them)", bad, 0)

# ── 5. chamber headline numbers ─────────────────────────────────────────────
hD = sum(s["seats_d"] for s in H["states"].values())
hR = sum(s["seats_r"] for s in H["states"].values())
chk(H["natvote"]["seats_d"] == hD and H["natvote"]["seats_r"] == hR,
    "House page: state seat sums equal its own headline", (hD, hR),
    (H["natvote"]["seats_d"], H["natvote"]["seats_r"]))

def winners(page):
    d = r = i = 0
    for R in page["races"].values():
        p = (R["cands"][0] if R["margin"] > 0 else R["cands"][1])[1]
        if p == "R": r += 1
        elif p == "D": d += 1
        else: i += 1
    return d, r, i
sD, sR, sI = winners(S); gD, gR, gI = winners(G)

ch = M["chambers"]
proj = {
    "house":    (hD, hR),
    "senate":   (sD + sI + M["meta"]["senNotUpD"], sR + M["meta"]["senNotUpR"]),
    "governor": (gD + gI + M["meta"]["govNotUpD"], gR + M["meta"]["govNotUpR"]),
}
for off, (pd, pr) in proj.items():
    c = ch[off]
    chk(c.get("projD") == pd and c.get("projR") == pr,
        f"{off}: seat projection on the desk", (c.get("projD"), c.get("projR")), (pd, pr))

hodds = H["odds"]
c = ch["house"]
chk(close(c["demControl"] * 100, hodds["d_majority"], 0.06), "house: D majority odds", c["demControl"] * 100, hodds["d_majority"])
chk(close(c["demSeats"], hodds["mean"], 0.06), "house: simulated mean seats", c["demSeats"], hodds["mean"])
chk(abs(c["demP10"] - hodds["p10"]) <= 1, "house: 10th percentile", c["demP10"], hodds["p10"])
chk(abs(c["demP90"] - hodds["p90"]) <= 1, "house: 90th percentile", c["demP90"], hodds["p90"])

c = ch["senate"]
chk(abs(round(c["demControl"] * 100) - S["odds"]["d_osb"]) <= 1,
    "senate: D majority odds (Osborn caucusing, as the page counts him)",
    round(c["demControl"] * 100), S["odds"]["d_osb"])
chk(abs(c["demP10"] - S["odds"]["p10"]) <= 1, "senate: 10th percentile", c["demP10"], S["odds"]["p10"])
chk(abs(c["demP90"] - S["odds"]["p90"]) <= 1, "senate: 90th percentile", c["demP90"], S["odds"]["p90"])

c = ch["governor"]
chk(abs(round(c["demControl"] * 100) - G["odds"]["d"]) <= 1,
    "governor: odds of holding most of the 50 governorships", round(c["demControl"] * 100), G["odds"]["d"])
chk(abs(c["demP10"] - G["odds"]["p10"]) <= 1, "governor: 10th percentile", c["demP10"], G["odds"]["p10"])
chk(abs(c["demP90"] - G["odds"]["p90"]) <= 1, "governor: 90th percentile", c["demP90"], G["odds"]["p90"])
chk(c["projD"] == G["odds"]["med"], "governor: projection matches the page's median total", c["projD"], G["odds"]["med"])
# The split used to be frozen at 22 and 14. That is a forecast output, not an invariant: the
# Sept 24 UNH poll flipped Vermont and the check failed on a page that was correct. What is
# actually invariant is that the 36 on the ballot are all accounted for, and that the D side
# of them agrees with the page's own median projection net of the seats not on the ballot.
chk(gD + gI + gR == 36, "governor: every one of the 36 on the ballot is called", gD + gI + gR, 36)
chk(gD + gI == G["odds"]["med"] - M["meta"]["govNotUpD"],
    "governor: the 36 on the ballot split as the page prints them",
    (gD + gI, gR), (G["odds"]["med"] - M["meta"]["govNotUpD"], 36 - (G["odds"]["med"] - M["meta"]["govNotUpD"])))

# ── 6. internal consistency ─────────────────────────────────────────────────
for off in ("house", "senate", "governor"):
    c = ch[off]
    tot = sum(p for _, p in c["hist"])
    chk(abs(tot - 1) < 0.002, f"{off}: simulated distribution sums to 1", round(tot, 4), 1)
    chk(abs(c["demSeats"] + c["gopSeats"] - c["seatsTotal"]) < 0.11, f"{off}: mean seats sum to the chamber", c["demSeats"] + c["gopSeats"], c["seatsTotal"])
    chk(abs(c["demControl"] + c["gopControl"] - 1) < 0.002, f"{off}: control odds sum to 1", None, None)
bad = sum(1 for r in M["races"] if not (0 <= r["est"]["prob"] <= 1))
chk(bad == 0, "every win probability inside 0 to 1", bad, 0)
bad = sum(1 for r in M["races"] if r["est"]["p10"] > r["est"]["p90"])
chk(bad == 0, "every p10 below its p90", bad, 0)
bad = sum(1 for r in M["races"] if (r.get("votes") or {}).get("total", 0) <= 0 and r["st"] not in ())
chk(bad == 0, "every race carries a projected vote", bad, 0)
odd = [r["id"] for r in M["races"]
       if (r["est"]["margin"] > 0) != (r["est"]["prob"] > 0.5)
       and abs(r["est"]["margin"]) > 0.5]
chk(odd == ["sen-AK"], "margin and win probability point the same way", odd, ["sen-AK"])
if odd == ["sen-AK"]:
    # These two figures used to be written into the note as constants, which meant the note kept
    # printing the Sept 22 numbers after the race had moved. They are read off the desk instead.
    # est.margin and est.prob are both GOP positive. The final round leader is whichever side that
    # margin favours, and it is that side's win probability the note is about.
    _ak = next(r for r in M["races"] if r["id"] == "sen-AK")
    _m = _ak["est"]["margin"]; _gop = _ak["est"]["prob"] * 100
    _lead, _trail = 50 + abs(_m) / 2, 50 - abs(_m) / 2
    _lead_p = _gop if _m > 0 else 100 - _gop
    notes.append(f"note the Alaska Senate page has the ranked choice final round at {_lead:.2f} to "
                 f"{_trail:.2f} and the leader of that round winning {_lead_p:.1f} percent of the "
                 f"simulated elections; the desk carries both figures as published")

# ── 6b. simulated crosstabs ─────────────────────────────────────────────────
want = {r["id"] for r in M["races"] if r["office"] != "house"}
chk(set(X) == want, "every statewide race carries its crosstabs", len(X), len(want))
bad_shape = bad_total = bad_share = bad_band = 0
for page, pre in ((S, "sen"), (G, "gov")):
    for fips, R in page["races"].items():
        rid = f"{pre}-{FIPS2AB.get(fips)}"
        rows = X.get(rid)
        src = (R.get("xt") or {}).get("rows") or []
        if rows is None or len(rows) != len(src): bad_shape += 1; continue
        for got, wnt in zip(rows, src):
            if len(got) != 6 or got[0] != wnt[0] or got[1] != wnt[1]: bad_shape += 1; break
            if any(abs(got[i] - float(wnt[i])) > 0.051 for i in range(2, 6)): bad_shape += 1; break
        tot = next((r for r in rows if r[0] == "All voters"), None)
        # Tolerance, built rather than guessed. The crosstab row is stored at one decimal,
        # worth 0.05; the statewide line at two, worth 0.005; and the two are computed by
        # different routes, the crosstab from its ACS cell reconstruction and the statewide
        # line from the county projection, which across all 71 races agree to within 0.005.
        # Rounding the statewide figure first instead does not work: where the two straddle
        # a .x5 boundary the double rounding opens a spurious 0.1 gap.
        if tot is None or abs(tot[3] - R["statewide"][0]) > 0.065 or abs(tot[4] - R["statewide"][1]) > 0.065:
            bad_total += 1
        cats = {}
        for r in rows:
            if r[0] == "All voters": continue
            cats.setdefault(r[0], []).append(r)
        for name, rs in cats.items():
            # a cut can fall a little short of 100: the pages suppress any group
            # under 1 percent of projected voters. It must never run over.
            t = sum(r[2] for r in rs)
            if t > 100.35 or t < 96: bad_share += 1
            if any(not (0 <= r[3] <= 100 and 0 <= r[4] <= 100 and 0 <= r[5] <= 100) for r in rs): bad_band += 1
chk(bad_shape == 0, "crosstab rows match the pages cell for cell", bad_shape, 0)
chk(bad_total == 0, "crosstab 'All voters' row equals the statewide projection", bad_total, 0)
chk(bad_share == 0, "each crosstab cut's group shares total 100, allowing for suppressed groups under 1 percent", bad_share, 0)
chk(bad_band == 0, "every crosstab percentage inside 0 to 100", bad_band, 0)
n_rows = sum(len(v) for v in X.values())
notes.append(f"ok   {n_rows} crosstab rows across {len(X)} statewide races")

# ── 7. the seat projection against each page's own seat line ────────────────
chk(ch["house"]["projD"] == H["natvote"]["seats_d"],
    "house: projection equals the House page's own seat line",
    ch["house"]["projD"], H["natvote"]["seats_d"])
for off in ("house", "senate", "governor"):
    c = ch[off]
    chk(c["projD"] + c["projR"] == c["seatsTotal"],
        f"{off}: projection fills the chamber", c["projD"] + c["projR"], c["seatsTotal"])

print("\n".join(notes))
print()
if fails:
    print("\n".join(fails)); print(f"\n{len(fails)} CHECK(S) FAILED")
    sys.exit(1)
print("all checks passed")
