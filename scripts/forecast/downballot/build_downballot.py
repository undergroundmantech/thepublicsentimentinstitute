"""On Point 2026 down ballot forecast: lieutenant governor, attorney general, secretary of state, treasurer,
auditor, agriculture commissioner and the Texas railroad commissioner, county by county.

Each race is built from the same parts as the Senate and governor races, on the county scale.

  Top of ticket  T  the published 2026 Senate and governor county forecasts in the state, the ticket the race shares a
                    ballot with. Races led by an independent are left out of T, since their pull is the candidate's.
  Fundamentals   F  the approval leg of the state's run.
  Gallup         G  the Gallup party identification leg, relaxed: down ballot voters know little about the candidates
                    and fall back on party as it voted in recent elections, not as Gallup measures it nationally.
  History        H  the state's own down ballot results, 2014, 2018 and 2022, moved to 2026 by the change in the
                    national House vote times the state's elasticity, the seat history rule of the Senate model. Its
                    county pattern blends the down ballot geography of those races with the 2026 top of ticket's.
  Primary        P  the 2026 primaries for this office: each county's Democratic share of the two party primary vote
                    in this race, read against the same county's share in the top of ticket primaries, so only what
                    is particular to this race's primaries moves it. Primaries carry more weight here than in the
                    Senate model, since these races are barely polled.

  blend   T 0.30, F 0.15, G 0.10, H 0.25, P 0.20; a missing leg's weight is shared out among the rest.
  ticket splitting   the candidate terms, incumbency, primary unity and polls, move each county by its voters'
                    looseness from the ticket splitting model, the switching chance of its voter types, so a county
                    of straight party voters moves less than a county of loose ones.
  incumbency        0.07 in log odds, about 3.5 points of margin, toward an incumbent on the ballot.
  unity             0.15 times the gap in log odds between the two nominees' primary shares, capped at 0.08.
  polls             undecided voters are split by half the model's own lean before the poll is read; partisan polls
                    are moved 3 points of margin against their sponsor; each poll counts by recency, a 45 day decay, and
                    sample size, and the polls take 0.25 per full weight poll of the statewide level, at most 0.65.
  uncertainty       the top of ticket's own 80 percent range plus 3 points of down ballot error, narrowed by polls.

Writes public/forecast/downballot.json and public/forecast/downballot_counties.json.
"""
import json, os, re, glob, math, unicodedata
import numpy as np, pandas as pd

SITE = os.environ.get("SITE", "/tmp/site")
PUB = f"{SITE}/public/forecast"
RUNS = ["/tmp/fcrun/runs/S1017B", "/tmp/fcrun/runs/S1017", "/tmp/fcrun/runs/B2"]
STORE = "/tmp/elecdata/store"
RESEARCH = ["/tmp/elecdata/research_ag.json", "/tmp/elecdata/research_sos_lg.json", "/tmp/elecdata/research_treas_aud.json",
            "/tmp/elecdata/research_new_offices.json"]   # Oct 19 2026: the remaining partisan statewide offices (convert_new_offices.py)
COUNTY = glob.glob("/tmp/fcrun/TPSI_B/model/41050065*/TEXASMODELFINAL/TPSI_Trump_Approval_By_County_Combined_FULL.csv")[0]
W = dict(T=0.30, F=0.15, G=0.10, H=0.25, P=0.20)
INC, UNITY_K, UNITY_CAP = 0.07, 0.15, 0.08
NAT26 = 0.56
NAT_HOUSE_D2 = {2014: 0.4705, 2018: 0.5431, 2022: 0.4858}
TODAY = pd.Timestamp(os.environ.get("TODAY", "2026-10-17"))
OFFICE_LABEL = {"lieutenant-governor": "Lieutenant governor", "attorney-general": "Attorney general",
                "secretary-of-state": "Secretary of state", "treasurer": "Treasurer", "auditor": "Auditor",
                "agriculture-commissioner": "Agriculture commissioner", "railroad-commissioner": "Railroad commissioner",
                "comptroller": "Comptroller", "land-commissioner": "Land commissioner", "superintendent": "Schools superintendent",
                "insurance-commissioner": "Insurance commissioner", "labor-commissioner": "Labor commissioner",
                "public-service-commission": "Utility commission", "mine-inspector": "Mine inspector", "education-board": "Education board",
                "supreme-court": "Supreme court"}
OFFICE_CODE = {"lieutenant-governor": "lg", "attorney-general": "ag", "secretary-of-state": "sos", "treasurer": "treas",
               "auditor": "aud", "agriculture-commissioner": "agri", "railroad-commissioner": "rrc",
               "comptroller": "comp", "land-commissioner": "land", "superintendent": "supt", "insurance-commissioner": "ins",
               "labor-commissioner": "labor", "public-service-commission": "psc", "mine-inspector": "mine", "education-board": "edb",
               "supreme-court": "court"}
STATE_NAME = {}

lg = lambda p: np.log(np.clip(p, 1e-4, 1 - 1e-4) / (1 - np.clip(p, 1e-4, 1 - 1e-4)))
inv = lambda z: 1 / (1 + np.exp(-z))
norm = lambda s: re.sub(r"[^a-z]", "", unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode().lower()
                        .replace("saint", "st").replace("county", "").replace("parish", "").replace("borough", ""))

# ── counties: names, 2024 vote, adults ─────────────────────────────────────────────────────────────────────────────
cc = pd.read_csv(COUNTY)
cc["fips"] = cc.county_fips.astype(int).map(lambda f: f"{f:05d}")
NAME2F = {(s, norm(n)): f for f, n, s in zip(cc.fips, cc.COUNTY, cc.state_abbr)}
for f, n, s in zip(cc.fips, cc.COUNTY, cc.state_abbr):           # "Saint Louis city" style variants
    NAME2F.setdefault((s, norm(re.sub(r"\s+city$", "", str(n), flags=re.I))), f)
T24 = dict(zip(cc.fips, 1 - cc.trump_2024_two_party_pct / 100))   # Democratic two party share, 2024
ADULTS = dict(zip(cc.fips, cc.adult_population_18plus))
for s, n in zip(cc.state_abbr, cc.STATE): STATE_NAME[s] = n
# Connecticut: the published forecast runs on the eight old counties, the county table on planning regions
CT_OLD = {"fairfield": "09001", "hartford": "09003", "litchfield": "09005", "middlesex": "09007", "newhaven": "09009",
          "newlondon": "09011", "tolland": "09013", "windham": "09015"}
for n_, f_ in CT_OLD.items(): NAME2F[("CT", n_)] = f_
TOWN = {}
try:
    import zipcodes
    tv = {}
    for z in zipcodes.list_all():
        if z["state"] in ("CT", "NH", "RI", "VT", "ME", "MA"):
            f = NAME2F.get((z["state"], norm(z["county"])))
            if f: tv.setdefault((z["state"], norm(z["city"])), []).append(f)
    TOWN = {k: max(set(v), key=v.count) for k, v in tv.items()}
except ImportError:
    pass

def to_fips(st, name):
    n = norm(re.sub(r"\s+(town|city|plantation|village)$", "", str(name), flags=re.I))
    return NAME2F.get((st, n)) or NAME2F.get((st, norm(name))) or TOWN.get((st, n))

def county_votes(path, st):
    """{fips: {candidate: votes}} for a results file, towns summed into counties."""
    d = pd.read_csv(path)
    key = next(c for c in d.columns if c.lower() in ("county_name", "county", "name"))
    cands = [c for c in d.columns if c != key and c.lower() not in ("fips", "county_fips")]
    out, miss = {}, 0
    for _, r in d.iterrows():
        f = to_fips(st, r[key])
        if f is None: miss += 1; continue
        o = out.setdefault(f, {})
        for c in cands:
            v = pd.to_numeric(r[c], errors="coerce")
            o[c] = o.get(c, 0.0) + (0.0 if pd.isna(v) else float(v))
    return out, cands, miss

# ── published 2026 forecast ───────────────────────────────────────────────────────────────────────────────────────
MODEL = json.load(open(f"{PUB}/model.json")); CJ = json.load(open(f"{PUB}/counties.json"))
RACE = {r["id"]: r for r in MODEL["races"]}
for f_ in CT_OLD.values():                     # old Connecticut counties: the published governor vote stands in for 2024
    row = CJ.get("gov-CT", {}).get(f_)
    if row: T24[f_] = row[1] / max(1, row[1] + row[2]); ADULTS[f_] = row[3] / 0.6
STATE_FIPS = {s_: sorted(cc.fips[cc.state_abbr == s_]) for s_ in set(cc.state_abbr)}
STATE_FIPS["CT"] = sorted(CT_OLD.values())
COUNTY_NAME = dict(zip(cc.fips, cc.COUNTY)); COUNTY_NAME.update({f_: n_.title().replace("Newhaven", "New Haven").replace("Newlondon", "New London") + " County" for n_, f_ in CT_OLD.items()})

def run_file(pattern):
    for d in RUNS:
        hit = glob.glob(f"{d}/lane*/{pattern}")
        if hit: return hit[0], os.path.dirname(hit[0])
    return None, None

def top_races(st):
    out = []
    for oid, off in (("sen", "senate"), ("gov", "governor")):
        r = RACE.get(f"{oid}-{st}")
        if r is None or f"{oid}-{st}" not in CJ: continue
        ind = any(c.get("party") in ("IND", "I") and c["name"] == r["dem"] for c in r.get("cands", []))
        slug = r["state"].lower().replace(" ", "_")
        f, d = run_file(f"{slug}_2026_{off}_county_forecast.csv")
        out.append(dict(id=f"{oid}-{st}", office=off, ind=ind, race=r, csv=f, dir=d, key=st + ("G" if off == "governor" else "")))
    return out

def looseness(st, tops):
    """County looseness from the ticket splitting model: voter weighted lambda of each county's types, over the state mean."""
    for t in tops:
        if not t["dir"]: continue
        p = f"{t['dir']}/behavior_types_{t['key']}.npz"
        if not os.path.exists(p): continue
        z = np.load(p, allow_pickle=True)
        V = z["pops"] * inv(z["lt"]); lam = z["lam"].astype(float)[None, :]
        lc = (V * lam).sum(1) / np.maximum(V.sum(1), 1e-9)
        mean = float((V * lam).sum() / V.sum())
        return {str(f): float(x / mean) for f, x in zip(z["fips"], lc)}, mean
    return {}, None

# ── history: 2014, 2018, 2022 down ballot results ─────────────────────────────────────────────────────────────────
MAN = pd.read_csv(f"{STORE}/manifest.csv")
HIST = {}
def history(st):
    if st in HIST: return HIST[st]
    rows = MAN[(MAN.kind == "general") & (MAN.state == st)]
    out = []
    for _, m in rows.iterrows():
        cv, cands, _ = county_votes(f"{STORE}/{m.file}", st)
        if len(cv) < 1 or len(cands) < 2: continue
        tot = {c: sum(v.get(c, 0) for v in cv.values()) for c in cands}
        top2 = sorted(tot, key=lambda c: -tot[c])[:2]
        fs = [f for f in cv if f in T24]
        if len(fs) >= 3:
            # the Republican is the candidate whose county share rises with the 2024 Trump vote
            sh = {c: np.array([cv[f].get(c, 0) / max(1, sum(cv[f].values())) for f in fs]) for c in top2}
            t = np.array([1 - T24[f] for f in fs])
            corr = {c: np.corrcoef(sh[c], t)[0, 1] for c in top2}
            R_, D_ = (top2[0], top2[1]) if corr[top2[0]] > corr[top2[1]] else (top2[1], top2[0])
        else:
            continue
        D = {f: v.get(D_, 0) for f, v in cv.items()}; R = {f: v.get(R_, 0) for f, v in cv.items()}
        O = {f: sum(v.values()) - D[f] - R[f] for f, v in cv.items()}
        out.append(dict(year=int(m.year), office=m.office, D=D, R=R, O=O, dname=D_, rname=R_,
                        d2=sum(D.values()) / max(1, sum(D.values()) + sum(R.values())),
                        oshare=sum(O.values()) / max(1, sum(D.values()) + sum(R.values()) + sum(O.values()))))
    HIST[st] = out
    return out

def history_leg(st, office, fips, e_state, top_lean):
    hs = history(st)
    if not hs: return None, None, None, None
    years = sorted({h["year"] for h in hs}, reverse=True)
    lvl, lean_y = {}, {}
    for y in years:
        hy = [h for h in hs if h["year"] == y]
        allm = float(np.mean([lg(h["d2"]) for h in hy]))
        same = [h for h in hy if h["office"] == office]
        lvl[y] = 0.5 * lg(same[0]["d2"]) + 0.5 * allm if same else allm
        lv = {}
        for f in fips:
            xs = [lg(h["D"][f] / (h["D"][f] + h["R"][f])) - lg(h["d2"]) for h in hy if f in h["D"] and h["D"][f] + h["R"][f] > 0]
            if xs: lv[f] = float(np.mean(xs))
        lean_y[y] = lv
    moved = [lvl[y] + e_state * (lg(NAT26) - lg(NAT_HOUSE_D2[y])) for y in years[:2]]
    level = 0.65 * moved[0] + 0.35 * moved[1] if len(moved) > 1 else moved[0]
    wy = dict(zip(years[:3], [0.56, 0.28, 0.16][:len(years)]))
    lean = {}
    for f in fips:
        num = sum(wy[y] * lean_y[y][f] for y in wy if f in lean_y[y]); den = sum(wy[y] for y in wy if f in lean_y[y])
        hl = num / den if den else None
        lean[f] = top_lean[f] if hl is None else 0.5 * hl + 0.5 * top_lean[f]
    oth = [h["oshare"] for h in hs if h["office"] == office] or [h["oshare"] for h in hs]
    return level, lean, float(np.mean(oth)), {y: round(float(inv(lvl[y])) * 100, 1) for y in years}

# ── 2026 primaries ────────────────────────────────────────────────────────────────────────────────────────────────
def primary_votes(st, files):
    """{party: (county votes {fips: total}, nominee share of the deciding round)} from the race's primary files."""
    out = {}
    by_party = {}
    for rid, party in (files or {}).items():
        row = MAN[(MAN.kind == "primary") & (MAN.race_id.astype(str) == str(rid))]
        if row.empty: continue
        m = row.iloc[0]
        by_party.setdefault(party, []).append(m)
    for party, ms in by_party.items():
        first = max(ms, key=lambda m: m.total_votes)                 # the round most voters took part in
        last = [m for m in ms if m.final_round] or sorted(ms, key=lambda m: int(m.race_id))[-1:]
        cv, cands, _ = county_votes(f"{STORE}/{first.file}", st)
        votes = {f: sum(v.values()) for f, v in cv.items()}
        fin = last[0]
        nshare = fin.first_votes / max(1, fin.total_votes)
        out[party[0]] = (votes, float(nshare), int(first.total_votes))
    return out

# ── polls ─────────────────────────────────────────────────────────────────────────────────────────────────────────
def poll_d2(polls, base_d2):
    num = den = 0.0; used = []
    for p in polls or []:
        D, R = p.get("D"), p.get("R")
        if D is None or R is None or not p.get("end"): continue
        try: end = pd.Timestamp(p["end"])
        except Exception: continue
        age = (TODAY - end).days
        if age > 150 or age < 0: continue
        U = p.get("U") or 0
        d2 = (D + U * (0.5 + 0.5 * (base_d2 - 0.5))) / (D + R + U)  # undecideds break by half the model's lean
        src = str(p.get("source", ""))
        if re.search(r"\(D\)|for .*(campaign)|Democrat", src): d2 -= 0.015
        if re.search(r"\(R\)", src): d2 += 0.015
        n = p.get("n") or 400
        w = math.exp(-age / 45) * min(1.5, math.sqrt(n / 600)) * (0.8 if str(p.get("pop", "LV")).upper() == "RV" else 1.0)
        num += w * lg(d2); den += w
        used.append(dict(pollster=src, end=p["end"], n=p.get("n"), kind=p.get("pop") or "", D=D, R=R, U=U,
                         margin=round(R - D, 1), age=age, url=p.get("url")))
    if den == 0: return None, 0.0, used
    return float(num / den), float(min(0.65, 0.25 * den)), used

# ── build ─────────────────────────────────────────────────────────────────────────────────────────────────────────
races = []
for f in RESEARCH:
    races += [r for r in json.load(open(f)) if r.get("office") in OFFICE_CODE]
house_by_state = {}
for r in MODEL["races"]:
    if r["office"] == "house" and r.get("votes"):
        h = house_by_state.setdefault(r["st"], [0, 0]); h[0] += r["votes"]["dem"]; h[1] += r["votes"]["rep"]

out_races, out_counties, log = [], {"_n": {}}, []
NAT_PRIM_GAP = []
STATE_CACHE = {}

def state_base(st):
    """County legs shared by every down ballot race in a state."""
    if st in STATE_CACHE: return STATE_CACHE[st]
    tops = [t for t in top_races(st)]
    use = [t for t in tops if not t["ind"]] or tops
    fips = list(STATE_FIPS.get(st, []))
    T, turn = {}, {}
    if use:
        for f in fips:
            rows = [CJ[t["id"]].get(f) for t in use if CJ[t["id"]].get(f)]
            if not rows: continue
            T[f] = float(np.mean([lg(r[1] / max(1, r[1] + r[2])) for r in rows]))
            turn[f] = float(np.mean([r[3] for r in rows]))
        fips = [f for f in fips if f in T]
        legs = {"F": {}, "G": {}, "E": {}, "PT": {}}
        for t in [t for t in use if t["csv"]][:2]:
            d = pd.read_csv(t["csv"], dtype={"county_fips": str}); d["county_fips"] = d.county_fips.str.zfill(5)
            for _, x in d.iterrows():
                f = x.county_fips
                legs["F"].setdefault(f, []).append(lg(x.m1_fundamental_d2 / 100))
                legs["G"].setdefault(f, []).append(lg(x.m2_census_d2 / 100))
                legs["E"].setdefault(f, []).append(float(x.elasticity))
                if "primary_dem_share_of_two_party_primary_vote" in x and pd.notna(x.primary_dem_share_of_two_party_primary_vote):
                    legs["PT"].setdefault(f, []).append(lg(x.primary_dem_share_of_two_party_primary_vote / 100))
        legs = {k: {f: float(np.mean(v)) for f, v in d.items()} for k, d in legs.items()}
        src = "top of ticket: " + ", ".join(f"{t['race']['state']} {t['office']}" for t in use)
    else:
        # no Senate or governor race in 2026: the 2024 vote moved to the national environment, set to the state's
        # published House vote
        fips = [f for f in fips if f in T24]
        sw = lg(NAT26) - lg(0.4924)
        base = {f: float(lg(T24[f]) + sw) for f in fips}
        if st in house_by_state:
            hv = house_by_state[st]; target = lg(hv[0] / (hv[0] + hv[1]))
            w_ = {f: ADULTS.get(f, 1) for f in fips}
            for _ in range(30):
                cur = sum(w_[f] * inv(base[f]) for f in fips) / sum(w_.values())
                dl = target - lg(cur); base = {f: v + dl for f, v in base.items()}
                if abs(dl) < 1e-7: break
        T = base; turn = {f: ADULTS.get(f, 1) * 0.45 for f in fips}
        legs = {"F": dict(base), "G": {f: v + 0.06 for f, v in base.items()}, "E": {f: 1.0 for f in fips}, "PT": {}}
        src = "no 2026 Senate or governor race: 2024 vote moved to the national environment and set to the published House vote"
    tw = sum(turn.values())
    Tst = lg(sum(turn[f] * inv(T[f]) for f in fips) / tw)
    top_lean = {f: T[f] - Tst for f in fips}
    e_state = sum(turn[f] * legs["E"].get(f, 1.0) for f in fips) / tw
    lam, lam_mean = looseness(st, use)
    sd_top = []
    for t in use:
        e = t["race"]["est"]; sd_top.append((e["p90"] - e["p10"]) / 2.563)
    res = dict(fips=fips, T=T, turn=turn, legs=legs, Tst=Tst, top_lean=top_lean, e_state=e_state, lam=lam,
               lam_mean=lam_mean, sd_top=float(np.mean(sd_top)) if sd_top else 6.5, src=src, tops=[t["id"] for t in use])
    # the top of ticket's primary gap, for the national fallback
    if legs["PT"]:
        g = [legs["PT"][f] - T[f] for f in fips if f in legs["PT"]]
        if g: NAT_PRIM_GAP.append(float(np.average(g, weights=[turn[f] for f in fips if f in legs["PT"]])))
    STATE_CACHE[st] = res
    return res

for st in sorted({r["state"] for r in races}):
    state_base(st)
nat_gap = float(np.median(NAT_PRIM_GAP)) if NAT_PRIM_GAP else 0.0

for r in sorted(races, key=lambda x: (x["state"], x["office"], x.get("seat_slug") or "")):
    st, off = r["state"], r["office"]
    ss = r.get("seat_slug")                                  # a state with several races for one office: one page per seat
    rid = f"{OFFICE_CODE[off]}-{st}" + (f"-{ss}" if ss else "")
    dn, rn = (r.get("d_name") or "").strip(), (r.get("r_name") or "").strip()
    olab = r.get("office_label") or OFFICE_LABEL[off]
    if r.get("seat") and str(r["seat"]).lower() not in olab.lower(): olab = f"{olab}, {r['seat']}"
    base = dict(id=rid, st=st, state=STATE_NAME.get(st, st), office=off, officeLabel=olab, dem=dn or None, gop=rn or None,
                others=r.get("others") or [], incumbent=r.get("incumbent_name"), incParty=r.get("incumbent_party"),
                incRunning=bool(r.get("incumbent_running")), note=r.get("note"), sources=(r.get("sources") or [])[:6],
                seat=r.get("seat"), slug=(f"{off}-{ss}" if ss else off), seatsUp=r.get("seats_up") or 1)
    if not dn or not rn:
        winner = "D" if dn else "R"
        base.update(uncontested=winner, est=dict(margin=-100.0 if winner == "D" else 100.0, prob=0.0 if winner == "D" else 1.0, p10=None, p90=None),
                    polls=[], legs={}, history={})
        out_races.append(base); log.append((rid, "uncontested", winner)); continue
    S = state_base(st)
    fips = S["fips"]
    hl, hlean, oshare, hist_years = history_leg(st, off, fips, S["e_state"], S["top_lean"])
    # primary leg
    pv = primary_votes(st, r.get("primary_files"))
    P = {}; prim_note = None
    if "D" in pv and "R" in pv and pv["D"][2] > 0 and pv["R"][2] > 0:
        Dv, Rv = pv["D"][0], pv["R"][0]
        for f in fips:
            d, rr = Dv.get(f, 0), Rv.get(f, 0)
            if d + rr < 20: continue
            x = lg(d / (d + rr))
            if f in S["legs"]["PT"]:
                P[f] = S["T"][f] + float(np.clip(x - S["legs"]["PT"][f], -0.6, 0.6))   # what this race's primaries add to the top of ticket's
            else:
                P[f] = x - nat_gap
        prim_note = dict(dem_primary_votes=pv["D"][2], rep_primary_votes=pv["R"][2],
                         dem_share=round(100 * pv["D"][2] / (pv["D"][2] + pv["R"][2]), 1),
                         dem_nominee_share=round(100 * pv["D"][1], 1), rep_nominee_share=round(100 * pv["R"][1], 1))
    elif pv:
        prim_note = {f"{k.lower()}_nominee_share": round(100 * v[1], 1) for k, v in pv.items()}
    # county blend
    ww = dict(W)
    if hl is None: ww.pop("H")
    if not P: ww.pop("P")
    tot_w = sum(ww.values()); ww = {k: v / tot_w for k, v in ww.items()}
    Lc = {}
    for f in fips:
        legs = {"T": S["T"][f], "F": S["legs"]["F"].get(f, S["T"][f]), "G": S["legs"]["G"].get(f, S["T"][f])}
        if "H" in ww: legs["H"] = hl + hlean[f]
        if "P" in ww: legs["P"] = P.get(f, S["T"][f])
        Lc[f] = sum(ww[k] * legs[k] for k in ww)
    turn = S["turn"]; tw = sum(turn.values())
    st_d2 = lambda L: sum(turn[f] * inv(L[f]) for f in fips) / tw
    pre = lg(st_d2(Lc))
    # candidate terms through the ticket splitting looseness
    cand = 0.0
    if r.get("incumbent_running") and r.get("incumbent_party") in ("D", "R"):
        cand += INC if r["incumbent_party"] == "D" else -INC
    if "D" in pv and "R" in pv:
        cand += float(np.clip(UNITY_K * (lg(pv["D"][1]) - lg(pv["R"][1])), -UNITY_CAP, UNITY_CAP))
    lam = S["lam"]
    sc = {f: float(np.clip(lam.get(f, 1.0), 0.5, 1.6)) for f in fips}
    L2 = {f: Lc[f] + cand * sc[f] for f in fips}
    mid = lg(st_d2(L2))
    # polls
    pl, wp, used = poll_d2(r.get("polls"), float(inv(mid)))
    if pl is not None and wp > 0:
        target = (1 - wp) * mid + wp * pl
        for _ in range(40):
            cur = lg(st_d2(L2)); step = target - cur
            L2 = {f: L2[f] + step * sc[f] for f in fips}
            if abs(step) < 1e-7: break
    fin = lg(st_d2(L2))
    # vote shares and county rows
    osh = max(0.01, min(0.12, (oshare if oshare is not None else 0.015) + (0.015 if r.get("others") else 0.0)))
    rows = {}
    dsum = rsum = vsum = 0.0
    for f in fips:
        d2 = float(inv(L2[f])); v = turn[f]
        dv, rv = v * (1 - osh) * d2, v * (1 - osh) * (1 - d2)
        dsum += dv; rsum += rv; vsum += v
        rows[f] = [round((rv - dv) / v * 100, 2), int(round(dv)), int(round(rv)), int(round(v)),
                   [round(100 * (1 - osh) * d2, 1), round(100 * (1 - osh) * (1 - d2), 1), round(100 * osh, 1)]]
    margin_r = (rsum - dsum) / vsum * 100
    sd = math.sqrt(S["sd_top"] ** 2 + 3.0 ** 2) * (1 - 0.3 * wp)
    prob_r = 0.5 * (1 + math.erf(margin_r / sd / math.sqrt(2)))
    two = lambda L: round(float(100 * (2 * inv(L) - 1)), 2)                # Democratic minus Republican, two party
    base.update(
        est=dict(margin=round(margin_r, 2), prob=round(prob_r, 4), p10=round(margin_r - 1.2816 * sd, 2), p90=round(margin_r + 1.2816 * sd, 2)),
        votes=dict(dem=int(dsum), rep=int(rsum), other=int(vsum - dsum - rsum), total=int(vsum)),
        polls=sorted(used, key=lambda p: p["age"]), pollWeight=round(wp, 3),
        pollAvg=round(-two(pl), 2) if pl is not None else None,
        legs=dict(weights={k: round(v, 3) for k, v in ww.items()},
                  topOfTicket=-two(S["Tst"]), blend=-two(pre), withCandidates=-two(mid), final=-two(fin),
                  history=(-two(hl) if hl is not None else None), candidateTerm=round(cand, 3), topRaces=S["tops"], anchor=S["src"]),
        history=hist_years or {}, primary=prim_note, otherShare=round(100 * osh, 1))
    out_races.append(base)
    out_counties[rid] = rows
    for f in fips: out_counties["_n"].setdefault(f, str(COUNTY_NAME.get(f, f)))
    log.append((rid, round(margin_r, 1), round(1 - prob_r, 3), "H" in ww, "P" in ww, len(used)))

meta = dict(updated=str(TODAY.date()), races=len(out_races), modeled=sum(1 for r in out_races if "uncontested" not in r),
            weights=W, incumbency=INC, unity=dict(k=UNITY_K, cap=UNITY_CAP), natPrimaryGap=round(nat_gap, 3),
            offices=OFFICE_LABEL)
json.dump(dict(meta=meta, races=out_races), open(f"{PUB}/downballot.json", "w"), separators=(",", ":"), default=float)
json.dump(out_counties, open(f"{PUB}/downballot_counties.json", "w"), separators=(",", ":"))
pd.DataFrame(log).to_csv("/tmp/elecdata/downballot_log.csv", index=False, header=False)
print(f"{len(out_races)} races, {meta['modeled']} modeled, national primary gap {nat_gap:+.3f}")
for x in log: print(*x)
