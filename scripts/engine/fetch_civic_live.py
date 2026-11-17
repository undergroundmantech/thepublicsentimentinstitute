# One gentle pass over civicAPI's public race endpoint (the one the site itself reads), for the races already in a
# history folder: one request at a time, a pause between requests, an identifying User-Agent, one retry. Saves each
# race's JSON as received, with the time it was fetched. Run it only as often as the count is still changing (a few
# times a day at most): it is about 900 requests and takes a quarter of an hour.
#
#   python3 scripts/engine/fetch_civic_live.py <new folder for this pass> <history dir>
import json, os, sys, time, urllib.request, glob, gzip
out = sys.argv[1]; ids = sorted(int(os.path.basename(f).split(".")[0]) for f in glob.glob(sys.argv[2] + "/*.json.gz"))
ok = bad = 0
for i, rid in enumerate(ids):
    p = os.path.join(out, f"{rid}.json")
    if os.path.exists(p): ok += 1; continue
    for attempt in (0, 1):
        try:
            req = urllib.request.Request(f"https://civicapi.org/api/v2/race/{rid}", headers={"accept": "application/json", "user-agent": "OnPointPolitics-results/1.0 (onpointpolitics.us)"})
            with urllib.request.urlopen(req, timeout=30) as r: body = r.read()
            d = json.loads(body); d["_fetched_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            json.dump(d, open(p, "w")); ok += 1; break
        except Exception as e:
            if attempt: bad += 1; print("FAILED", rid, str(e)[:80], flush=True)
            else: time.sleep(5)
    time.sleep(0.4)
    if i % 100 == 0: print(i, ok, bad, flush=True)
print("done", ok, bad)
