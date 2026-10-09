"""Daily forecast archive, Oct 3 2026.

  python3 archive_forecast.py FC_DIR HOUSE_DIR DATE [ARCHIVE_DIR ...]

Writes one file per forecast day, DATE.json, with every Senate and governor race's simulated margin, win probability
and 80 percent range, the chamber odds for the Senate, governors and House, and the run's settings, then rebuilds
index.json, the list of archived days with the chamber odds, so the forecast's path over time can be read back. A day
archived twice is overwritten, so the last run of the day is the one kept. Each ARCHIVE_DIR gets the same files; the
default is the scratchpad's forecast_archive folder.
"""
import glob, json, os, sys
import numpy as np

BASE = os.path.dirname(os.path.abspath(__file__))
SEATS_NOT_UP_D, GOV_NOT_UP_D = 34, 6     # Democratic seats and governors not on the 2026 ballot

def race_rows(fc):
    S = json.load(open(os.path.join(fc, "run_summary.json")))
    R = S["results"]; out = {}
    for k, v in sorted(R.items()):
        f = os.path.join(fc, f"sim_margin_{k}.npy")
        if not os.path.exists(f): continue
        a = np.load(f)
        cand = v.get("candidate") or {}
        out[k] = dict(office="governor" if k.endswith("G") and len(k) == 3 else "senate", n_sims=int(len(a)),
                      margin=round(float(a.mean()), 2), win_d=round(float((a > 0).mean()) * 100, 2),
                      p10=round(float(np.percentile(a, 10)), 2), p90=round(float(np.percentile(a, 90)), 2),
                      deterministic_margin=v.get("deterministic_margin"), n_polls=v.get("n_polls"),
                      poll_house_index=v.get("poll_house_index"), poll_avg=v.get("poll_avg"),
                      spread_calibration=(v.get("simulation") or {}).get("spread_calibration"))
    return S, out

def chambers(fc, races, house):
    sen = [k for k, r in races.items() if r["office"] == "senate"]; gov = [k for k, r in races.items() if r["office"] == "governor"]
    def tally(keys, drop=()):
        t = None
        for k in keys:
            w = (np.load(os.path.join(fc, f"sim_margin_{k}.npy")) > 0).astype(int)
            if k in drop: w = np.zeros_like(w)
            t = w if t is None else t + w
        return t
    s = tally(sen) + SEATS_NOT_UP_D; s2 = tally(sen, drop=("NE",)) + SEATS_NOT_UP_D
    g = tally(gov) + GOV_NOT_UP_D
    ch = dict(senate=dict(d_control=round(float((s >= 51).mean()) * 100, 2), d_seats_median=float(np.median(s)),
                          p10=float(np.percentile(s, 10)), p90=float(np.percentile(s, 90)),
                          d_control_without_osborn=round(float((s2 >= 51).mean()) * 100, 2)),
              governors=dict(d_majority=round(float((g >= 26).mean()) * 100, 2), d_median=float(np.median(g)),
                             p10=float(np.percentile(g, 10)), p90=float(np.percentile(g, 90))))
    hs = os.path.join(house, "national_summary.json") if house else None
    if hs and os.path.exists(hs):
        h = json.load(open(hs))
        ch["house"] = dict(d_majority=h.get("d_majority"), d_seats_median=h.get("median"), p10=h.get("p10"), p90=h.get("p90"), n_sims=h.get("n"))
    return ch

def main():
    fc, house, day = sys.argv[1], sys.argv[2], sys.argv[3]
    dirs = sys.argv[4:] or [os.path.join(os.path.dirname(BASE), "forecast_archive")]
    S, races = race_rows(fc)
    rec = dict(date=day, statewide_run=fc, house_run=house, n_sims=(S.get("dynamic") or {}).get("n_sims"),
               chambers=chambers(fc, races, house), races=races)
    for d in dirs:
        os.makedirs(d, exist_ok=True)
        json.dump(rec, open(os.path.join(d, f"{day}.json"), "w"), indent=1, default=float)
        idx = []
        for f in sorted(glob.glob(os.path.join(d, "20??-??-??.json"))):
            r = json.load(open(f))
            idx.append(dict(date=r["date"], n_sims=r.get("n_sims"), chambers=r["chambers"]))
        json.dump(dict(days=idx), open(os.path.join(d, "index.json"), "w"), indent=1)
        print(f"archived {day} to {d}: {len(races)} races, {len(idx)} days on file")

if __name__ == "__main__":
    main()
