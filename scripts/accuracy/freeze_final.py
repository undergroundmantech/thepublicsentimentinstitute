"""Freeze the final 2026 forecast, as published on November 3, 2026.

  python3 scripts/accuracy/freeze_final.py [REPO]

Copies every file the forecast pages read on Election Day, byte for byte, into
public/forecast/archive/final-2026-11-03/ and writes manifest.json beside them: each file's size, SHA-256 and the time
it was written. The copies never change again. Anyone can check them two ways: hash the copy and compare it with the
manifest, and hash the same path in the git commit from November 3 and compare it with both.
"""
import hashlib, json, os, shutil, sys, datetime as dt

REPO = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
SRC = os.path.join(REPO, "public", "forecast")
OUT = os.path.join(SRC, "archive", "final-2026-11-03")
FILES = [
    ("model.json", "Senate, House and governor races and chamber odds"),
    ("counties.json", "County forecasts for the statewide races"),
    ("downballot.json", "Statewide offices below governor"),
    ("downballot_counties.json", "County forecasts for the statewide offices"),
    ("measures.json", "Statewide ballot measures"),
    ("measures_counties.json", "County forecasts for the ballot measures"),
    ("measures_hub.json", "Ballot measure summary"),
    ("statehouse.json", "Every state legislative district"),
    ("statehouse_hub.json", "Every state legislative chamber"),
    ("polls_published.json", "The polls in the final averages"),
    ("earlyvote_adjust.json", "The early vote adjustment applied on Election Day"),
    ("other_races.json", "Courts, mayors and local races"),
    ("archive/2026-11-03.json", "The Election Day simulation run"),
    ("archive/index.json", "Chamber odds on every archived day since October 3"),
]
FROZEN_AT = "2026-11-03"

def sha(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""): h.update(b)
    return h.hexdigest()

os.makedirs(OUT, exist_ok=True)
rows = []
for rel, what in FILES:
    src = os.path.join(SRC, rel)
    name = rel.replace("archive/", "sims_")
    dst = os.path.join(OUT, name)
    if not os.path.exists(dst):
        shutil.copy2(src, dst)          # never overwrite a frozen copy
    st = os.stat(dst)
    rows.append(dict(file=name, live_path=f"/forecast/{rel}", what=what, bytes=st.st_size, sha256=sha(dst),
                     written_utc=dt.datetime.fromtimestamp(st.st_mtime, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")))
m = json.load(open(os.path.join(OUT, "model.json")))
bundle = hashlib.sha256("\n".join(f"{r['sha256']}  {r['file']}" for r in rows).encode()).hexdigest()
manifest = dict(
    title="On Point Politics final 2026 forecast", frozen=FROZEN_AT, forecast_updated=m["meta"]["updated"],
    election="2026-11-03", polls_first_close_utc="2026-11-03T23:00:00Z",
    last_written_utc=max(r["written_utc"] for r in rows), bundle_sha256=bundle,
    bundle_rule="SHA-256 of the lines '<sha256>  <file>' for every file below, in this order, joined by newlines",
    files=rows,
)
json.dump(manifest, open(os.path.join(OUT, "manifest.json"), "w"), indent=1)
with open(os.path.join(OUT, "SHA256SUMS"), "w") as f:
    f.write("".join(f"{r['sha256']}  {r['file']}\n" for r in rows))
print(json.dumps({k: v for k, v in manifest.items() if k != "files"}, indent=1))
for r in rows: print(r["written_utc"], r["bytes"], r["sha256"][:16], r["file"])
