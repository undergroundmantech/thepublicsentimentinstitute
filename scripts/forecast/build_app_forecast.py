"""Build the /forecast data files the site's Forecast desk reads, from the published TPSI forecasts.

Writes public/forecast/{model.json, geo.json, counties.json, states/<ST>.json}, in the shapes
app/forecast/lib.ts declares. Geometry comes from the published pages (national frame 975 x 610);
county and district paths are re-projected into the desk's 900 x 620 state viewBox.
"""
import json, os, re, math, glob
from datetime import date
import numpy as np, pandas as pd

SRC = os.environ.get("SRC_HTML", "/mnt/user-data/outputs/forecast_html")
RUN = "/tmp/claude-0/-home-claude/2fe66b6b-24b4-5fab-b0f7-c44b6f59cc0e/scratchpad/rerun"
HOUSE_SIM = os.environ.get("HOUSE_SIM", "/tmp/pvi/house_nogal")
OUT = "/tmp/pvi/appwork/public/forecast"
UPDATED = os.environ.get("UPDATED", "2026-09-22")
ELECTION = "2026-11-03"
# daysOut used to be the literal 42, written when UPDATED was 2026-09-22 and never touched
# again, so the site kept saying 42 days to go on every later run. It is derived now.
DAYS_OUT = (date.fromisoformat(ELECTION) - date.fromisoformat(UPDATED)).days
SIMS = 2000
NAT24_D_MARGIN = -1.5          # 2024 national presidential margin, D positive
SEN_NOT_UP_D, SEN_NOT_UP_R = 34, 31
# The 14 governorships not on the 2026 ballot: DE, KY, NC, NJ, VA and WA are held by
# Democrats, IN, LA, MO, MS, MT, ND, UT and WV by Republicans. Counting them is what
# puts the governors on the same footing as the Senate, where the seats not up have
# always been counted, and it is the basis the governor page's own odds are on.
GOV_NOT_UP_D, GOV_NOT_UP_R = 6, 8

os.makedirs(f"{OUT}/states", exist_ok=True)
S = json.load(open(f"{SRC}/onpoint-senate-forecast-data.json"))
G = json.load(open(f"{SRC}/onpoint-governor-forecast-data.json"))
H = json.load(open(f"{SRC}/onpoint-house-forecast-data.json"))
RS = json.load(open(os.environ.get("RES_DIR", f"{RUN}/output") + "/run_summary.json"))["results"]

FIPS2AB = {v["fips"]: k for k, v in H["states"].items() if "fips" in v}
AB2FIPS = {k: v for v, k in FIPS2AB.items()}
STATE_NAME = {k: v["name"] for k, v in H["states"].items()}

# ── path helpers ────────────────────────────────────────────────────────────
NUM = re.compile(r"(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)")

def path_bbox(d):
    xs, ys = [], []
    for m in NUM.finditer(d):
        xs.append(float(m.group(1))); ys.append(float(m.group(2)))
    return (min(xs), min(ys), max(xs), max(ys)) if xs else (0, 0, 1, 1)

def transform(d, sc, tx, ty):
    return NUM.sub(lambda m: f"{float(m.group(1)) * sc + tx:.1f},{float(m.group(2)) * sc + ty:.1f}", d)

def fit(paths, W=900, H_=620, pad=18):
    """one scale and offset that fits every path into the desk's state viewBox"""
    x0 = y0 = 1e9; x1 = y1 = -1e9
    for d in paths:
        a, b, c, e = path_bbox(d)
        x0, y0, x1, y1 = min(x0, a), min(y0, b), max(x1, c), max(y1, e)
    sc = min((W - 2 * pad) / max(x1 - x0, 1e-6), (H_ - 2 * pad) / max(y1 - y0, 1e-6))
    tx = (W - (x1 - x0) * sc) / 2 - x0 * sc
    ty = (H_ - (y1 - y0) * sc) / 2 - y0 * sc
    return sc, tx, ty

# ── simulations ─────────────────────────────────────────────────────────────
sim_margin = {}                     # race key -> [sims] D positive margin
for f in glob.glob(os.environ.get("RES_DIR", f"{RUN}/output") + "/sim_margin_*.npy"):
    sim_margin[os.path.basename(f)[11:-4]] = np.load(f)
house_seats = np.load(f"{HOUSE_SIM}/national_dem_seats.npy")
house_win = {}                      # state abbr -> [sims, districts] 0/1 Democratic win
for f in glob.glob(f"{HOUSE_SIM}/win_*.npy"):
    slug = os.path.basename(f)[4:-4]
    ab = next((k for k, v in STATE_NAME.items() if v.lower().replace(" ", "_") == slug), None)
    if ab: house_win[ab] = np.load(f)

RECENTER_MIN = 0.75   # points; every consistent race sits inside 0.35 of its own median

def side_from_sims(m, margin_now, prob=None, recenter=False):
    """RaceSide from a D positive simulated margin vector, in the desk's GOP positive sign.

    recenter=True shifts the whole simulated vector so its median lands on margin_now
    before anything is read off it. That is only ever wanted where the caller replaces
    the headline margin with a figure the simulation does not itself produce, which in
    practice means a ranked choice race: the final round decides it, the simulated vector
    is a head to head margin, and the gap between them is the transfer effect.

    Leaving them unaligned is what put Alaska on the board as Peltola +1.4 next to
    Sullivan 57 percent to win. The simulated vector sat 1.9 points to the Republican of
    the final round margin, so the headline and the odds straddled zero and named
    different winners. Every other race agrees with its own simulation to about a quarter
    of a point, which is histogram bin noise.

    The shift assumes the transfer effect is constant across simulations. That is the
    same assumption already built into publishing one final round number, so it adds no
    new one; it just applies it consistently. When recentering, the probability is taken
    from the shifted vector rather than from the run summary, whose win probability is
    computed on the unshifted head to head and would otherwise disagree by construction.
    """
    g = -np.asarray(m, float)
    # Only a real disagreement is corrected. When the run is consistent the headline is
    # the simulated mean and sits a tenth or two off the median, and shifting on that
    # would move the probability for no reason: Alaska Senate on the Sept 25 run would
    # have printed 78.5 percent against the run's own 77.1.
    if recenter and abs(-margin_now - float(np.median(g))) > RECENTER_MIN:
        g = g + (-margin_now - float(np.median(g)))
        prob = None                                     # must come from the shifted vector
    p10, p90 = float(np.percentile(g, 10)), float(np.percentile(g, 90))
    lo, hi = float(np.floor(g.min())), float(np.ceil(g.max()))
    nb = 40
    w = max((hi - lo) / nb, 0.25)
    counts, _ = np.histogram(g, bins=np.arange(lo, lo + w * (nb + 1), w))
    return dict(margin=round(-margin_now, 2), prob=round(float((g > 0).mean()) if prob is None else prob, 4),
                p10=round(p10, 2), p90=round(p90, 2),
                dist=dict(lo=round(lo, 2), w=round(w, 3), c=[int(c) for c in counts]))

def incumbency(seat, open_seat, dem, gop):
    """Which side the sitting member is on, read from what the seat note actually says.

    This used to look for either candidate's surname anywhere in the note, which is a
    trap, because the note is free text about how the ballot came to look the way it
    does, not a statement about incumbency. "Democrat withdrew for independent Dan
    Osborn" made Osborn the incumbent; so did Bengs in South Dakota and Achilles in
    Idaho, when in each case the sitting senator is the Republican they are running
    against. Maine's "Collins seeking a sixth term - Jackson replaced Platner" names
    both, and the Democrat was checked first, so Collins lost her own incumbency.
    South Carolina's "Darline Graham nominated after Lindsey Graham's death" matched on
    the surname and made the challenger an incumbent.

    Only three things in a seat note actually assert incumbency: an open seat (nobody),
    "<name> seeking / running for a term" and "<name> appointed". A note that merely
    explains how a nominee got there asserts nothing, and 0 is the honest answer.
    """
    s = (seat or "").lower()
    if open_seat: return 0
    dl, gl = dem.split()[-1].lower(), gop.split()[-1].lower()
    for pat in (r"([^\s,]+)\s+seeking\b", r"([^\s,]+)\s+running for a\b", r"([^\s,]+)\s+appointed\b"):
        m = re.search(pat, s)
        if m:
            nm = m.group(1).strip(".,")
            if nm == dl: return -1
            if nm == gl: return 1
    # "Democrat withdrew for independent X" in a seat that is not open: the party that
    # did not withdraw is the one holding it, so its nominee is the incumbent.
    m = re.search(r"(democrat|republican)\s+withdrew for independent", s)
    if m:
        return 1 if m.group(1) == "democrat" else -1
    return 0

def side_flat(margin_now, prob, p10, p90):
    return dict(margin=round(-margin_now, 2), prob=round(prob, 4), p10=round(-p90, 2), p90=round(-p10, 2))

# ── polls ───────────────────────────────────────────────────────────────────
def poll_rows(key, office, state):
    nm = state.lower().replace(" ", "_")
    f = f"{RUN}/output/{nm}{'_governor' if office == 'governor' else ''}_poll_average_inputs.csv"
    if not os.path.exists(f): return []
    d = pd.read_csv(f)
    out = []
    for r in d.itertuples():
        try:
            days = int((pd.Timestamp("2026-09-22") - pd.Timestamp(r.end)).days)
        except Exception:
            days = 0
        D = float(getattr(r, "D", np.nan)); R = float(getattr(r, "R", np.nan))
        if not np.isfinite(D) or not np.isfinite(R): continue
        out.append(dict(pollster=str(r.source), kind=str(getattr(r, "pop", "LV")), age=days,
                        n=int(getattr(r, "n", 0) or 0), margin=round(R - D, 1)))
    out.sort(key=lambda p: p["age"])
    return out[:14]

def daily_series(key, office, state):
    nm = state.lower().replace(" ", "_")
    f = f"{RUN}/output/{nm}{'_governor' if office == 'governor' else ''}_daily_poll_average.csv"
    if not os.path.exists(f): return None
    d = pd.read_csv(f)
    dt = next((c for c in d.columns if c.lower() in ("date", "day", "t")), None)
    if dt is None: return None
    col = next((c for c in d.columns if c.lower() in ("d2", "dem_two_party", "two_party_d")), None)
    if col is not None:
        d = d[[dt, col]].dropna().tail(60)
        if len(d) < 5: return None
        return d[dt].astype(str).tolist(), (200 * d[col].astype(float) - 100).tolist()   # D positive margin
    dc = next((c for c in d.columns if c.upper() == "D"), None)
    rc = next((c for c in d.columns if c.upper() == "R"), None)
    if dc is None or rc is None: return None
    d = d[[dt, dc, rc]].dropna().tail(60)
    if len(d) < 5: return None
    dd, rr = d[dc].astype(float), d[rc].astype(float)
    return d[dt].astype(str).tolist(), (200 * dd / (dd + rr).clip(lower=1e-6) - 100).tolist()

# ── races ───────────────────────────────────────────────────────────────────
races = []
OFFICE_OF = {}

def statewide(page, office, prefix):
    for fips, r in page["races"].items():
        ab = FIPS2AB.get(fips)
        if ab is None: continue
        key = next((k for k in RS if k[:2] == ab and (k.endswith("G") and len(k) == 3) == (office == "governor")), None)
        if key is None: continue
        v = RS[key]
        rid = f"{prefix}-{ab}"
        OFFICE_OF[rid] = key
        cands = r["cands"]
        dem, gop = cands[0][0], cands[1][0]
        tv_all = int(round(r.get("totalVotes") or 0))
        sw = r.get("statewide") or [0, 0]
        # Every named candidate, not just the top two. Without this the desk shows
        # Rhode Island as Foulkes against Guckian and silently drops Ken Block, who
        # is projected to finish ahead of the Republican.
        cand_rows = [dict(name=nm, party=pty,
                          pct=round(float(sw[i]), 2) if i < len(sw) else 0.0,
                          votes=int(round(tv_all * float(sw[i]) / 100)) if i < len(sw) else 0)
                     for i, (nm, pty) in enumerate(cands)]
        dv_all = int(round(tv_all * float(sw[0]) / 100))
        rv_all = int(round(tv_all * float(sw[1]) / 100))
        votes = dict(dem=dv_all, rep=rv_all, other=max(0, tv_all - dv_all - rv_all), total=tv_all)
        # Alaska is ranked choice. The page publishes a first-choice margin and a
        # final round; the race is decided by the final round, so that is the
        # margin the desk carries, taken from the page itself rather than from
        # the run summary, whose own rcv figure does not agree with it.
        # race["margin"] is the final round for a ranked choice race, so the first choice
        # margin has to come from the rcv block rather than from it.
        mg = (r.get("rcv") or {}).get("first", r["margin"])   # D positive, first choice / leader
        rcv = r.get("rcv")
        margin = round(rcv["pct"][0] - rcv["pct"][1], 2) if rcv else mg
        sims = sim_margin.get(key)
        prob_d = v["simulation"]["win_prob_dem_side"] / 100
        side = (side_from_sims(sims, margin, prob=1 - prob_d, recenter=rcv is not None) if sims is not None
                else side_flat(margin, 1 - prob_d, v["simulation"]["margin_p10"], v["simulation"]["margin_p90"]))
        seat = r.get("seat", "")
        open_seat = "open seat" in seat.lower()
        inc = incumbency(seat, open_seat, dem, gop)
        pavg = v.get("poll_avg", {})
        pa = None if v["n_polls"] == 0 or pavg.get("D2") is None else round(100 - 200 * pavg["D2"], 2)
        fund = v.get("candidate", {}).get("fundamentals_d2")
        fundm = round(100 - 200 * fund, 2) if fund else round(-margin, 2)
        races.append(dict(
            id=rid, office=office, st=ab, state=r["state"], district=0,
            name=r["title"].replace("U.S. Senate", "Senate"),
            dem=dem, gop=gop, inc=inc, open=open_seat, marquee=abs(margin) < 6,
            pvi=round(-r.get("s24", 0) + NAT24_D_MARGIN, 1),
            elast=round(v.get("elasticity", {}).get("median", 1.0), 2),
            fundamentals=fundm,
            stages=dict(anchor=round(-r.get("s24", 0), 2), fund=fundm,
                        poll=round(-margin, 2), rate=round(-margin, 2), market=round(-margin, 2)),
            pollAvg=pa, enop=float(v["n_polls"]), wPoll=round(v["blend_weights"]["M3"], 3), wMkt=0.0, market=None,
            ratings=[], est=side, votes=votes, cands=cand_rows,
            rcv=(dict(dem=int(rcv["votes"][0]), rep=int(rcv["votes"][1]),
                      demPct=rcv["pct"][0], repPct=rcv["pct"][1],
                      exhausted=int(rcv.get("exhausted") or 0),
                      firstChoice=round(mg, 2)) if rcv else None),
            polls=poll_rows(key, office, r["state"]), similar=[], trend=None,
        ))

statewide(S, "senate", "sen")
statewide(G, "governor", "gov")

ORD = {1: "st", 2: "nd", 3: "rd"}
for ab, st in H["states"].items():
    for row in st["rows"]:
        n = int(row["n"])
        rid = f"house-{ab}-{n:02d}"
        wins = house_win.get(ab)
        order = sorted(int(rr["n"]) for rr in st["rows"])   # win_*.npy columns follow district number ascending
        idx = order.index(n)
        prob_d = float(wins[:, idx].mean()) if wins is not None and wins.shape[1] > idx else (row.get("p", 0) or 0) / 100
        m = row.get("m")
        if m is None:                                   # same party contest, no two way margin
            m = 100.0 if str(row.get("held", "D")).startswith("D") else -100.0
        lo = row.get("lo"); hi = row.get("hi")
        lo = m - 8 if lo is None else lo; hi = m + 8 if hi is None else hi
        side = side_flat(m, 1 - prob_d, lo, hi)
        seats_word = f"{n}{ORD.get(n if n < 20 else n % 10, 'th')}" if st["seats"] > 1 else "at-large"
        races.append(dict(
            id=rid, office="house", st=ab, state=st["name"], district=n,
            name=f"{st['name']} {seats_word}",
            dem=row.get("dem") or "No Democrat on the ballot", gop=row.get("rep") or "No Republican on the ballot",
            inc=0 if not row.get("inc") else (-1 if str(row["inc"]).startswith("D") else 1),
            open=not row.get("inc"), marquee=abs(m) < 6,
            pvi=round(-(row.get("pvi") or 0), 1), elast=round(row.get("e") or 1.0, 2),
            fundamentals=round(-m, 2),
            stages=dict(anchor=round(-(row.get("t24") or 0), 2), fund=round(-m, 2), poll=round(-m, 2),
                        rate=round(-m, 2), market=round(-m, 2)),
            pollAvg=(round(-(row.get("cand") or 0), 2) if row.get("poll") else None),
            enop=1.0 if row.get("poll") else 0.0, wPoll=0.5 if row.get("poll") else 0.0, wMkt=0.0, market=None,
            ratings=[], est=side, polls=[], similar=[], trend=None,
            votes=dict(dem=int(round(row.get("dv") or 0)), rep=int(round(row.get("rv") or 0)),
                       other=int(round(row.get("ov") or 0)), total=int(round(row.get("tv") or 0))),
            cands=[c for c in (
                dict(name=row.get("dem"), party="D", pct=row.get("dp"), votes=int(round(row.get("dv") or 0))) if row.get("dem") else None,
                dict(name=row.get("rep"), party="R", pct=row.get("rp"), votes=int(round(row.get("rv") or 0))) if row.get("rep") else None,
                dict(name=row.get("third"), party=row.get("tp") or "I", pct=row.get("op"), votes=int(round(row.get("ov") or 0))) if row.get("third") else None,
            ) if c and c.get("pct") is not None],
        ))

# ── trends: the estimate carried back along each race's own daily poll average ──
def build_trend(r):
    key = OFFICE_OF.get(r["id"])
    ser = daily_series(key, r["office"], r["state"]) if key else None
    s = r["est"]
    sd = max(1.0, (s["p90"] - s["p10"]) / 2.5631)
    if ser is None:
        dates = list(range(12))
        pts = [dict(m=s["margin"], p=s["prob"]) for _ in dates]
    else:
        _, marg = ser
        today = marg[-1]
        w = r["wPoll"] if r["pollAvg"] is not None else 0.0
        pts = []
        for mt in marg[::max(1, len(marg) // 24)]:
            mm = s["margin"] + max(-5.0, min(5.0, w * (-(mt) - -(today))))   # guard a thin early average
            pts.append(dict(m=round(mm, 2), p=round(float(0.5 * (1 + math.erf(mm / (sd * math.sqrt(2))))), 4)))
        pts[-1] = dict(m=s["margin"], p=s["prob"])
    return pts

for r in races:
    r["trend"] = build_trend(r)

# ── correlated races ────────────────────────────────────────────────────────
def add_similar():
    keys = [(r["id"], sim_margin.get(OFFICE_OF.get(r["id"], ""))) for r in races if r["office"] != "house"]
    keys = [(i, m) for i, m in keys if m is not None]
    M = np.vstack([m for _, m in keys])
    C = np.corrcoef(M)
    ids = [i for i, _ in keys]
    pos = {i: k for k, i in enumerate(ids)}
    for r in races:
        if r["id"] not in pos: continue
        row = C[pos[r["id"]]]
        order = np.argsort(-row)
        r["similar"] = [dict(id=ids[j], corr=round(float(row[j]), 3)) for j in order if ids[j] != r["id"]][:10]
add_similar()

# ── chambers ────────────────────────────────────────────────────────────────
def hist_of(seats, total):
    """the desk reads hist keyed by Republican seats and flips it back to Democratic"""
    vals, counts = np.unique(seats, return_counts=True)
    return [[int(total - v), round(float(c) / len(seats), 5)] for v, c in zip(vals, counts)]

def chamber(office):
    if office == "house":
        dseats = house_seats.astype(int); total, control = 435, 218
    elif office == "senate":
        keys = [OFFICE_OF[r["id"]] for r in races if r["office"] == "senate"]
        M = np.vstack([sim_margin[k] for k in keys])
        dseats = (M > 0).sum(0) + SEN_NOT_UP_D; total, control = 100, 51
    else:
        keys = [OFFICE_OF[r["id"]] for r in races if r["office"] == "governor"]
        M = np.vstack([sim_margin[k] for k in keys])
        dseats = (M > 0).sum(0) + GOV_NOT_UP_D; total, control = 50, 26
    demControl = float((dseats >= control).mean())
    demSeats = float(dseats.mean())
    # the chamber carried back along the races' own trends: expected seats at each
    # point, with the simulated seat spread held fixed
    off_races = [r for r in races if r["office"] == office]
    npt = 12
    base = SEN_NOT_UP_D if office == "senate" else GOV_NOT_UP_D if office == "governor" else 0
    sd = max(1.0, float(dseats.std()))
    trend = []
    for i in range(npt):
        f = i / (npt - 1)
        exp = base
        for r in off_races:
            pts = r["trend"]
            exp += 1 - pts[min(len(pts) - 1, int(round(f * (len(pts) - 1))))]["p"]
        z = (exp - control + 0.5) / sd
        trend.append(dict(t=i, dem=float(0.5 * (1 + math.erf(z / math.sqrt(2)))), demSeats=exp))
    # anchor the path on today's simulated answer, so the series ends exactly there
    dp, ds = demControl - trend[-1]["dem"], demSeats - trend[-1]["demSeats"]
    trend = [dict(t=t["t"], dem=round(min(max(t["dem"] + dp, 0.0), 1.0), 4), demSeats=round(t["demSeats"] + ds, 2)) for t in trend]
    return dict(office=office, seatsTotal=total, gopControl=round(1 - demControl, 4), demControl=round(demControl, 4),
                gopSeats=round(total - demSeats, 1), demSeats=round(demSeats, 1), hist=hist_of(dseats, total),
                demP10=int(np.percentile(dseats, 10)), demP90=int(np.percentile(dseats, 90)), trend=trend)

def projection(office):
    """The seat count you get by calling every race for its projected winner.

    This is what the OnPoint pages print as the seat line, and it is not the
    mean of the simulations: the average is pulled toward the side holding the
    close seats, so the House averages 244 Democratic seats while the race by
    race call is 235. Both are true and the desk shows both, the projection on
    the seat bar and the average on the trend."""
    rs = [r for r in races if r["office"] == office]
    d = sum(1 for r in rs if r["est"]["margin"] < 0)
    g = len(rs) - d
    if office == "senate":
        d += SEN_NOT_UP_D; g += SEN_NOT_UP_R
    elif office == "governor":
        d += GOV_NOT_UP_D; g += GOV_NOT_UP_R
    return d, g

# ── the published OnPoint pages are the source of record for the headline
# numbers. The simulation here supplies the histogram shape; the control
# probability, percentiles and median come straight off the artifact files so
# the desk and the published pages can never disagree. ──────────────────────
def stamp_published_odds(chambers):
    for off, ch in chambers.items():
        o = {"house": H, "senate": S, "governor": G}[off]["odds"]
        # the Senate page counts Osborn in the Democratic column and so does the simulation,
        # so the desk takes d_osb where the file publishes one rather than the figure that drops him
        dctl = o["d_majority"] / 100.0 if "d_majority" in o else o.get("d_osb", o["d"]) / 100.0
        ch["demControl"] = round(dctl, 4)
        ch["gopControl"] = round(1 - dctl, 4)
        ch["demP10"] = int(round(o["p10"]))
        ch["demP90"] = int(round(o["p90"]))
        ch["median"] = int(round(o["median"] if "median" in o else o["med"]))
        if "mean" in o:                 # only the house file publishes a mean
            ch["demSeats"] = round(o["mean"], 1)
            ch["gopSeats"] = round(ch["seatsTotal"] - o["mean"], 1)
        if ch["trend"]:
            dp = ch["demControl"] - ch["trend"][-1]["dem"]
            ds = ch["demSeats"] - ch["trend"][-1]["demSeats"]
            ch["trend"] = [dict(t=t["t"], dem=round(min(max(t["dem"] + dp, 0.0), 1.0), 4),
                                demSeats=round(t["demSeats"] + ds, 2)) for t in ch["trend"]]
    return chambers

chambers = {}
for off in ("governor", "senate", "house"):
    c = chamber(off)
    pd, pr = projection(off)
    c["projD"], c["projR"] = pd, pr
    chambers[off] = c
stamp_published_odds(chambers)

# ── generic ballot and meta ─────────────────────────────────────────────────
natgen = H.get("natgen", 55.29)
gb_margin = round(100 - 2 * natgen, 1)                     # GOP positive
approval = RS["GA"]["electorate"]["history"].get("enthusiasm", 0)
net_app = -14                                              # TPSI national net approval, GOP positive sign
model = dict(
    meta=dict(updated=UPDATED, election=ELECTION, daysOut=DAYS_OUT, npe=gb_margin, sims=SIMS,
              senNotUpR=SEN_NOT_UP_R, senNotUpD=SEN_NOT_UP_D,
              govNotUpR=GOV_NOT_UP_R, govNotUpD=GOV_NOT_UP_D, govOnBallot=36,
              genericBallot=dict(avg=gb_margin, prior=gb_margin, npe=gb_margin, netApproval=net_app, polls=[])),
    chambers=chambers, races=races,
)
json.dump(model, open(f"{OUT}/model.json", "w"), separators=(",", ":"))

# ── counties ────────────────────────────────────────────────
# Every county carries its own projected vote, not just a shade: the desk needs
# [margin, Democratic votes, Republican votes, total votes] to fill a tooltip.
# Margins stay GOP positive, as the rest of the desk reads them. County names
# live once in _n, keyed by FIPS, because the same county is read by several
# races. A state's House counties are stored once under house-<ST>: every
# district in that state reads the same county map.
counties = {"_n": {}}

def cpack(rows):
    out = {}
    for c in rows:
        w = float(c.get("w") or 0)
        p = c.get("p")
        if p is not None:                       # senate and governor carry percentages
            dv = w * float(p[0]) / 100
            rv = w * float(p[1]) / 100
        else:                                   # the House page carries counts already
            dv = float(c.get("dv") or 0)
            rv = float(c.get("rv") or 0)
        row = [round(-float(c["m"]), 2), int(round(dv)), int(round(rv)), int(round(w))]
        # a fifth slot, only where it earns its place: the county's share for every
        # candidate, so a three or four way race can be read county by county
        if p is not None and len(p) > 2:
            row.append([round(float(x), 1) for x in p])
        out[c["f"]] = row
        nm = (c.get("n") or "").strip()
        if nm and c["f"] not in counties["_n"]:
            counties["_n"][c["f"]] = nm
    return out

for page, prefix in ((S, "sen"), (G, "gov")):
    for fips, r in page["races"].items():
        ab = FIPS2AB.get(fips)
        if ab is None: continue
        counties[f"{prefix}-{ab}"] = cpack(r["counties"])
for ab, st in H["states"].items():
    cs = st.get("counties") or []
    if not cs: continue
    counties[f"house-{ab}"] = cpack(cs)
counties["_reg"] = sorted({r["st"] for r in races})
json.dump(counties, open(f"{OUT}/counties.json", "w"), separators=(",", ":"))

# ── simulated crosstabs ─────────────────────────────────────────────────────
# The Senate and governor pages carry an estimated exit poll per race, read off
# the simulated voter file: 54 rows of [category, group, share of voters,
# Democrat, Republican, everyone else], all percentages. It is one file of its
# own because the desk only needs it once a statewide race is open.
xtabs = {}
for page, prefix in ((S, "sen"), (G, "gov")):
    for fips, r in page["races"].items():
        ab = FIPS2AB.get(fips)
        xt = r.get("xt") or {}
        if ab is None or not xt.get("rows"): continue
        xtabs[f"{prefix}-{ab}"] = [[str(x[0]), str(x[1])] + [round(float(v), 1) for v in x[2:6]] for x in xt["rows"]]
json.dump(xtabs, open(f"{OUT}/crosstabs.json", "w"), separators=(",", ":"))

# ── per state geometry ──────────────────────────────────────────────────────
for ab, st in H["states"].items():
    geo = st.get("geo") or {}
    if not geo:
        continue
    cpaths = {f: g["d"] for f, g in geo.items()}
    dpaths = {f"house-{ab}-{int(r['n']):02d}": r["d"] for r in st["rows"] if r.get("d")}
    sc, tx, ty = fit(list(cpaths.values()) + list(dpaths.values()))
    json.dump(dict(st=ab,
                   counties=[dict(id=f, d=transform(d, sc, tx, ty)) for f, d in cpaths.items()],
                   districts=[dict(id=i, d=transform(d, sc, tx, ty)) for i, d in dpaths.items()]),
              open(f"{OUT}/states/{ab}.json", "w"), separators=(",", ":"))

# ── national geometry ───────────────────────────────────────────────────────
states_d, boxes = {}, {}
for fips, v in S["states"].items():
    ab = FIPS2AB.get(fips)
    if ab is None: continue
    states_d[ab] = v["d"]
    b = v.get("b")
    boxes[ab] = [round(b[0][0], 1), round(b[0][1], 1), round(b[1][0] - b[0][0], 1), round(b[1][1] - b[0][1], 1)] if b else list(path_bbox(v["d"]))
districts = {}
for ab, st in H["states"].items():
    for row in st["rows"]:
        if not row.get("d"): continue
        x0, y0, x1, y1 = path_bbox(row["d"])
        districts[f"house-{ab}-{int(row['n']):02d}"] = dict(d=row["d"], box=[round(x0, 1), round(y0, 1), round(x1 - x0, 1), round(y1 - y0, 1)])

# state tile cartogram
TILE = {
 "AK":(0,0),"ME":(11,0),"VT":(9,1),"NH":(10,1),"WA":(1,1),"ID":(2,1),"MT":(3,1),"ND":(4,1),"MN":(5,1),"IL":(6,1),"WI":(6,0),"MI":(7,1),"NY":(8,1),"MA":(10,2),"RI":(11,2),
 "OR":(1,2),"NV":(2,2),"WY":(3,2),"SD":(4,2),"IA":(5,2),"IN":(6,2),"OH":(7,2),"PA":(8,2),"NJ":(9,2),"CT":(10,3),
 "CA":(1,3),"UT":(2,3),"CO":(3,3),"NE":(4,3),"MO":(5,3),"KY":(6,3),"WV":(7,3),"VA":(8,3),"MD":(9,3),"DE":(10,4),
 "AZ":(2,4),"NM":(3,4),"KS":(4,4),"AR":(5,4),"TN":(6,4),"NC":(7,4),"SC":(8,4),
 "OK":(4,5),"LA":(5,5),"MS":(6,5),"AL":(7,5),"GA":(8,5),
 "HI":(0,6),"TX":(4,6),"FL":(9,6),
}
W, Hh = 975, 610
hr = 26.0
hexStates = {}
for ab, (c, r) in TILE.items():
    x = 110 + c * (math.sqrt(3) * hr) + (r % 2) * (math.sqrt(3) * hr / 2)
    y = 90 + r * (1.5 * hr)
    hexStates[ab] = [round(x, 1), round(y, 1)]

# house cartogram: one hex per district, nearest free cell to its real centroid
hrH = 12.0
cells = []
for rr in range(int(Hh / (1.5 * hrH)) + 1):
    for cc in range(int(W / (math.sqrt(3) * hrH)) + 1):
        cells.append((cc * math.sqrt(3) * hrH + (rr % 2) * (math.sqrt(3) * hrH / 2) + 30, rr * 1.5 * hrH + 30))
cells = np.array(cells)
used = np.zeros(len(cells), bool)
cents = []
for ab, st in H["states"].items():
    for row in st["rows"]:
        c = row.get("c")
        if not c: continue
        cents.append((f"house-{ab}-{int(row['n']):02d}", c[0], c[1]))
cents.sort(key=lambda t: (t[1], t[2]))
hexHouse = {}
for rid, x, y in cents:
    d2 = (cells[:, 0] - x) ** 2 + (cells[:, 1] - y) ** 2
    d2[used] = 1e18
    j = int(np.argmin(d2)); used[j] = True
    hexHouse[rid] = [round(float(cells[j, 0]), 1), round(float(cells[j, 1]), 1)]

json.dump(dict(frame=[W, Hh], states=states_d, box=boxes, districts=districts,
               hexHouse=hexHouse, hexHouseR=hrH, hexStates=hexStates, hexStatesR=hr),
          open(f"{OUT}/geo.json", "w"), separators=(",", ":"))

print("races", len(races), "| senate", sum(r["office"] == "senate" for r in races),
      "governor", sum(r["office"] == "governor" for r in races), "house", sum(r["office"] == "house" for r in races))
print("county map keys", len(counties) - 2, "| state files", len(glob.glob(f'{OUT}/states/*.json')),
      "| districts drawn", len(districts), "| hexHouse", len(hexHouse))
for off in chambers:
    c = chambers[off]
    print(off, "dem seats", c["demSeats"], "control", c["demControl"], "p10/p90", c["demP10"], c["demP90"])
print("sizes MB:", {f: round(os.path.getsize(f"{OUT}/{f}") / 1e6, 2) for f in ["model.json", "geo.json", "counties.json", "crosstabs.json"]})
