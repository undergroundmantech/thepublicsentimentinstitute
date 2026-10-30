"""Summary of the observed PA 2024 presidential capture series: statewide counted votes, two-party margin and mail share per capture.
Class HISTORICAL_OBSERVED_CAPTURE_TIME. There is no final truth in the file, so nothing here is scored. Run: python3 scripts/vai/backtest/pa_summary.py"""
import json, pathlib
root = pathlib.Path(__file__).resolve().parents[3]
d = json.load(open(root / "data/vai/backtest/pa2024_president_observed.json"))
out, prev = [], None
for s in d["snapshots"]:
    c = list(s["counties"].values())
    dem, rep, oth = (sum(x[k] for x in c) for k in ("dem", "rep", "other"))
    dm, rm = sum(x["demMail"] for x in c), sum(x["repMail"] for x in c)
    tot = dem + rep + oth
    if tot == 0 or (prev is not None and tot == prev):
        prev = tot; continue
    out.append({"capturedAt": s["capturedAt"], "countiesReporting": sum(1 for x in c if x["dem"] + x["rep"] > 0), "votes": tot,
                "twoPartyMarginDemMinusRep": round((dem - rep) / (dem + rep), 4), "demMailShare": round(dm / dem, 3), "repMailShare": round(rm / rep, 3)})
    prev = tot
first, last = out[0], out[-1]
lead = max(out, key=lambda r: r["twoPartyMarginDemMinusRep"])
sign_change = next(r for r in out if r["twoPartyMarginDemMinusRep"] < 0)
summary = {
    "schema": "vai-observed-summary/1", "class": "HISTORICAL_OBSERVED_CAPTURE_TIME", "source": "data/vai/backtest/pa2024_president_observed.json",
    "note": "Observation times are archive crawl times. Distinct counted totals only. No final truth is held, so no value here is a forecast error.",
    "distinctCaptures": len(out), "firstCapture": first, "lastCapture": last, "maxDemLeadCapture": lead, "firstDemNegativeCapture": sign_change,
    "marginRangeDemMinusRep": [min(r["twoPartyMarginDemMinusRep"] for r in out), lead["twoPartyMarginDemMinusRep"]],
    "series": out,
}
json.dump(summary, open(root / "data/vai/backtest/pa2024_arrival_summary.json", "w"), indent=1)
print(len(out), first["votes"], last["votes"], lead["twoPartyMarginDemMinusRep"], sign_change["capturedAt"], last["twoPartyMarginDemMinusRep"])
