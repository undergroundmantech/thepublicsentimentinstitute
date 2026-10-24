"""Pull fresh FEC money for every House nominee, for the On Point forecast's House finance term.

Run it where api.open.fec.gov is reachable, such as the Codespace:
    export FEC_API_KEY=your_key        free at https://api.data.gov/signup/ ; DEMO_KEY works but is very slow
    python3 scripts/forecast/model/finance/pull_fec_house.py
It reads house_fec_ids.json beside it, the FEC candidate IDs of both nominees in all 435 districts, and writes
fec_house_pull.json beside it: each candidate's cycle totals, the outside spending FEC has processed for and against
them by committee, and the 24 and 48 hour outside spending notices filed since Oct 1. About 60 to 120 calls. Then
commit and push that one file; the forecast side converts it into the House finance books.
Standard library only."""
import json, os, sys, time, urllib.parse, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
KEY = os.environ.get("FEC_API_KEY", "DEMO_KEY")
BASE = "https://api.open.fec.gov/v1"
ids = json.load(open(os.path.join(HERE, "house_fec_ids.json")))
cands = sorted({c for r in ids.values() for s in "DR" for c in r[s]["fec_id"]})
print(len(cands), "candidates", flush=True)
calls = 0
def get(path, params):
    global calls
    q = urllib.parse.urlencode([("api_key", KEY)] + [(k, x) for k, v in params.items() for x in (v if isinstance(v, list) else [v])])
    url = f"{BASE}{path}?{q}"
    for attempt in range(8):
        try:
            calls += 1
            with urllib.request.urlopen(url, timeout=60) as r: return json.load(r)
        except urllib.error.HTTPError as e:
            wait = 65 if e.code == 429 else 5 * (attempt + 1)
            print(f"  HTTP {e.code}, waiting {wait}s", flush=True); time.sleep(wait)
        except Exception as e:
            print(f"  {e}, retrying", flush=True); time.sleep(5 * (attempt + 1))
    raise SystemExit(f"gave up on {path}")
def paged(path, params):
    rows, page = [], 1
    while True:
        d = get(path, dict(params, per_page=100, page=page)); rows += d.get("results", [])
        pg = d.get("pagination", {})
        if page >= (pg.get("pages") or 1): return rows
        page += 1
out = dict(pulled=time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime()), totals={}, ie_by_candidate=[], ie_notices=[])
for i in range(0, len(cands), 50):
    chunk = cands[i:i + 50]
    for r in paged("/candidates/totals/", dict(candidate_id=chunk, cycle=2026, election_full="true")):
        out["totals"][r["candidate_id"]] = {k: r.get(k) for k in ("name", "party", "receipts", "disbursements", "cash_on_hand_end_period",
            "last_cash_on_hand_end_period", "coverage_end_date", "individual_itemized_contributions", "individual_contributions",
            "candidate_contribution", "loans", "election_year", "cycle")}
    out["ie_by_candidate"] += paged("/schedules/schedule_e/by_candidate/", dict(candidate_id=chunk, cycle=2026))
    print(f"{min(i + 50, len(cands))}/{len(cands)} candidates, {calls} calls", flush=True)
# recent 24 and 48 hour notices, which FEC processes later than the periodic reports
for i in range(0, len(cands), 50):
    chunk = cands[i:i + 50]; last = {}
    while True:
        d = get("/schedules/schedule_e/", dict(candidate_id=chunk, min_date="2026-10-01", is_notice="true", per_page=100,
                                               sort="-expenditure_date", **last))
        res = d.get("results", [])
        out["ie_notices"] += [{k: r.get(k) for k in ("candidate_id", "committee_id", "support_oppose_indicator", "expenditure_amount",
                               "expenditure_date", "dissemination_date", "election_type", "transaction_id", "file_number",
                               "amendment_indicator", "memo_code")} | {"committee_name": (r.get("committee") or {}).get("name")} for r in res]
        li = (d.get("pagination") or {}).get("last_indexes")
        if not res or not li: break
        last = {k: v for k, v in li.items()}
    print(f"notices {min(i + 50, len(cands))}/{len(cands)}, {len(out['ie_notices'])} rows, {calls} calls", flush=True)
p = os.path.join(HERE, "fec_house_pull.json"); json.dump(out, open(p, "w"), indent=1)
print("wrote", p, len(out["totals"]), "totals,", len(out["ie_by_candidate"]), "outside rows,", len(out["ie_notices"]), "notices,", calls, "calls")
