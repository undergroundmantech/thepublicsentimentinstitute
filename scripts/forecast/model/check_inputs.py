"""Automated input check, run before every sweep's re-run (Oct 3 2026).

  python3 check_inputs.py [--run /tmp/fc_vNN] [--prev /tmp/fc_vMM]

Checks every Senate and governor poll the model reads (each race's poll file, EXTRA_POLLS and the site sync rows) and
the House district polls:
  error  duplicate poll (same pollster, end date, population and numbers), a missing, zero or unreadable sample size,
         a D or R share at or below zero, a population label other than LV, RV, V or A, a poll ending after AS_OF,
         a share total above 102, a House district poll whose D and R sum past 100
  warn   the same pollster and end date entered twice with different numbers, a sample under 200, a share total
         under 85, a placeholder poll (sample size or dates not yet published) older than 3 days, a house effect or
         likely voter fit computed for an earlier date than AS_OF
  with --run, every race's county forecast must have the same county count as --prev (default: the run in LATEST.json)
Writes check_inputs_report.json next to this file and exits 1 when there is any error.
"""
import argparse, json, os, re, sys
import numpy as np, pandas as pd

BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
SCRATCH = os.path.dirname(BASE)
PLACEHOLDER = re.compile(r"placeholder|not given|tbd|n placeholder", re.I)

def norm(s): return re.sub(r"[^a-z0-9]", "", str(s).lower())

def senate_polls(sm):
    import site_poll_sync as sps
    src = open(os.path.join(BASE, "senate_mode.py")).read().splitlines()
    out = []
    for st, cfg in sm.STATES.items():
        have = set()
        if cfg.get("polls_csv"):
            f = f"{sm.PKG[st]}/{cfg['polls_csv']}"
            p = pd.read_csv(f)
            sp = cfg.get("split")
            if sp and "D" not in p: p["D"] = p[sp["poll_col"]] + p[sp["other_col"]]
            have = set(p.source.astype(str).str.strip() + "|" + p.dates.astype(str).str.strip())
            for i, r in p.iterrows(): out.append(dict(race=st, origin=os.path.relpath(f, BASE), row=int(i) + 2, **r.to_dict()))
        # the model skips an extra or site row whose pollster and dates are already in the race's file (_add_extra)
        for r in sm.EXTRA_POLLS.get(st) or []:
            if f"{r.get('source', '').strip()}|{r.get('dates', '').strip()}" in have: continue
            # a placeholder EXTRA_POLLS row says so in a comment on its own line in senate_mode.py
            ln = next((i + 1 for i, l in enumerate(src) if r.get("source", "") in l and r.get("dates", "") in l), None)
            note = src[ln - 1] if ln else ""
            out.append(dict(race=st, origin="senate_mode.py EXTRA_POLLS", row=ln, note=note.split("#", 1)[1].strip() if "#" in note else "", **r))
        for r in sps.SITE_SYNC.get(st) or []:
            if f"{r.get('source', '').strip()}|{r.get('dates', '').strip()}" in have: continue
            out.append(dict(race=st, origin="site_poll_sync.py", row=None, **r))
    return pd.DataFrame(out)

def check_polls(P, as_of):
    issues = []
    def add(level, r, msg): issues.append(dict(level=level, race=r.race, source=r.get("source"), dates=r.get("dates"), origin=r.origin, row=r.row, issue=msg))
    P = P.copy()
    P["end_ts"] = pd.to_datetime(P.end, errors="coerce")
    for c in ("n", "D", "R", "O", "U"):
        if c in P: P[c] = pd.to_numeric(P[c], errors="coerce")
    for _, r in P.iterrows():
        if pd.isna(r.end_ts): add("error", r, "end date unreadable")
        elif r.end_ts > as_of: add("error", r, f"poll ends {r.end_ts.date()}, after AS_OF {as_of.date()}")
        if pd.isna(r.get("n")) or r.get("n", 0) <= 0: add("error", r, "sample size missing or zero")
        elif r.n < 200: add("warn", r, f"sample size {int(r.n)} under 200")
        D = r.get("D"); R = r.get("R")
        if "split" in str(r.get("origin")): pass
        if pd.notna(D) and D <= 0 or pd.notna(R) and R <= 0: add("error", r, "D or R share at or below zero")
        pop = str(r.get("pop", "")).strip().upper()
        if pop not in ("LV", "RV", "V", "A"): add("error", r, f"population label '{r.get('pop')}'")
        tot = np.nansum([r.get(c, np.nan) for c in ("D", "R", "O", "U")])
        if tot > 102: add("error", r, f"shares total {tot:.1f}")
        elif 0 < tot < 85: add("warn", r, f"shares total {tot:.1f}")
        text = f"{r.get('source', '')} {r.get('dates', '')} {r.get('note', '')}"
        if PLACEHOLDER.search(text) and pd.notna(r.end_ts):
            age = (as_of - r.end_ts).days
            add("warn" if age > 3 else "info", r, f"placeholder still in use, poll ended {age} days before AS_OF")
    # duplicates
    P["k"] = P.race + "|" + P.source.map(norm) + "|" + P.end_ts.astype(str) + "|" + P["pop"].astype(str).str.upper()
    for k, g in P.groupby("k"):
        if len(g) < 2: continue
        same = g[["D", "R"]].round(2).drop_duplicates()
        r = g.iloc[0]
        if len(same) == 1:
            add("error", r, f"duplicate poll, {len(g)} copies ({', '.join(sorted(set(g.origin)))})")
        else:
            add("warn", r, f"same pollster and end date entered {len(g)} times with different numbers")
    return issues

def check_house(as_of):
    issues = []
    try:
        import ast
        src = open(os.path.join(BASE, "FLH", "house_mode.py")).read()
        node = next(n for n in ast.parse(src).body if isinstance(n, ast.Assign) and any(getattr(t, "id", "") == "POLLS" for t in n.targets))
        POLLS = eval(compile(ast.Expression(node.value), "house_mode.py", "eval"), {"dict": dict})
    except Exception as e:
        return [dict(level="warn", race="House", issue=f"could not read House POLLS: {e}")]
    for st, dd in POLLS.items():
        for dist, v in dd.items():
            if v.get("d", 0) <= 0 or v.get("r", 0) <= 0: issues.append(dict(level="error", race=f"{st}-{dist}", issue="House poll D or R at or below zero"))
            if v.get("d", 0) + v.get("r", 0) > 100.5: issues.append(dict(level="error", race=f"{st}-{dist}", issue=f"House poll D + R = {v['d'] + v['r']:.1f}"))
    return issues

def check_fits(as_of):
    issues = []
    for f in ("house_effects_2026.json", "lv_gap_2026.json"):
        p = os.path.join(BASE, f)
        if not os.path.exists(p):
            issues.append(dict(level="warn", race="all", issue=f"{f} missing, run its script")); continue
        a = json.load(open(p)).get("as_of")
        if a and pd.Timestamp(a) < as_of:
            issues.append(dict(level="warn", race="all", issue=f"{f} fit as of {a}, before AS_OF {as_of.date()}: re-run {f.split('_2026')[0]}.py"))
    return issues

def check_counties(run, prev):
    issues = []
    for f in sorted(os.listdir(prev)):
        if not f.endswith("_county_forecast.csv"): continue
        a = os.path.join(run, f)
        if not os.path.exists(a):
            issues.append(dict(level="error", race=f, issue="county forecast missing from the new run")); continue
        na, nb = len(pd.read_csv(a)), len(pd.read_csv(os.path.join(prev, f)))
        if na != nb: issues.append(dict(level="error", race=f, issue=f"{na} counties, previous run had {nb}"))
    return issues

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run"); ap.add_argument("--prev")
    a = ap.parse_args()
    as_of = pd.Timestamp(os.environ.get("AS_OF", pd.Timestamp.now(tz="America/New_York").strftime("%Y-%m-%d")))
    os.environ["AS_OF"] = str(as_of.date())
    import senate_mode as sm
    P = senate_polls(sm)
    issues = check_polls(P, as_of) + check_house(as_of) + check_fits(as_of)
    if a.run:
        prev = a.prev
        if not prev:
            L = json.load(open(os.path.join(SCRATCH, "LATEST.json")))
            prev = L.get("statewide") or L.get("fc")
        issues += check_counties(a.run, prev)
    rep = dict(as_of=str(as_of.date()), polls_checked=int(len(P)), races=int(P.race.nunique()),
               errors=sum(i["level"] == "error" for i in issues), warnings=sum(i["level"] == "warn" for i in issues), issues=issues)
    json.dump(rep, open(os.path.join(BASE, "check_inputs_report.json"), "w"), indent=1, default=str)
    print(f"checked {rep['polls_checked']} polls in {rep['races']} races: {rep['errors']} errors, {rep['warnings']} warnings")
    for i in issues:
        if i["level"] != "info":
            print(f"  {i['level'].upper():5s} {i.get('race')}: {i.get('issue')}  [{i.get('source') or ''} {i.get('dates') or ''} {i.get('origin') or ''} {i.get('row') or ''}]")
    sys.exit(1 if rep["errors"] else 0)

if __name__ == "__main__":
    main()
