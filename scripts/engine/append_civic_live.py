# Adds civicAPI's current state of each race (its public race endpoint, as fetched by fetch_civic_live.py) to the
# compact history, in the format scripts/engine/extract_civic_history.py writes.
#
#   python3 scripts/engine/append_civic_live.py <history dir> <new history dir> <fetched dir> [<fetched dir> ...]
#
# Each fetched state becomes a snapshot at the time it was fetched: that is when it was seen to be published. Where the
# state differs from the last stored snapshot, it is also entered once at the provider's own "last_updated" time, which
# is when the provider says it published it (never earlier than the last stored snapshot, never later than the fetch).
# Nothing is interpolated: between the old history's last snapshot and that time the history simply has no entry.
# Every listed region row is stored; rows no longer listed are recorded as removed.
import json, gzip, os, sys, glob
src, out, lives = sys.argv[1], sys.argv[2], sys.argv[3:]
os.makedirs(out, exist_ok=True); n = miss = newc = early = 0
for f in sorted(glob.glob(src + "/*.json.gz")):
    rid = os.path.basename(f).split(".")[0]; race = json.load(gzip.open(f)); names = race["cands"]
    def ci(c, seen):
        base = (c.get("name") or "", c.get("party")); seen[base] = seen.get(base, 0) + 1; k = 0
        for i, x in enumerate(names):
            if (x[0], x[1]) == base:
                k += 1
                if k == seen[base]:
                    if x[2] is None and c.get("candidate_id") is not None: x[2] = c.get("candidate_id")
                    return i
        # the same person under a reworded party label keeps their id
        if c.get("candidate_id") is not None:
            for i, x in enumerate(names):
                if x[2] == c.get("candidate_id") and x[0] == base[0]: return i
        global newc; newc += 1; names.append([base[0], base[1], c.get("candidate_id")]); return len(names) - 1
    race["snaps"].sort(key=lambda s: s["t"])
    for live in lives:
        lp = os.path.join(live, rid + ".json")
        if not os.path.exists(lp): miss += 1; continue
        d = json.load(open(lp))
        listed = set()
        for s in race["snaps"]:
            listed |= set((s.get("r") or {}).keys()); listed -= set(s.get("x") or [])
        v = []; w = []; seen = {}
        for c in d.get("candidates") or []:
            i = ci(c, seen); v.append([i, c.get("votes")])
            if c.get("winner"): w.append(i)
            if c.get("advanced"): w.append(-1 - i)
        r = {}; here = set()
        for k, g in (d.get("region_results") or {}).items():
            if g.get("type") == "Precinct": continue
            here.add(k)
            if k not in race["regions"]: race["regions"][k] = [g.get("fips"), g.get("name"), g.get("type")]
            rs = {}; r[k] = [g.get("percent_reporting")] + [[ci(c, rs), c.get("votes")] for c in g.get("candidates") or []]
        snap = {"x": sorted(listed - here), "t": d["_fetched_at"], "ck": "live_fetch", "pr": d.get("percent_reporting"), "ca": d.get("called_at"), "lu": d.get("last_updated"), "pc": d.get("polls_close"),
                "td": d.get("test_data"), "rd": d.get("round"), "dis": d.get("is_disputed"), "v": v, "w": w, "r": r}
        prev = race["snaps"][-1] if race["snaps"] else None; lu = d.get("last_updated")
        changed = prev is None or sorted(map(tuple, prev["v"])) != sorted(map(tuple, v)) or prev.get("pr") != snap["pr"] or sorted(prev.get("w") or []) != sorted(w)
        if changed and lu and prev is not None and prev["t"] < lu < snap["t"]:
            race["snaps"].append({**snap, "t": lu, "ck": "live_last_updated"}); snap = {**snap, "x": []}; early += 1
        race["snaps"].append(snap); n += 1
        race["final"] = {"pr": snap["pr"], "ca": snap["ca"], "lu": snap["lu"], "pc": snap["pc"], "district": d.get("district"), "scope": d.get("election_scope"), "ename": d.get("election_name"), "etype": d.get("election_type"), "v": v, "w": w, "r": r}
    json.dump(race, gzip.open(os.path.join(out, rid + ".json.gz"), "wt"), separators=(",", ":"))
print("snapshots added", n, "of them also entered at the provider's last_updated time", early, "races without a fetched file", miss, "new candidate rows", newc)
