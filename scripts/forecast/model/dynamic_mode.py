"""TPSI Dynamic Mode: Senate and Governor races rebuilt by simulating voters going to the polls.

For each race the Senate Mode blend is run with dynamic county elasticities in the history leg (elasticity.py) and the
TPSI county by county Trump approval alone in the fundamental leg. Each county's electorate is then rebuilt from 32 ACS
cells, age by race by college, with the adult population of every cell, its TPSI midterm turnout probability and its TPSI
vote probability. One turnout constant and one vote constant per county make the cells reproduce the county's projected
turnout and two party share exactly. Then the election is run N times. In every run:

  * a national environment shock, shared by every race in the same run, plus a state shock sized by the polling on file,
    moves each county by its elasticity times the shock, plus a county shock that shrinks with county size
  * a turnout shock and an enthusiasm shock move each cell's chance of voting; the enthusiasm shock raises turnout in cells
    that lean one way and lowers it in cells that lean the other, so the electorate's composition moves too
  * a third party shock moves the minor candidate share
  * every cell's voters are drawn: how many turn out, binomially from the cell's adults, then how many of them vote third
    party, then how many of the rest vote for the Democratic side

County results are the mean of the simulated votes. Statewide results are the sum of the counties. Win probabilities, the
80 percent range of the margin and the chamber control odds come from the same runs.
"""
import os, sys, json, re, time
BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
os.environ.setdefault("DYNAMIC", "1")
os.environ.setdefault("APPROVAL_SRC", "tpsi")
import numpy as np, pandas as pd
import senate_mode as sm
import elasticity as el
ELECTORATE = os.environ.get("ELECTORATE") is not None
if ELECTORATE:
    import electorate as ev
HISTORY = ELECTORATE and os.environ.get("HISTORY") is not None
if HISTORY:
    import history as hi
CANDIDATE = os.environ.get("CANDIDATE") is not None
if CANDIDATE:
    import candidate as cq
if os.environ.get("POLL_METHOD") == "daily":
    import poll_daily
    poll_daily.install(sm)

N = int(os.environ.get("N_SIMS", "2000"))
BATCH = 100
SEED = 20261103
OUT = os.environ.get("OUT_DYN", f"{BASE}/output_dynamic")
os.makedirs(OUT, exist_ok=True)
logit, inv = sm.logit, sm.inv

SIG_NAT = 0.06                      # national environment, logit, shared across races in a run
SIG_STATE = {0: 0.11, 1: 0.09, 4: 0.07}   # state environment by polls on file: none, 1 to 3, 4 or more
SIG_TURN_NAT, SIG_TURN_ST, SIG_TURN_CTY = 0.08, 0.06, 0.04
SIG_ENTH_NAT, SIG_ENTH_ST = 0.06, 0.05
SIG_THIRD_ST, SIG_THIRD_CTY = 0.15, 0.10

_rng_nat = np.random.default_rng(SEED)
NAT = dict(env=_rng_nat.normal(0, SIG_NAT, N), turn=_rng_nat.normal(0, SIG_TURN_NAT, N), enth=_rng_nat.normal(0, SIG_ENTH_NAT, N))
# Vote History Mode shocks, shared by every race in a run: each demographic group's vote and turnout move together
# nationally, and voters who skipped 2022 surge or stay home together
SIG_DEMO_VOTE, SIG_DEMO_TURN = 0.10, 0.08
SIG_IRREG_NAT, SIG_IRREG_ST = 0.12, 0.06
_rng_demo = np.random.default_rng(SEED + 17)
NAT["demo_vote"] = _rng_demo.normal(0, SIG_DEMO_VOTE, (N, 7)); NAT["demo_turn"] = _rng_demo.normal(0, SIG_DEMO_TURN, (N, 7))
NAT["irreg"] = _rng_demo.normal(0, SIG_IRREG_NAT, N)

slug = lambda nm: re.sub(r"[^a-z]+", "_", nm.lower()).strip("_")

def solve(fn, target, n, lo=-8.0, hi=8.0, it=60):
    lo = np.full(n, lo); hi = np.full(n, hi)
    for _ in range(it):
        mid = (lo + hi) / 2; v = fn(mid)
        up = v < target; lo = np.where(up, mid, lo); hi = np.where(up, hi, mid)
    return (lo + hi) / 2

def state_sigma(npolls):
    return SIG_STATE[4] if npolls >= 4 else SIG_STATE[1] if npolls >= 1 else SIG_STATE[0]

def simulate(st, df, summ, model, shift):
    cfg = sm.STATES[st]; rng = np.random.default_rng(SEED + sum(map(ord, st)) * 7919)
    fl = list(df.county_fips)
    reg = model["state_region"][cfg.get("base", st[:2])]
    pops, eta, turn, adults, eta24 = sm.census_components(model, fl, lambda f: reg)
    pops = np.maximum(pops, 0.0); popi = np.round(pops).astype(np.int64)
    C, K = pops.shape
    third_names = [nm for nm, _ in summ["third_parties"]]
    tcols = [slug(nm) + "_pct" for nm in third_names]
    split = cfg.get("split")
    if split:
        n1, n2 = split["names"]; dcols = [slug(n1) + "_pct", slug(n2) + "_pct"]
    else:
        dcols = ["dem_pct"]
    Dsh = df[dcols].sum(axis=1).values / 100; Rsh = df.rep_pct.values / 100
    Tsh = df[tcols].values / 100 if tcols else np.zeros((C, 0))
    q = np.clip(Dsh / (Dsh + Rsh), 1e-4, 1 - 1e-4)
    o = np.clip(Tsh.sum(axis=1), 0, 0.95)
    tfrac = Tsh / np.maximum(Tsh.sum(axis=1, keepdims=True), 1e-12) if tcols else np.zeros((C, 0))
    dfrac = (df[dcols].values / np.maximum(df[dcols].sum(axis=1).values[:, None], 1e-12))
    T = df.projected_turnout.values.astype(float)
    party_sgn = None
    demo_v = demo_t = None
    VFR = HISTORY and "REC" in hi.LAST.get(st, {})
    if VFR:
        # Voter File Mode: every county's simulated voters, 384 groups of cell, party and vote history each split by
        # simulated Trump approval, 1,152 voter types per county. Each type's turnout and preference are the averages of
        # the individual respondent profiles inside it. The electorate is kept as built: one turnout constant closes the
        # small gap to the county's projected turnout and one preference constant moves every voter alike to the county's
        # projected two party share, so a candidate who runs ahead of the fundamentals wins crossover voters.
        Lh = hi.LAST[st]
        _ix = np.array([Lh["fl"].index(f) for f in fl])
        REC = Lh["REC"]; popr = REC["pop"][_ix].copy(); ltr = REC["lt"][_ix].copy(); etar = REC["eta"][_ix].copy(); gg = REC["g"]
        _ad = popr.sum(1); popr = popr * np.maximum(1.0, T / np.maximum(0.8 * _ad, 1.0))[:, None]
        b = np.zeros(C); a = np.zeros(C)
        for _ in range(4):
            Wr = popr * inv(ltr + b[:, None])
            a = solve(lambda z: (Wr * inv(etar + z[:, None])).sum(1) / np.maximum(Wr.sum(1), 1e-9), q, C, -6, 6)
            b = solve(lambda x: (popr * inv(ltr + x[:, None])).sum(1), T, C, -3, 3)
        pops = popr; popi = np.round(pops).astype(np.int64)
        lt = ltr + b[:, None]; eta = etar + a[:, None]
        kk_, jj_, hh_ = gg // 12, (gg // 4) % 3, gg % 4
        party_sgn = np.array([1.0, -1.0, 0.0])[jj_][None, None, :]
        Mcell = hi.demo_matrix(Lh["meta"]); demo_idx = Mcell[kk_]
        irreg = (1 - hi.HM)[hh_]
        K = pops.shape[1]
        W = pops * inv(lt)
        s_hist = dict(zip(hi.H_NAMES, [float(W[:, hh_ == i].sum() / W.sum()) for i in range(4)]))
        chk = (W * inv(eta)).sum(1) / W.sum(1)
        s_el_err = float(np.max(np.abs(chk - q))); s_t_err = float(np.max(np.abs(W.sum(1) / T - 1)))
        _P = inv(eta); hvar = (W * _P * (1 - _P)).sum(1) / W.sum(1) / np.maximum(chk * (1 - chk), 1e-9)
        hfac = 1.0 / np.clip(hvar, 0.05, 1.0)
        demo_v, demo_t = NAT["demo_vote"] @ demo_idx.T, NAT["demo_turn"] @ demo_idx.T
        lt0, eta0 = lt.copy(), eta.copy()
        b = np.zeros(C); a = np.zeros(C)
    elif HISTORY:
        # 384 groups per county: 32 cells x 3 parties x 4 vote histories, from Vote History Mode. The party mix is solved
        # to reproduce the county's two party share among 2026 voters; each group's 2026 turnout is its own, and one
        # turnout constant only closes the small gap left by the ACS adult count.
        Lh = hi.LAST[st]
        _ix = np.array([Lh["fl"].index(f) for f in fl])                     # the county table is sorted differently
        popc = Lh["popc"][_ix].copy(); Hh = Lh["H"][_ix]; share = Lh["share"]; lt4 = Lh["lt"][_ix]; LV = Lh["LV"]
        _ad = popc.sum(1); popc = popc * np.maximum(1.0, T / np.maximum(0.8 * _ad, 1.0))[:, None]
        def comp4(av, bt):
            sh_ = hi.party_mix(share, av); w = popc[:, :, None, None] * sh_[..., None] * Hh
            tt = inv(lt4 + bt[:, None, None, None]); v = inv(LV[None] + 0.25 * av[:, None, None, None])
            return w, tt, v
        b = np.zeros(C); a = Lh["a"][_ix].copy()
        for _ in range(4):
            a = ev.solve(lambda z: (lambda w, tt, v: (w * tt * v).sum((1, 2, 3)) / np.maximum((w * tt).sum((1, 2, 3)), 1e-9))(*comp4(z, b)), q, C, -8, 8)
            w, _, _ = comp4(a, b)
            b = solve(lambda x: (w * inv(lt4 + x[:, None, None, None])).sum((1, 2, 3)), T, C, -3, 3)
        w, tt, v = comp4(a, b)
        pops = w.reshape(C, -1); popi = np.round(pops).astype(np.int64)
        lt = (lt4 + b[:, None, None, None]).reshape(C, -1)
        eta = np.broadcast_to(logit(np.clip(v, 1e-6, 1 - 1e-6)), w.shape).reshape(C, -1)
        party_sgn = np.broadcast_to(np.array([1.0, -1.0, 0.0])[None, :, None], (32, 3, 4)).reshape(1, 1, -1)
        Mcell = hi.demo_matrix(Lh["meta"])                                   # [32, 7]
        demo_idx = np.repeat(Mcell, 12, axis=0)                             # [384, 7]
        irreg = np.tile((1 - hi.HM), 96)                                    # skipped 2022
        K = pops.shape[1]
        s_hist = dict(zip(hi.H_NAMES, ((w * tt).sum((0, 1, 2)) / (w * tt).sum()).tolist()))
        b = np.zeros(C); a = np.zeros(C)
        W = pops * inv(lt)
        chk = (W * inv(eta)).sum(1) / W.sum(1)
        s_el_err = float(np.max(np.abs(chk - q))); s_t_err = float(np.max(np.abs(W.sum(1) / T - 1)))
        _P = inv(eta); hvar = (W * _P * (1 - _P)).sum(1) / W.sum(1) / np.maximum(chk * (1 - chk), 1e-9)
        hfac = 1.0 / np.clip(hvar, 0.05, 1.0)
        demo_v, demo_t = NAT["demo_vote"] @ demo_idx.T, NAT["demo_turn"] @ demo_idx.T      # [N, 384]
    elif ELECTORATE:
        # 96 groups per county: 32 cells x Democrats, Republicans, independents, from the Electorate Mode estimate.
        # The county's party mix (and a quarter as much vote lean) is solved to reproduce its two party share among
        # 2026 voters, and one turnout constant reproduces its projected turnout.
        G = ev.groups(sm, model, fl, reg)
        # ACS undercounts adults in the smallest counties; never let projected turnout exceed 80 percent of adults
        _ad = G["pop"].sum(1); G["pop"] = G["pop"] * np.maximum(1.0, T / np.maximum(0.8 * _ad, 1.0))[:, None]
        enth0 = summ.get("electorate", {}).get("enthusiasm_logit", 0.0)
        b = np.zeros(C)
        for _ in range(4):
            a = ev.solve(lambda z: ev.composed(G, z, G["lmid"], extra_turn=b, enth=enth0)[0], q, C)
            _, w0, sh, _, _ = ev.composed(G, a, G["lmid"], enth=enth0)
            popg = (G["pop"][:, :, None] * sh)
            base_t = G["lmid"][None] + np.array([enth0, -enth0, 0.0])[None, None, :]
            b = solve(lambda x: (popg * inv(base_t + x[:, None, None])).sum((1, 2)), T, C)
        a = ev.solve(lambda z: ev.composed(G, z, G["lmid"], extra_turn=b, enth=enth0)[0], q, C)
        _, _, sh, _, _ = ev.composed(G, a, G["lmid"], extra_turn=b, enth=enth0)
        popg = G["pop"][:, :, None] * sh
        pops = popg.reshape(C, -1); popi = np.round(pops).astype(np.int64)
        lt = np.broadcast_to(base_t + b[:, None, None], popg.shape).reshape(C, -1)
        eta = np.broadcast_to(G["lvote"][None] + 0.25 * a[:, None, None], popg.shape).reshape(C, -1)
        party_sgn = np.tile(np.array([1.0, -1.0, 0.0]), 32)[None, None, :]
        K = pops.shape[1]
        b = np.zeros(C); a = np.zeros(C)          # already folded into lt and eta
        W = pops * inv(lt)
        chk = (W * inv(eta)).sum(1) / W.sum(1)
        s_el_err = float(np.max(np.abs(chk - q))); s_t_err = float(np.max(np.abs(W.sum(1) / T - 1)))
        # partisans sit near 0 or 1, so a log odds shock to each voter moves the county far less than the same shock to
        # the county as a whole; scale each voter's shock by the county's within group variance share so the county moves
        # by the intended amount
        _P = inv(eta); hvar = (W * _P * (1 - _P)).sum(1) / W.sum(1) / np.maximum(chk * (1 - chk), 1e-9)
        hfac = 1.0 / np.clip(hvar, 0.05, 1.0)
    else:
        hfac = np.ones(C)
        lt = logit(np.clip(turn, 1e-4, 1 - 1e-4))
        b = solve(lambda x: (pops * inv(lt + x[:, None])).sum(1), T, C)
        W = pops * inv(lt + b[:, None])
        a = solve(lambda x: (W * inv(eta + x[:, None])).sum(1) / W.sum(1), q, C)
    e = df["elasticity"].values
    s2 = el._PRIOR["sig2"](sm.P24.reindex(fl).total_votes.fillna(1000).values if not st.startswith("AK") else T)
    sig_cty = np.sqrt(s2 / 2)
    s_state = state_sigma(summ["n_polls"])
    has_third = o.max() > 0
    lo_ = logit(np.clip(o, 1e-6, 1 - 1e-6))
    rcv = cfg.get("rcv"); RCV = cfg.get("rcv_transfers", sm.AK_RCV) if rcv else None

    if HISTORY:
        # Shocks are symmetric in log odds but not in votes: a high turnout group loses more than it gains and a low one
        # the reverse. A pilot of expected values under the same kinds of shocks re-centers every county so the mean of
        # the simulations equals the county's projected two party share and turnout.
        prng = np.random.default_rng(SEED + 99); PN = min(300, N)
        for _it in range(3):
            ED = np.zeros(C); EN = np.zeros(C)
            PB = BATCH if C * K <= 120_000 else max(10, int(BATCH * 120_000 / (C * K)))
            for p0 in range(0, PN, PB):
                Bp = min(PB, PN - p0); ps = slice(p0, p0 + Bp)
                envp = NAT["env"][ps] + prng.normal(0, s_state, Bp)
                if CANDIDATE and st in cq.PROFILES:
                    envp = envp + prng.normal(0, cq.PROFILES[st]["sigma"], Bp)
                shp = (e[None, :] * envp[:, None] + prng.normal(0, 1, (Bp, C)) * sig_cty[None, :]) * hfac[None, :]
                tsp = NAT["turn"][ps][:, None] + prng.normal(0, SIG_TURN_ST, Bp)[:, None] + prng.normal(0, SIG_TURN_CTY, (Bp, C))
                enp = NAT["enth"][ps] + prng.normal(0, SIG_ENTH_ST, Bp)
                gvp = demo_v[ps][:, None, :] * hfac[None, :, None]
                gtp = demo_t[ps][:, None, :] + (NAT["irreg"][ps] + prng.normal(0, SIG_IRREG_ST, Bp))[:, None, None] * irreg[None, None, :]
                pp = inv(eta[None] + shp[:, :, None] + gvp)
                tq = inv(lt[None] + tsp[:, :, None] + gtp + enp[:, None, None] * party_sgn)
                nn = pops[None] * tq
                ED += (nn * pp).sum((0, 2)); EN += nn.sum((0, 2))
            mD = ED / np.maximum(EN, 1e-9); mN = EN / PN
            eta = eta + (logit(q) - logit(np.clip(mD, 1e-6, 1 - 1e-6)))[:, None]
            lt = lt + np.log(T / np.maximum(mN, 1e-9))[:, None]
        pilot_err = dict(share=float(np.max(np.abs(mD - q))), turnout=float(np.max(np.abs(mN / T - 1))))
    acc = dict(N=np.zeros(C), D=np.zeros(C), R=np.zeros(C), TH=np.zeros(C), winD=np.zeros(C))
    st_margin, st_turn, st_win = np.zeros(N), np.zeros(N), np.zeros(N, bool)
    st_share = np.zeros((N, 2 + len(tcols) + (1 if split else 0)))
    BS = BATCH if C * K <= 120_000 else max(10, int(BATCH * 120_000 / (C * K)))
    for s0 in range(0, N, BS):
        B = min(BS, N - s0); sl = slice(s0, s0 + B)
        env = NAT["env"][sl] + rng.normal(0, s_state, B)
        if CANDIDATE and st in cq.PROFILES:
            env = env + rng.normal(0, cq.PROFILES[st]["sigma"], B)
        shock = (e[None, :] * env[:, None] + rng.normal(0, 1, (B, C)) * sig_cty[None, :]) * hfac[None, :]
        tsh = NAT["turn"][sl][:, None] + rng.normal(0, SIG_TURN_ST, B)[:, None] + rng.normal(0, SIG_TURN_CTY, (B, C))
        enth = NAT["enth"][sl] + rng.normal(0, SIG_ENTH_ST, B)
        gv = 0.0; gt = 0.0
        if demo_v is not None:
            gv = demo_v[sl][:, None, :] * hfac[None, :, None]
            gt = demo_t[sl][:, None, :] + (NAT["irreg"][sl] + rng.normal(0, SIG_IRREG_ST, B))[:, None, None] * irreg[None, None, :]
        p = inv(eta[None] + a[None, :, None] + shock[:, :, None] + gv)
        tp = inv(lt[None] + b[None, :, None] + tsh[:, :, None] + gt + enth[:, None, None] * (party_sgn if party_sgn is not None else (2 * p - 1)))
        n = rng.binomial(popi[None], tp)
        if has_third:
            osim = inv(lo_[None, :] + rng.normal(0, SIG_THIRD_ST, B)[:, None] + rng.normal(0, SIG_THIRD_CTY, (B, C)))
            osim = np.where(o[None, :] > 0, osim, 0.0)
            th = rng.binomial(n, osim[:, :, None])
        else:
            th = np.zeros_like(n)
        dv = rng.binomial(n - th, p)
        Nc, THc, Dc = n.sum(2).astype(float), th.sum(2).astype(float), dv.sum(2).astype(float)
        Rc = Nc - THc - Dc
        acc["N"] += Nc.sum(0); acc["D"] += Dc.sum(0); acc["R"] += Rc.sum(0); acc["TH"] += THc.sum(0)
        if rcv:
            FD = Dc + RCV["to_D"] * THc; FR = Rc + RCV["to_R"] * THc
            acc["winD"] += (FD > FR).sum(0)
            sD, sR = FD.sum(1), FR.sum(1)
            st_margin[sl] = 100 * (sD - sR) / (sD + sR)
        elif split:
            lead = np.maximum(Dc * dfrac[None, :, 0], Dc * dfrac[None, :, 1])
            acc["winD"] += (lead > Rc).sum(0)
            t1, t2 = (Dc * dfrac[None, :, 0]).sum(1), (Dc * dfrac[None, :, 1]).sum(1)
            st_margin[sl] = 100 * (np.maximum(t1, t2) - Rc.sum(1)) / Nc.sum(1)
        else:
            acc["winD"] += (Dc > Rc).sum(0)
            st_margin[sl] = 100 * (Dc.sum(1) - Rc.sum(1)) / Nc.sum(1)
        st_turn[sl] = Nc.sum(1)
    st_win = st_margin > 0
    # rebuild the county table from the mean simulated votes
    out = df.copy()
    Nm, Dm, Rm, THm = acc["N"] / N, acc["D"] / N, acc["R"] / N, acc["TH"] / N
    out["projected_turnout"] = Nm.round(0)
    for j, c in enumerate(dcols):
        out[c] = 100 * Dm * dfrac[:, j] / Nm
    out["rep_pct"] = 100 * Rm / Nm
    for j, c in enumerate(tcols):
        out[c] = 100 * THm * tfrac[:, j] / Nm
    if split:
        out["anti_republican_bloc_pct"] = out[dcols].sum(axis=1)
        for c in dcols + ["anti_republican_bloc_pct"]:
            out[c.replace("_pct", "_votes")] = (Nm * out[c] / 100).round(0)
        out["bloc_margin"] = out.anti_republican_bloc_pct - out.rep_pct
        out["leader_margin"] = np.maximum(out[dcols[0]], out[dcols[1]]) - out.rep_pct
        out["final_bloc_two_way"] = 100 * Dm / (Dm + Rm)
        out["winner"] = np.where(out.leader_margin > 0, np.where(out[dcols[0]] >= out[dcols[1]], f"{n1} ({split['parties'][0]})", f"{n2} ({split['parties'][1]})"), cfg["R"] + " (R)")
    else:
        out["dem_votes"] = (Nm * out.dem_pct / 100).round(0)
        out["dem_margin"] = out.dem_pct - out.rep_pct
        out["final_d2"] = 100 * Dm / (Dm + Rm)
        out["winner"] = np.where(out.dem_margin > 0, cfg["D"] + " (D)", cfg["R"] + " (R)")
    out["rep_votes"] = (Nm * out.rep_pct / 100).round(0)
    for c in tcols:
        out[c.replace("_pct", "_votes")] = (Nm * out[c] / 100).round(0)
    if rcv:
        FD, FR = Dm + RCV["to_D"] * THm, Rm + RCV["to_R"] * THm
        out["rcv_final_dem_pct"] = 100 * FD / (FD + FR); out["rcv_final_rep_pct"] = 100 * FR / (FD + FR)
        out["rcv_final_margin"] = out.rcv_final_dem_pct - out.rcv_final_rep_pct
        out["rcv_exhausted_pct_of_ballots"] = 100 * RCV["exhaust"] * THm / Nm
        out["rcv_final_dem_votes"] = FD.round(0); out["rcv_final_rep_votes"] = FR.round(0)
        out["final_d2"] = out.rcv_final_dem_pct
        out["winner"] = np.where(out.rcv_final_margin > 0, cfg["D"] + " (D)", cfg["R"] + " (R)")
    out["deterministic_margin"] = (df.leader_margin if split else df.rcv_final_margin if rcv else df.dem_margin).values
    out["county_win_prob_dem_side"] = 100 * acc["winD"] / N
    out["simulated_voters_turnout_cal"] = b; out["simulated_voters_vote_cal"] = a
    # statewide summary from the counties
    V = out.projected_turnout.sum()
    s = dict(summ)
    if split:
        top = {n1: out[dcols[0].replace("_pct", "_votes")].sum() / V * 100, n2: out[dcols[1].replace("_pct", "_votes")].sum() / V * 100, cfg["R"]: out.rep_votes.sum() / V * 100}
        margin = max(top[n1], top[n2]) - top[cfg["R"]]; cD = int((out.leader_margin > 0).sum())
    else:
        top = {cfg["D"]: out.dem_votes.sum() / V * 100, cfg["R"]: out.rep_votes.sum() / V * 100}
        margin = top[cfg["D"]] - top[cfg["R"]]; cD = int((out.dem_margin > 0).sum())
    for nm, c in zip(third_names, tcols):
        top[nm] = out[c.replace("_pct", "_votes")].sum() / V * 100
    s.update(topline=top, margin=margin, turnout=V, counties_D=cD, deterministic_margin=summ.get("rcv_final_margin", summ["margin"]) if rcv else summ["margin"])
    if rcv:
        FDs, FRs = out.rcv_final_dem_votes.sum(), out.rcv_final_rep_votes.sum()
        s["rcv_final"] = {cfg["D"]: FDs / (FDs + FRs) * 100, cfg["R"]: FRs / (FDs + FRs) * 100}
        s["rcv_final_margin"] = (FDs - FRs) / (FDs + FRs) * 100; s["rcv_exhausted_votes"] = V - FDs - FRs
        s["counties_D"] = int((out.rcv_final_margin > 0).sum())
    s["simulation"] = dict(n=N, win_prob_dem_side=float(100 * st_win.mean()),
                           margin_mean=float(st_margin.mean()), margin_median=float(np.median(st_margin)),
                           margin_p10=float(np.percentile(st_margin, 10)), margin_p90=float(np.percentile(st_margin, 90)),
                           turnout_p10=float(np.percentile(st_turn, 10)), turnout_p90=float(np.percentile(st_turn, 90)),
                           state_sigma=s_state, national_sigma=SIG_NAT, voters_simulated_per_run=float(Nm.sum()),
                           groups_per_county=int(K), **(dict(calibration_share_error=s_el_err, calibration_turnout_error=s_t_err) if ELECTORATE else {}),
                           **(dict(pilot_recentering_error=pilot_err, electorate_history=s_hist, demographic_shocks=[g for g, _ in hi.DEMO], sig_demo_vote=SIG_DEMO_VOTE, sig_demo_turn=SIG_DEMO_TURN, sig_irregular=SIG_IRREG_NAT) if HISTORY else {}))
    if VFR:
        import voters as vf
        dside = [n1, n2] if split else [cfg["D"]]
        dshare = {nm: out[c].values / 100 for nm, c in zip(dside, dcols)}
        thirds = [(nm, pty, out[c].values / 100) for (nm, pty), c in zip(summ["third_parties"], tcols)]
        xt = vf.crosstab(sm, Lh, _ix, (lt - ltr)[:, 0], dshare, cfg["R"], out.rep_pct.values / 100, thirds, out.projected_turnout.values)
        s["crosstabs"] = xt
        s["voter_file"] = dict(voter_types_per_county=int(K), respondent_profiles_per_county=int((Lh["F"]["w"][_ix] > 0).sum((1, 2)).mean()),
                               electorate_trump_approval_two_way=Lh["info"]["voter_file"]["electorate_trump_approval_two_way"])
    e_w = out.projected_turnout.values
    s["elasticity"] = dict(p10=float(np.percentile(e, 10)), median=float(np.median(e)), p90=float(np.percentile(e, 90)),
                           own_history_share=float(np.average(out.elasticity_own_history_share, weights=e_w)))
    return out, s, st_margin

def main():
    model = sm.fit_respondents()
    shift, nat, nat_turn = sm.national_shift(model)
    el.fit_prior(sm, model, shift)
    todo = sys.argv[1:] or sorted(k for k in sm.STATES if k in json.load(open(f"{BASE}/output/run_summary.json"))["results"])
    prev = json.load(open(f"{OUT}/run_summary.json"))["results"] if os.path.exists(f"{OUT}/run_summary.json") else {}
    results, sims = {}, {}
    if ELECTORATE:
        allk = sorted(k for k in sm.STATES if k in json.load(open(f"{BASE}/output/run_summary.json"))["results"])
        ev.state_enthusiasm(sm, allk)
        json.dump(ev.STATE_ENTH, open(f"{OUT}/state_enthusiasm.json", "w"), indent=1)
        if CANDIDATE:
            _sh = []
            for _k in allk:
                try:
                    _p, _ = sm.primaries(_k); _p = _p.reindex(sm.county_list(_k))
                except Exception:
                    continue
                for _s in "DR":
                    if cq.side_kind(_p[f"cand{_s}"]) == "contested":
                        _w = _p[f"p{_s}"].astype(float).fillna(0); _sh.append(float((_p[f"cand{_s}"].astype(float).fillna(0) * _w).sum() / _w.sum()))
            cq.set_reference(_sh)
            print("candidate unity reference share", cq.UNITY_REF, "from", len(_sh), "contested nominations", flush=True)
        if HISTORY:
            hi.backtest_kappa(sm, model, allk)
            _prev = json.load(open(os.environ.get("COMP_FROM", f"{BASE}/output/run_summary.json")))["results"]
            _m = {}
            for _k, _v in _prev.items():
                _mm = abs(_v.get("rcv_final_margin", _v.get("margin", 99))); _m[_k[:2]] = min(_m.get(_k[:2], 99), _mm)
            hi.set_competition(_m)
            json.dump(dict(kappa=hi.KAPPA, competition=hi.COMP, intent_party=list(map(float, hi.fit(sm)["intent_party"])), intent_raw=hi.fit(sm)["intent_raw"]),
                      open(f"{OUT}/vote_history_backtest.json", "w"), indent=1, default=float)
    for st in todo:
        t0 = time.time()
        if ELECTORATE: ev.CURRENT["st"] = st
        df, polls, summ = sm.run_state(st, model, shift, nat_turn)
        out, s, mg = simulate(st, df, summ, model, shift)
        nm = sm.STATES[st]["name"].lower().replace(" ", "_"); office = sm.STATES[st].get("office", "senate")
        sortcol = "leader_margin" if sm.STATES[st].get("split") else "rcv_final_margin" if sm.STATES[st].get("rcv") else "dem_margin"
        out.sort_values(sortcol, ascending=False).to_csv(f"{OUT}/{nm}_2026_{office}_county_forecast.csv", index=False, float_format="%.3f")
        polls.drop(columns="key").to_csv(f"{OUT}/{nm}{'_governor' if office == 'governor' else ''}_poll_average_inputs.csv", index=False, float_format="%.3f")
        results[st] = s; sims[st] = mg
        sim = s["simulation"]
        print(f"{st:4s} det {s['deterministic_margin']:+6.2f}  sim {s.get('rcv_final_margin', s['margin']):+6.2f}  "
              f"win {sim['win_prob_dem_side']:5.1f}%  80% {sim['margin_p10']:+6.1f} to {sim['margin_p90']:+6.1f}  "
              f"elast {s['elasticity']['p10']:.2f}/{s['elasticity']['median']:.2f}/{s['elasticity']['p90']:.2f}  {time.time() - t0:.0f}s", flush=True)
        np.save(f"{OUT}/sim_margin_{st}.npy", mg)
        if os.environ.get("POLL_METHOD") == "daily" and st in poll_daily.REGISTRY:
            reg_ = poll_daily.REGISTRY[st]
            pd.DataFrame(reg_["series"]).to_csv(f"{OUT}/{nm}{'_governor' if office == 'governor' else ''}_daily_poll_average.csv", index=False)
            reg_["audit"].to_csv(f"{OUT}/{nm}{'_governor' if office == 'governor' else ''}_poll_weight_audit.csv", index=False, float_format="%.4f")
    meta = dict(national_intercept_shift=shift, national_lv_d2=nat, national_mean_turnout_index=nat_turn,
                state_region=model["state_region"], results={**prev, **results},
                dynamic=dict(n_sims=N, seed=SEED, elasticity_tau=el.TAU, office_var=el.OFFICE_VAR,
                             prior_beta=list(map(float, el._PRIOR["beta"])), prior_tau_moments=float(el._PRIOR["tau2"] ** 0.5)))
    json.dump(meta, open(f"{OUT}/run_summary.json", "w"), indent=1, default=float)

if __name__ == "__main__":
    main()
