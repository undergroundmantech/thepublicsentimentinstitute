#!/usr/bin/env python3
"""Fetches every source in sources.json into a local cache and checks the evidence anchors.

    python3 scripts/intelligence/research/fetch_sources.py [--only ID ...] [--report PATH]

Needs: beautifulsoup4 and pypdf (scripts/intelligence/research/requirements.txt).

Outputs (cache is not committed; .cache/ is gitignored):
  .cache/intelligence-sources/raw/<id>        bytes as retrieved
  .cache/intelligence-sources/text/<id>.txt   extracted text
  .cache/intelligence-sources/fetch-log.jsonl one JSON line per source, latest attempt

A page that changes after retrieval will have a different sha256 than the committed register. That is reported
as CHANGED, not as a failure: what the build depends on are the anchors, verbatim phrases that must still be
present in the text. A missing anchor or a failed required source stops the build with an explicit message.
"""
import argparse, datetime, hashlib, io, json, os, re, sys, urllib.error, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
MANIFEST = os.path.join(HERE, "sources.json")
CACHE = os.path.join(ROOT, ".cache", "intelligence-sources")
REGISTER = os.path.join(ROOT, "data", "intelligence", "sources", "register-2026-10-26.json")
UA = "Mozilla/5.0 (compatible; OnPointResearch/1.0; +research pipeline)"
FETCH_VERSION = "1"


def need(mod, pkg):
    try:
        return __import__(mod)
    except ImportError:
        sys.exit(f"MISSING DEPENDENCY: {pkg}. Install with: pip install -r scripts/intelligence/research/requirements.txt")


def norm(s):
    """Case-, whitespace-, quote- and dash-insensitive form used to match anchors against extracted text."""
    for a, b in (("\u2019", "'"), ("\u2018", "'"), ("\u201c", '"'), ("\u201d", '"'), ("\u00a0", " "),
                 ("\u2010", "-"), ("\u2011", "-"), ("\u2012", "-"), ("\u2013", "-"), ("\u2014", "-")):
        s = s.replace(a, b)
    return re.sub(r"\s+", " ", s).strip().lower()


def to_text(raw, is_pdf, bs4, pypdf):
    if is_pdf:
        reader = pypdf.PdfReader(io.BytesIO(raw))
        # pypdf can emit one word per line; join with spaces so anchors match
        return " ".join((p.extract_text() or "") for p in reader.pages)
    soup = bs4.BeautifulSoup(raw, "html.parser")
    for t in soup(["script", "style", "noscript"]):
        t.decompose()
    return soup.get_text("\n")


def fetch(url, timeout=45):
    last = None
    for _ in range(2):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.status, r.geturl(), r.headers.get("Content-Type", ""), r.read(), None
        except urllib.error.HTTPError as e:
            return e.code, url, e.headers.get("Content-Type", "") if e.headers else "", b"", f"HTTP {e.code}"
        except Exception as e:  # timeouts, DNS, TLS
            last = f"{type(e).__name__}: {e}"
    return 0, url, "", b"", last


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--report")
    a = ap.parse_args()
    bs4 = need("bs4", "beautifulsoup4")
    pypdf = need("pypdf", "pypdf")
    manifest = json.load(open(MANIFEST))
    recorded = {}
    if os.path.exists(REGISTER):
        for s in json.load(open(REGISTER)).get("sources", []):
            recorded[s["id"]] = s.get("sha256")
    os.makedirs(os.path.join(CACHE, "raw"), exist_ok=True)
    os.makedirs(os.path.join(CACHE, "text"), exist_ok=True)
    logp = os.path.join(CACHE, "fetch-log.jsonl")
    log = {}
    if os.path.exists(logp):
        for line in open(logp):
            d = json.loads(line)
            log[d["id"]] = d
    problems, report = [], []
    for s in manifest["sources"]:
        if a.only and s["id"] not in a.only:
            continue
        now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        http, final, ctype, raw, err = fetch(s["url"])
        row = {"id": s["id"], "url": s["url"], "final_url": final, "http": http, "content_type": ctype.split(";")[0].strip(), "retrieved_at": now,
               "sha256": None, "bytes": len(raw), "error": err, "anchorsMissing": [], "changedSinceRecorded": None}
        if http == 200 and raw:
            is_pdf = raw[:4] == b"%PDF" or "pdf" in ctype.lower()
            row["sha256"] = hashlib.sha256(raw).hexdigest()
            open(os.path.join(CACHE, "raw", s["id"]), "wb").write(raw)
            try:
                text = to_text(raw, is_pdf, bs4, pypdf)
            except Exception as e:
                text = ""
                row["error"] = f"TEXT EXTRACTION FAILED: {type(e).__name__}: {e}"
            open(os.path.join(CACHE, "text", s["id"] + ".txt"), "w").write(text)
            nt = norm(text)
            row["anchorsMissing"] = [x for x in s.get("anchors", []) if norm(x) not in nt]
            rec = recorded.get(s["id"])
            row["changedSinceRecorded"] = None if rec is None else rec != row["sha256"]
        else:
            row["error"] = row["error"] or f"HTTP {http}"
        log[s["id"]] = row
        report.append(row)
        bad = row["error"] or row["anchorsMissing"]
        if bad and s.get("required", True):
            problems.append(row)
        tag = "OK" if not bad else ("FAILED" if s.get("required", True) else "UNAVAILABLE(optional)")
        extra = "" if not row["anchorsMissing"] else f" ANCHORS MISSING: {row['anchorsMissing']}"
        print(f"{tag:22} {s['id']:28} http={http} bytes={row['bytes']}{' CHANGED' if row['changedSinceRecorded'] else ''}{extra}{' ' + row['error'] if row['error'] else ''}")
    with open(logp, "w") as f:
        for d in log.values():
            f.write(json.dumps(d) + "\n")
    if a.report:
        meta = {"fetchVersion": FETCH_VERSION, "python": sys.version.split()[0], "beautifulsoup4": bs4.__version__, "pypdf": pypdf.__version__}
        json.dump({"kind": "FETCH_REPORT", "tooling": meta, "sources": report}, open(a.report, "w"), indent=1)
    if problems:
        print(f"\n{len(problems)} required source(s) failed: " + ", ".join(p["id"] for p in problems), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
