"""Final methodology layer, Oct 26 2026.

Every Senate, governor and House race gets a final method estimate from three legs. The published target is 0.35 of the
current model, rerun in full the same day with the early vote inside its electorate (EV_ELECTORATE, ev_electorate.py) and
with the old ev_adjust correction taken out, and 0.65 of the final method (FM_BLEND), by the user's choice that the final
method pull harder.

  Gallup leg     county base = 0.5 x 2024 president + 0.5 x the seat's last result recentred to the state's 2024 lean,
                 moved 14 points toward Democrats (Gallup Q3 2024 R48 D45 to Q3 2026 D50 R39) times the county's
                 elasticity: its swing between the last two races for the office against the state's, shrunk halfway
                 to 1 and clipped to 0.5 to 1.6. An incumbent governor on the ballot gets 0.6 of the move.
  Electorate leg the final electorate by 2024 vote group, the forecast's expected mix moved by the early vote (full
                 strength where party is reported, 0.35 where it is estimated), read as party identification, then
                 votes from On Point Polling party by Trump approval cells with approval set to 37.1 nationally plus the
                 state's lean.
  Poll leg       the site's poll average.
  Weights        before 10 percent of the expected vote is cast: Gallup 0.35, electorate 0.20, polls 0.45; from a
                 third cast: 0.325, 0.325, 0.35; linear in between. No polls: Gallup and electorate split the weight.
  Candidate      incumbent personal vote in full on the electorate leg and half on the Gallup leg (the seat's last
                 result already carries half), the donor term on both.
  House          district Gallup leg from its 2024 presidential vote and, where the same member runs on unchanged
                 lines, its 2024 House result; electorate leg the district's 2024 vote moved by its state's electorate
                 swing at the district's elasticity; district polls at most 0.35.

Margins here are Democratic minus Republican points of the total vote unless named otherwise.
Writes /tmp/fcrun/fm/targets.json and /tmp/fcrun/fm/board.csv.
"""
import json, glob, os, math, sys
import numpy as np, pandas as pd

OUT = "/tmp/fcrun/fm"
PUB = "/tmp/site/public/forecast"
RUNS = "/tmp/fcrun/runs"
LATEST = "/tmp/claude-0/-home-claude/2fe66b6b-24b4-5fab-b0f7-c44b6f59cc0e/scratchpad/LATEST.json"
EVS = os.environ.get("EVS", "/tmp/site/scripts/forecast/earlyvote/snapshots/2026-10-26/ev_signals.json")
ELECT = "/tmp/site/public/earlyvote-electorate.json"
RESP = "/tmp/fcrun/TPSI_B/model/tpsi_db/TPSI_Unified_Respondent_Dataset.csv"
H_RES = "/mnt/attach/outputs/house_2024_2022_general_results.csv"
TICKET = "/tmp/pvi/house_ticket_term.json"
DONOR = "/tmp/fcrun/donors/donor_signals.json"

GALLUP_SHIFT = 14.0
NAT_APPROVE = 0.371
INC_GOV_SCALE = 0.6
W_EARLY, W_LATE = (0.35, 0.20, 0.45), (0.325, 0.325, 0.35)
EST_STRENGTH = 0.35
HOUSE_POLL_CAP = 0.35
BLEND = float(os.environ.get("FM_BLEND", "0.65"))   # share of the final method in the published target; the user wants it to pull harder than the current model
NAT_H24, NAT_P24 = -2.6, -1.5    # 2024 national House and presidential margins, D minus R

lg = lambda p: math.log(p / (1 - p))
inv = lambda x: 1 / (1 + math.exp(-x))
shrink = lambda e: float(np.clip(1 + 0.5 * (e - 1), 0.5, 1.6))

m = json.load(open(f"{PUB}/model.json"))
C = json.load(open(f"{PUB}/counties.json"))
EV = json.load(open(EVS))["states"]
E = json.load(open(ELECT))
donor = json.load(open(DONOR))

# ---- cells from On Point Polling likely voters -------------------------------------------------------------------
R = pd.read_csv(RESP, low_memory=False, usecols=["party_id", "recall_2024", "trump_approve", "generic_ballot", "weight_lv"])
R = R[R.weight_lv > 0]
R["A"] = R.trump_approve.isin(["Strongly approve", "Somewhat approve"])
PARTIES = ["Democrat", "Republican", "Independent"]
wsum = lambda x: x.weight_lv.sum()
a_p = {p: float((R.A * R.weight_lv)[R.party_id == p].sum() / wsum(R[R.party_id == p])) for p in PARTIES}
two = R[R.generic_ballot.isin(["Democrat", "Republican"])].copy(); two["D"] = (two.generic_ballot == "Democrat").astype(float)
cell = {}
for p in PARTIES:
    for a in (True, False):
        x = two[(two.party_id == p) & (two.A == a)]
        cell[(p, a)] = float((x.D * x.weight_lv).sum() / x.weight_lv.sum())
R["g"] = R.recall_2024.map({"Trump": 0, "Harris": 1}).fillna(2).astype(int)
pg = R.groupby(["g", "party_id"]).weight_lv.sum().unstack().reindex(columns=PARTIES).fillna(0)
pg = pg.div(pg.sum(1), axis=0)                    # party identification within each 2024 vote group

def party_mix(groups):
    return {p: sum(groups[g] * pg.iloc[g][p] for g in range(3)) for p in PARTIES}

def approval_shift(mix, target):
    lo, hi = -5.0, 5.0
    for _ in range(60):
        k = 0.5 * (lo + hi)
        v = sum(mix[p] * inv(lg(a_p[p]) + k) for p in PARTIES)
        lo, hi = (k, hi) if v < target else (lo, k)
    return 0.5 * (lo + hi)

def d2_from(mix, k):
    return sum(mix[p] * (inv(lg(a_p[p]) + k) * cell[(p, True)] + (1 - inv(lg(a_p[p]) + k)) * cell[(p, False)]) for p in PARTIES)

# ---- state approval lean from the published county approvals -----------------------------------------------------
base_runs = [x for x in os.environ.get("FM_RUNS_FIRST", "").split(",") if x] + json.load(open(LATEST))["base_runs_for_next_sweep"].split(",")
loc = {}
for run in base_runs:
    for f in sorted(glob.glob(f"{RUNS}/{run}/lane*/run_summary.json")):
        for k, v in json.load(open(f))["results"].items(): loc.setdefault(k, (os.path.dirname(f), v))
def cfile(k):
    d, v = loc[k]; off = "governor" if len(k) == 3 and k.endswith("G") else "senate"
    p = f"{d}/{v['state'].lower().replace(' ', '_')}_2026_{off}_county_forecast.csv"
    return pd.read_csv(p, dtype={"county_fips": str}) if os.path.exists(p) else None
st_app = {}
for k in loc:
    st = k[:2]
    if st in st_app: continue
    c = cfile(k)
    if c is None or "county_trump_approve_published" not in c: continue
    w = c.projected_turnout.fillna(0); st_app[st] = float((c.county_trump_approve_published * w).sum() / w.sum() / 100)
tw = {st: E["states"][st]["turnout"] for st in st_app if st in E["states"]}
nat_pub = inv(sum(lg(st_app[s]) * tw[s] for s in tw) / sum(tw.values()))
def approve_target(st):
    if st not in st_app: return None
    return inv(lg(NAT_APPROVE) + lg(st_app[st]) - lg(nat_pub))

# national calibration check on the national expected electorate
nat_mix = party_mix(E["nation"]["electorate"])
d2_at = lambda mix, A: d2_from(mix, approval_shift(mix, A))
# the approval level that gives the 2024 result on the 2024 electorate, so the leg is read as a swing from 2024
g24n = [0.5076, 0.4924, 0.0]
lo, hi = 0.2, 0.8
for _ in range(60):
    A = 0.5 * (lo + hi)
    lo, hi = (lo, A) if d2_at(party_mix(g24n), A) < 0.4925 else (A, hi)
A24 = 0.5 * (lo + hi)

# ---- electorate leg by state -------------------------------------------------------------------------------------
ELEC = {}
for st, s in E["states"].items():
    fc = s["electorate"]; ev = EV.get(st)
    if ev and ev.get("projected") and ev.get("forecastElectorate"):
        k_ = EST_STRENGTH if (ev.get("estimatedShare") or 0) >= 0.5 else 1.0
        g = [fc[i] + k_ * (ev["projected"][i] - ev["forecastElectorate"][i]) for i in range(3)]
        banked = ev["ballots"] / max(1, ev.get("expectedTotal") or s["turnout"])
    else:
        g, k_, banked = list(fc), 0.0, 0.0
    g = [x / sum(g) for x in g]
    mix = party_mix(g)
    # section 3: the state's lean is its 2024 presidential margin against the national Trump +1.47, half of it in approval
    lean = 0.5 * (float(s["margin24"]) - 1.47) / 100 / (NAT_APPROVE * (1 - NAT_APPROVE))
    t24 = s["trump24"]; h24 = t24 - s["margin24"] / 100
    mix24 = party_mix([t24 / (t24 + h24), h24 / (t24 + h24), 0.0])
    A26s, A24s = inv(lg(NAT_APPROVE) + lean), inv(lg(A24) + lean)
    swing = 200 * (d2_at(mix, A26s) - d2_at(mix24, A24s))
    pm24 = -float(s["margin24"])
    ELEC[st] = dict(groups=[round(x, 4) for x in g], ev_strength=k_, banked=round(min(1.0, banked), 3),
                    party_rd=round(100 * (mix["Republican"] - mix["Democrat"]), 1), approve=round(100 * A26s, 1),
                    approve24=round(100 * A24s, 1), swing=swing, m2p=pm24 + swing, pm24=pm24)

def weights(banked, has_polls):
    t = float(np.clip((banked - 0.10) / (1 / 3 - 0.10), 0, 1))
    w = [W_EARLY[i] + t * (W_LATE[i] - W_EARLY[i]) for i in range(3)]
    if not has_polls:
        s = w[0] + w[1]; w = [w[0] / s, w[1] / s, 0.0]
    return w

# ---- statewide races ---------------------------------------------------------------------------------------------
key_of = lambda r: r["st"] if r["office"] == "senate" else r["st"] + "G"
targets, board = {"statewide": {}, "house": {}}, []
SKIPPED = []
CARRY_PRIOR = {"sen-NE": 13.8, "sen-AK": 10.7, "sen-OH": 7.6, "sen-NC": 5.8}
SITE = {x["id"]: x for x in json.load(open(os.environ.get("FM_SITE_AVG", "/tmp/fcrun/siteavg/site_avg_S1026GF.json"))) if "error" not in x}
NAT = {2008: 7.3, 2012: 3.9, 2014: -5.7, 2016: 2.1, 2017: 8.6, 2018: 8.6, 2020: 4.5, 2022: -2.8, 2024: -1.5}
for r in m["races"]:
    if r["office"] not in ("senate", "governor"): continue
    k = key_of(r); e = r["est"]
    if abs(e["margin"]) >= 99.9 or k not in loc: continue
    vt0 = r.get("votes") or {}
    if vt0.get("total") and not r.get("rcv") and vt0.get("other", 0) / vt0["total"] > 0.10:
        SKIPPED.append((r["id"], "three way race, the two party legs do not apply")); continue
    c = cfile(k)
    if c is None: continue
    st = r["st"]; off = r["office"]; v = loc[k][1]
    ev_shift = (r.get("ev") or {}).get("shift", 0.0)            # R positive, inside the published margin
    pub_d = -e["margin"]; cur_d = pub_d + ev_shift                # current model without the retired early vote term
    vt = r.get("votes") or {}
    two_share = (vt.get("dem", 0) + vt.get("rep", 0)) / vt["total"] if vt.get("total") and not r.get("rcv") else 1.0
    w = c.projected_turnout.fillna(0).values; W = w.sum()
    pm24 = 2 * c.pres_2024_d2.values - 100
    hist = sorted([x for x in c.columns if x.startswith(off + "_") and x.endswith("_d2")], reverse=True)
    prev = 2 * c[hist[0]].values - 100 if hist else pm24
    prev = np.where(np.isnan(prev), pm24, prev)
    PM24 = (pm24 * w).sum() / W; PREV = (prev * w).sum() / W
    inc_running = not r.get("open", True)
    yr = int(hist[0].split("_")[1]) if hist else 2024
    # section 2: half the 2024 county margin plus half the seat's previous result recentred to the 2024 statewide level
    prev_rc = prev - PREV + PM24
    base = 0.5 * pm24 + 0.5 * prev_rc
    # section 6.1: elasticity from the last two Senate or the last two governor races in the state, whichever pair is more recent
    el_csv = c.elasticity.fillna(1.0).values
    pairs = []
    for kk in {k, (st if off == "governor" else st + "G")}:
        if kk not in loc: continue
        cx = c if kk == k else cfile(kk)
        if cx is None: continue
        o2 = "governor" if len(kk) == 3 and kk.endswith("G") else "senate"
        hh = sorted([x for x in cx.columns if x.startswith(o2 + "_") and x.endswith("_d2")], reverse=True)
        if len(hh) >= 2:
            cx = cx.set_index(cx.county_fips.astype(str)).reindex(c.county_fips.astype(str))
            pairs.append((int(hh[1].split("_")[1]), int(hh[0].split("_")[1]), 2 * cx[hh[0]].values - 100, 2 * cx[hh[1]].values - 100, o2))
    el = el_csv; el_pair = None
    if pairs:
        y2, y1, a1, a2, o2 = max(pairs, key=lambda x: (x[0], x[1]))
        ok = ~(np.isnan(a1) | np.isnan(a2))
        if ok.sum() >= 1:
            S1 = (a1 * w)[ok].sum() / w[ok].sum(); S2 = (a2 * w)[ok].sum() / w[ok].sum()
            if abs(S1 - S2) >= 3:
                el = np.where(ok, (a1 - a2) / (S1 - S2), el_csv); el_pair = f"{o2} {y2} and {y1}"
    el = np.array([shrink(x) if np.isfinite(x) else 1.0 for x in el])
    env = GALLUP_SHIFT * (INC_GOV_SCALE if (off == "governor" and inc_running) else 1.0)
    istr = v.get("incumbent_strength") or {}
    # section 6.1: the measured personal vote from senate_mode, added after the blend; a governor seeking reelection takes
    # the same carry of how far his last race ran ahead of the 2024 lean, net of that year's national vote
    pv = float(istr.get("shift_pts_in_fundamental_legs") or 0.0) if (off == "senate" and inc_running) else 0.0
    if off == "governor" and inc_running:
        pv = 0.612 * (float(((prev - (NAT.get(yr, 0.0) - NAT_P24)) * w).sum() / W) - PM24)
    # the same measured personal vote for a nominee who already ran statewide against a different opponent: how far that
    # race ran ahead of the top of the ticket, at the same 0.612 carry. Osborn, Senate 2024 R+6.7 against Trump +20.5;
    # Peltola, at large House 2024 R+2.4 against Trump +13.1; Brown, Senate 2024 R+3.6 against Trump +11.2; Cooper,
    # governor 2020 D+4.5 against Trump +1.3. Their seat's previous result is a different race, so the recentred base
    # does not carry it.
    pv += 0.612 * CARRY_PRIOR.get(r["id"], 0.0)
    dn = float((donor["statewide"].get(k) or {}).get("shift_logit", 0.0)) * 50.0
    G_c = (base + env * el) * two_share                          # no turnout term in this leg
    G = float((G_c * w).sum() / W)
    El = ELEC[st]
    E_state = (PM24 + El["swing"]) * two_share
    # county pattern of the electorate leg: 2024 president moved by the state's electorate swing at county elasticity
    E_c = (pm24 + El["swing"] * el / ((el * w).sum() / W)) * two_share
    E_c = E_c + (E_state - (E_c * w).sum() / W)
    # the poll leg: the site's aggregated polling averages, the ones the polls pages show
    P = None
    sa = SITE.get(f"{st.lower()}-{'gov' if off == 'governor' else 'sen'}-2026")
    if sa and sa.get("a") is not None and sa.get("polls"):
        rA = "(R)" in str(sa.get("keyA", ""))
        dd, rr = (sa["b"], sa["a"]) if rA else (sa["a"], sa["b"])
        P = (200 * dd / (dd + rr) - 100) * two_share
    elif r.get("pollAvg") is not None and float(r.get("enop") or 0) > 0:
        P = -r["pollAvg"]
    wG, wE, wP = weights(El["banked"], P is not None)
    cand = (pv + dn) * (wG + wE)                                  # candidate terms ride on the two legs, not on the polls
    N = wG * G + wE * E_state + (wP * P if P is not None else 0.0) + cand
    G_c = G_c + pv + dn; E_c = E_c + pv + dn
    T = (1 - BLEND) * cur_d + BLEND * N
    # counties: published county margins without their early vote term
    cc = C.get(r["id"]) or {}
    evm = cc.get("_ev") or {}
    fips = c.county_fips.astype(str).values
    Cc = {}
    for f, row in cc.items():
        if f.startswith("_"): continue
        Cc[f] = -(row[0] - evm.get(f, 0.0))
    ctab = {}
    Gs = dict(zip(fips, G_c)); Es = dict(zip(fips, E_c))
    cur_state_c = None
    if Cc:
        tws = {f: cc[f][3] for f in Cc}; tsum = sum(tws.values()) or 1
        cur_state_c = sum(Cc[f] * tws[f] for f in Cc) / tsum
    for f in Cc:
        g_ = Gs.get(f, Gs.get(f.zfill(5), G)); e_ = Es.get(f, Es.get(f.zfill(5), E_state))
        p_ = Cc[f] + (P - cur_state_c) if (P is not None and cur_state_c is not None) else 0.0
        n_ = wG * g_ + wE * e_ + (wP * p_ if P is not None else 0.0)
        ctab[f] = (1 - BLEND) * Cc[f] + BLEND * n_
    if ctab:                                                     # counties add back to the state target
        tws = {f: cc[f][3] for f in ctab}; tsum = sum(tws.values()) or 1
        fix = T - sum(ctab[f] * tws[f] for f in ctab) / tsum
        ctab = {f: x + fix for f, x in ctab.items()}
    targets["statewide"][k] = dict(id=r["id"], published_d=pub_d, ev_shift_r=ev_shift, current_d=cur_d, gallup=G,
                                   electorate=E_state, polls=P, weights=[wG, wE, wP], final_method=N, target_d=T,
                                   delta_d=T - pub_d, counties={f: ctab[f] - (-cc[f][0]) for f in ctab},
                                   party_rd=El["party_rd"], approve=El["approve"], banked=El["banked"],
                                   pv=pv, donor=dn, inc_gov=(off == "governor" and inc_running), elasticity_pair=el_pair)
    board.append(dict(race=r["id"], name=r["name"], dem=r["dem"], gop=r["gop"], published=round(pub_d, 2),
                      ev_retired=round(-ev_shift, 2), current=round(cur_d, 2), gallup=round(G, 2), electorate=round(E_state, 2),
                      polls=None if P is None else round(P, 2), w=f"{wG:.3f}/{wE:.3f}/{wP:.3f}", final_method=round(N, 2),
                      target=round(T, 2), move=round(T - pub_d, 2), party_rd=El["party_rd"], banked=El["banked"]))

# ---- House ----------------------------------------------------------------------------------------------------------
hres = pd.read_csv(H_RES)
hres = hres[(hres.year == 2024) & hres.uncontested.isna()]
H24 = {r.district: 100 * (r.dem_votes - r.rep_votes) / (r.dem_votes + r.rep_votes) for r in hres.itertuples() if r.dem_votes + r.rep_votes > 0}
ticket = json.load(open(TICKET))
def house_base_dir():
    return f"{RUNS}/S1025DN/house"
newest = {}
for run in [x for x in os.environ.get("FM_RUNS_FIRST", "").split(",") if x] + ["S1026HD", "S1025PM", "S1025DN"]:
    for f in glob.glob(f"{RUNS}/{run}/house/*_2026_house_district_forecast.csv"):
        newest.setdefault(os.path.basename(f), f)
SLUG = {}
for r in m["races"]:
    if r["office"] == "house": SLUG.setdefault(r["st"], r["state"].lower().replace(" ", "_"))
HT = {}
for b, f in newest.items():
    d = pd.read_csv(f); st_slug = b.split("_2026_")[0]
    for x in d.itertuples(): HT[(st_slug, int(x.district))] = x
for r in m["races"]:
    if r["office"] != "house": continue
    e = r["est"]
    if abs(e["margin"]) >= 99.9: continue
    st = r["st"]; dist = int(r["district"]) if r["district"] else 1
    x = HT.get((SLUG[st], dist)) or HT.get((SLUG[st], 0))
    if x is None: continue
    ev_shift = (r.get("ev") or {}).get("shift", 0.0)
    pub_d = -e["margin"]; cur_d = pub_d + ev_shift
    vt = r.get("votes") or {}
    two_share = (vt.get("dem", 0) + vt.get("rep", 0)) / vt["total"] if vt.get("total") else 1.0
    code = f"{st}-{dist:02d}"
    pm = 200 * x.d2_24 - 100
    p_ = min(0.97, max(0.03, x.d2_24))
    lt = lambda t: 0.0 if pd.isna(t) else float(t)
    terms_logit = lt(x.prim_term) + lt(x.unity_shift) + lt(x.finance_term) + lt(x.donor_term)
    cand = lt(x.cand_pts) + 200 * p_ * (1 - p_) * terms_logit
    use_h = code in ticket and code in H24
    base = 0.5 * pm + 0.5 * (H24[code] - (NAT_H24 - NAT_P24)) if use_h else pm
    el = shrink(lt(x.elasticity) or 1.0)
    G = (base + GALLUP_SHIFT * el) * two_share + (0.0 if use_h else cand)
    if use_h: G += 200 * p_ * (1 - p_) * (lt(x.prim_term) + lt(x.unity_shift) + lt(x.finance_term) + lt(x.donor_term))
    El = ELEC.get(st)
    tk = 200 * p_ * (1 - p_) * lt(x.ticket_term)
    Ev = (pm + El["swing"] * el) * two_share + cand + tk if El else G
    P = (200 * x.poll_d2 - 100) * two_share if not pd.isna(x.poll_d2) else None
    # section 6.3: district polls carry what the House engine gave them, read off its own blend (final against model and
    # poll two party shares), capped at 0.35
    wP = 0.0
    if P is not None:
        gap = float(x.poll_d2) - float(x.model_d2)
        wP = (float(x.final_d2) - float(x.model_d2)) / gap if abs(gap) >= 0.004 else 0.25
        wP = float(np.clip(wP, 0.05, HOUSE_POLL_CAP))
    wG = wE = (1 - wP) / 2
    N = wG * G + wE * Ev + (wP * P if P is not None else 0.0)
    T = (1 - BLEND) * cur_d + BLEND * N
    targets["house"][code] = dict(id=r["id"], slug=SLUG[st], district=int(x.district), published_d=pub_d, ev_shift_r=ev_shift,
                                  current_d=cur_d, gallup=G, electorate=Ev, polls=P, weights=[wG, wE, wP], final_method=N,
                                  target_d=T, delta_d=T - pub_d, house_prior=use_h)
    board.append(dict(race=r["id"], name=r["name"], dem=r["dem"], gop=r["gop"], published=round(pub_d, 2),
                      ev_retired=round(-ev_shift, 2), current=round(cur_d, 2), gallup=round(G, 2), electorate=round(Ev, 2),
                      polls=None if P is None else round(P, 2), w=f"{wG:.3f}/{wE:.3f}/{wP:.3f}", final_method=round(N, 2),
                      target=round(T, 2), move=round(T - pub_d, 2), party_rd=El["party_rd"] if El else None,
                      banked=El["banked"] if El else None))

targets["meta"] = dict(cells={f"{p}|{'approve' if a else 'not'}": round(v, 4) for (p, a), v in cell.items()},
                       party_approve={p: round(v, 4) for p, v in a_p.items()}, nat_pub_approve=round(nat_pub, 4),
                       nat_mix={p: round(v, 4) for p, v in nat_mix.items()},
                       nat_d2=round(d2_at(nat_mix, NAT_APPROVE), 4), approve24=round(A24, 4),
                       electorate=ELEC,
                       blend=BLEND, gallup_shift=GALLUP_SHIFT, skipped=SKIPPED)
json.dump(targets, open(f"{OUT}/targets.json", "w"), indent=1, default=float)
pd.DataFrame(board).to_csv(f"{OUT}/board.csv", index=False)
print("statewide", len(targets["statewide"]), "house", len(targets["house"]), "nat d2", targets["meta"]["nat_d2"], "cells", targets["meta"]["cells"])
