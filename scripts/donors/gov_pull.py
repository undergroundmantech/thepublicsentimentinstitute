"""Governor donor maps for 2022 and 2026: each nominee's itemized gifts from the state's own campaign finance files, placed
in the county the donor lives in, with the same gift size bands and ZIP to county method as the FEC map. Run it in GitHub
Codespaces; the On Point sandbox cannot reach the state sites.

  python3 scripts/donors/gov_pull.py --list                      every state, its route, and whether data is in place
  python3 scripts/donors/gov_pull.py --howto MI                  what to export by hand for a manual state
  python3 scripts/donors/gov_pull.py --probe TX --cycle 2026     download, show the columns it found and the committees it matched
  python3 scripts/donors/gov_pull.py --states auto --cycles 2022,2026
  python3 scripts/donors/gov_pull.py --states all  --cycles 2022,2026      manual states run when their drop folder has files

Where the gifts come from is in scripts/donors/gov_sources.json:
  table      a bulk file (csv, txt, xlsx, or a zip of them) with every committee's gifts; nominees are found by committee
             or candidate name, or through a filer table when the gift rows only carry a filer id
  socrata    New York's open data API, filtered to governor committees and Schedule A
  calaccess  California's CAL-ACCESS export: Form 460 Schedule A, latest amendment of each filing
  manual     no usable bulk file. Export each nominee's contributions from the state site and save them in
             ~/donorwork/gov/<ST>/<cycle>/drop/ named D_anything.csv, R_anything.csv (I_ for others). A file whose name
             starts with the party letter is credited to that nominee whole; other files go through the name match.
             csv, txt, tsv, xlsx, xls, zip and 7z (pip install py7zr) are read; the header row is found on its own.

Rules, the same as the FEC map where the state data allows:
  window: Jan 1 of the year before the election through Dec 31 (full) and through Sep 30 of the election year (sep30)
  individuals only when the file says who gave (a contributor type column); otherwise every itemized gift is kept and the
  output says so
  gift size bands: under $200, $200 to $999, $1,000 to $2,499, $2,500 and up; negative rows (refunds) come off the dollars
  ZIP codes are placed in 2020 counties by land area (Census ZCTA to county file, shared with fec_cycle_map.py)
Outputs, in scripts/forecast/donors/data/gov/<cycle>/<ST>.json (commit and push these):
  nominees  dollars and gifts by band for each nominee, both windows, in state share, and every committee name the
            match credited to them with its dollars, so a wrong match is easy to spot
  counties  fips -> {full, sep30} -> {usd[4], n[4], D[4], R[4]}
  stats     rows read, kept, dropped by rule, unmatched ZIP dollars
"""
import argparse, csv, io, json, os, re, sys, time, unicodedata, urllib.parse, urllib.request, zipfile
from collections import defaultdict

import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
REG = json.load(open(os.path.join(HERE, "gov_sources.json")))["states"]
UA = {"User-Agent": "Mozilla/5.0 (OnPointPolitics donor map research; onpointpolitics.com)"}
XWALK = "https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt"
STFIPS = {"AL": "01", "AK": "02", "AZ": "04", "AR": "05", "CA": "06", "CO": "08", "CT": "09", "FL": "12", "GA": "13", "HI": "15", "ID": "16", "IL": "17",
          "IA": "19", "KS": "20", "ME": "23", "MD": "24", "MA": "25", "MI": "26", "MN": "27", "NE": "31", "NV": "32", "NH": "33", "NM": "35", "NY": "36",
          "OH": "39", "OK": "40", "OR": "41", "PA": "42", "RI": "44", "SC": "45", "SD": "46", "TN": "47", "TX": "48", "VT": "50", "WI": "55", "WY": "56"}

ap = argparse.ArgumentParser()
ap.add_argument("--states", default="auto", help="auto, all, or a list like TX,PA,NY")
ap.add_argument("--cycles", default="2022,2026")
ap.add_argument("--cycle", type=int, default=2026, help="with --probe")
ap.add_argument("--work", default=os.path.expanduser("~/donorwork"))
ap.add_argument("--out", default=os.path.join(REPO, "scripts", "forecast", "donors", "data", "gov"))
ap.add_argument("--chunk", type=int, default=500_000)
ap.add_argument("--list", action="store_true")
ap.add_argument("--howto")
ap.add_argument("--probe")
A = ap.parse_args()
GOV = os.path.join(A.work, "gov"); DL = os.path.join(GOV, "_downloads"); os.makedirs(DL, exist_ok=True)


def log(*a): print(time.strftime("%H:%M:%S"), *a, flush=True)


def drop_dir(st, cy): return os.path.join(GOV, st, str(cy), "drop")


# ------------------------------------------------------------- downloads
def fetch(url, name=None):
    dest = os.path.join(DL, name or re.sub(r"[^A-Za-z0-9._-]", "_", url.split("://", 1)[1])[-150:])
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        log("cached", os.path.basename(dest)); return dest
    log("downloading", url)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=180) as r, open(dest + ".part", "wb") as f:
        total = int(r.headers.get("Content-Length") or 0); got = 0; t0 = time.time()
        while True:
            b = r.read(1 << 22)
            if not b: break
            f.write(b); got += len(b)
            if time.time() - t0 > 15: log(f"  {got / 1e6:.0f} of {total / 1e6:.0f} MB" if total else f"  {got / 1e6:.0f} MB"); t0 = time.time()
    os.replace(dest + ".part", dest)
    return dest


# ------------------------------------------------------------- reading any table
SYN = {
    "amount": ["contributionamount", "contributionamt", "amount", "orgamt", "rcptamount", "receipttransferamount", "receiptamount", "transactionamount", "amt", "contribamount", "contamt", "amountreceived", "contributionamountdollars"],
    "date": ["contributiondt", "contributiondate", "rcvdate", "scheddate", "receiptdate", "receipttransferdate", "transactiondate", "rcptdate", "datereceived", "date", "contdate", "contributionreceiveddate", "receiveddate"],
    "zip": ["contributorstreetpostalcode", "zip", "zipcode", "zip5", "flngentzip", "ctribzip4", "contributorzip", "contributorzipcode", "postalcode", "zipcd", "zip4"],
    "rid": ["filerident", "coid", "orgid", "filerid", "committeeid", "cmteid", "committeecode", "regno", "cpfid", "filer"],
    "rname": ["candidatename", "committeename", "candcommname", "filername", "candidate", "committee", "recipient", "recipientname", "candidatecommittee", "committeenm", "filernameorganization", "filernamefull"],
    "office": ["office", "officedesc", "officesought", "candidateoffice", "filerseekofficecd", "filerholdofficecd", "officecd"],
    "ctype": ["contributortype", "contributorpersenttypecd", "contributorpersonenttypecd", "entitycd", "receipttransfersourcetype", "contributortypedesc", "entitytype", "sourcetype"],
}


def norm(h): return re.sub(r"[^a-z0-9]", "", str(h).lower())


def detect(cols):
    """map each role to a column: exact normalized match first, then a column that starts with or contains the synonym"""
    n = {c: norm(c) for c in cols}; got = {}
    for role, syns in SYN.items():
        for how in ("eq", "sw", "in"):
            hit = [c for s in syns for c in cols if c not in got.values() and ((how == "eq" and n[c] == s) or (how == "sw" and n[c].startswith(s)) or (how == "in" and len(s) > 3 and s in n[c]))]
            if hit: got[role] = hit[0]; break
    got["names"] = [c for c in cols if any(s in n[c] for s in ("candidate", "committee", "candcomm", "filername", "recipient")) and "id" not in n[c][-2:]]
    got["offices"] = [c for c in cols if "office" in n[c]]
    return got


def sniff_sep(sample):
    first = sample.splitlines()[0] if sample else ""
    return max(["\t", "|", ","], key=lambda s: first.count(s))


def looks_like_header(row): return sum(1 for v in row if any(norm(v) == s or norm(v).startswith(s) for syn in SYN.values() for s in syn)) >= 2


def frames(path, member_re=None, columns=None, chunk=None):
    """yield DataFrames from a csv, txt, xlsx, zip or 7z, all columns as text"""
    chunk = chunk or A.chunk
    low = path.lower()
    if low.endswith(".zip"):
        z = zipfile.ZipFile(path)
        for m in z.namelist():
            if m.endswith("/") or not re.search(r"\.(csv|txt|tsv|xlsx|xls|dat)$", m, re.I): continue
            if member_re and not re.search(member_re, m, re.I): continue
            log("  reading", os.path.basename(path), "member", m)
            if m.lower().endswith((".xlsx", ".xls")):
                yield from _excel(io.BytesIO(z.read(m)), columns)
            else:
                yield from _text(lambda: z.open(m), columns, chunk)
        return
    if low.endswith(".7z"):
        try: import py7zr
        except ImportError: sys.exit("reading .7z needs py7zr: pip install py7zr")
        tmp = path + "_x"; os.makedirs(tmp, exist_ok=True)
        with py7zr.SevenZipFile(path) as a: a.extractall(tmp)
        for root, _, fs in os.walk(tmp):
            for f in sorted(fs): yield from frames(os.path.join(root, f), member_re, columns, chunk)
        return
    if member_re and not re.search(member_re, os.path.basename(path), re.I): return
    if low.endswith((".xlsx", ".xls")): yield from _excel(path, columns); return
    yield from _text(lambda: open(path, "rb"), columns, chunk)


def _excel(src, columns):
    raw = pd.read_excel(src, dtype=str, header=None)
    hdr = next((i for i in range(min(30, len(raw))) if looks_like_header(list(raw.iloc[i].fillna("")))), None)
    if hdr is None and columns: raw.columns = columns[:raw.shape[1]] + [f"c{i}" for i in range(len(columns), raw.shape[1])]; yield raw; return
    hdr = hdr or 0
    df = raw.iloc[hdr + 1:].copy(); df.columns = [str(c).strip() for c in raw.iloc[hdr].fillna("")]
    yield df


def _text(opener, columns, chunk):
    with opener() as fb:
        head = fb.read(200_000).decode("latin-1", "replace")
    lines = head.splitlines(); sep = sniff_sep(head); skip = None
    for i, l in enumerate(lines[:30]):
        hs = max(["\t", "|", ","], key=lambda d: l.count(d))
        if l.count(hs) and looks_like_header(next(csv.reader([l], delimiter=hs), [])): skip, sep = i, hs; break
    if skip is None and lines: sep = max(["\t", "|", ","], key=lambda d: sum(x.count(d) for x in lines[:20]))
    kw = dict(sep=sep, dtype=str, encoding="latin-1", on_bad_lines="skip", chunksize=chunk, keep_default_na=False)
    if sep != ",": kw["quoting"] = csv.QUOTE_NONE
    if skip is None and columns:
        kw.update(header=None, names=columns)
    else:
        kw.update(skiprows=skip or 0)
    with opener() as fb:
        try:
            for df in pd.read_csv(io.TextIOWrapper(fb, encoding="latin-1", newline=""), **{k: v for k, v in kw.items() if k != "encoding"}):
                df.columns = [str(c).strip() for c in df.columns]
                yield df
        except pd.errors.ParserError as e:
            log("  parse error, retrying with the python engine:", str(e)[:120])
    return


# ------------------------------------------------------------- nominees and matching
NICK = [["bob", "bobby", "robert", "rob", "robby"], ["greg", "gregory"], ["mike", "michael"], ["tom", "thomas"], ["dan", "daniel", "danny"], ["jim", "james", "jimmy"],
        ["josh", "joshua"], ["ned", "edward"], ["rick", "richard", "ricky"], ["phil", "phillip", "philip"], ["doug", "douglas"], ["tim", "timothy"], ["andy", "andrew"],
        ["steve", "steven", "stephen"], ["chris", "christopher"], ["ron", "ronald"], ["kim", "kimberly"], ["bill", "william"], ["joe", "joseph"], ["ken", "kenneth"],
        ["tony", "anthony"], ["cindy", "cynthia"], ["deb", "debra", "deborah", "debbie"], ["dave", "david"], ["les", "leslie"], ["wes", "wesley"], ["charlie", "charles"],
        ["ty", "tyler"], ["zach", "zachary"], ["sam", "samuel"], ["nan", "nancy"], ["jb", "jay", "jaybee"], ["gina", "georgina"], ["jon", "jonathan"], ["fred", "fredrick", "frederick"],
        ["kathy", "kathleen"], ["alan", "allen"], ["jerri", "jerry"], ["terri", "theresa", "teresa"], ["cyndi", "cynthia"], ["vic", "victor"], ["stacy", "stacey"], ["beto", "robert"]]


def deacc(s): return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def nom_regex(n):
    if n.get("re"): return re.compile(n["re"], re.I), None
    parts = [p for p in re.split(r"\s+", deacc(n["name"]).replace(".", " ")) if p and p.lower() not in ("jr", "sr", "ii", "iii")]
    last = parts[-1]; first = parts[0].lower()
    lr = re.compile(r"\b" + re.sub(r"[^A-Za-z]+", ".?", last) + r"\b", re.I)
    firsts = next((g for g in NICK if first in g), [first])
    fr = re.compile(r"\b(?:" + "|".join(sorted(set(firsts), key=len, reverse=True)) + r")|\bgov", re.I)
    return lr, fr


def match_names(names, noms):
    """names: Series of committee or candidate text. returns Series of nominee index or -1"""
    out = pd.Series(-1, index=names.index)
    txt = names.fillna("").map(deacc)
    for i, n in enumerate(noms):
        lr, fr = nom_regex(n)
        m = txt.str.contains(lr) & (txt.str.contains(fr) if fr is not None else True)
        out = out.where(~(m & (out < 0)), i)
    return out


def office_ok(df, cols):
    if not cols: return pd.Series(True, index=df.index)
    t = df[cols].fillna("").astype(str).agg(" ".join, axis=1)
    return t.str.contains(r"gov", case=False) & ~t.str.contains(r"lieut|lt\.?\s*gov|ltgov", case=False)


# ------------------------------------------------------------- ZIP to county
_X = None


def xwalk():
    global _X
    if _X is None:
        p = os.path.join(A.work, "tab20_zcta520_county20_natl.txt")
        if not os.path.exists(p): p = fetch(XWALK, "tab20_zcta520_county20_natl.txt")
        X = pd.read_csv(p, sep="|", dtype=str); X = X.rename(columns={c: c.upper() for c in X.columns})
        zc = next(c for c in X.columns if "ZCTA5" in c and "GEOID" in c); cc = next(c for c in X.columns if "COUNTY" in c and "GEOID" in c); land = next(c for c in X.columns if "AREALAND_PART" in c)
        X = X[X[zc].notna() & X[cc].notna()][[zc, cc, land]].rename(columns={zc: "zip", cc: "fips", land: "land"})
        X["land"] = pd.to_numeric(X.land, errors="coerce").fillna(0.0)
        X["w"] = X.land / X.groupby("zip").land.transform("sum").replace(0, 1)
        _X = X[["zip", "fips", "w"]]
    return _X


def to_date(s):
    s = s.fillna("").astype(str).str.strip()
    ymd = s.str.fullmatch(r"\d{8}")
    out = pd.to_datetime(s.where(ymd, None), format="%Y%m%d", errors="coerce")
    rest = ~ymd & (s != "")
    if rest.any():
        r = s[rest].str.replace(r"T.*$", "", regex=True).str.replace(r"\s+\d{1,2}:\d{2}.*$", "", regex=True)
        try: out[rest] = pd.to_datetime(r, errors="coerce", format="mixed")
        except (TypeError, ValueError): out[rest] = pd.to_datetime(r, errors="coerce")
    return out


def to_amt(s): return pd.to_numeric(s.fillna("").astype(str).str.replace(r"[$,\s]", "", regex=True).str.replace(r"^\((.*)\)$", r"-\1", regex=True), errors="coerce")


# ------------------------------------------------------------- the per state run
class Acc:
    def __init__(s): s.rows = []; s.stats = defaultdict(float); s.notes = []; s.sources = []

    def add(s, nom, amt, dt, z, recip=None):
        d = pd.DataFrame({"nom": nom.values, "amt": amt.values, "dt": dt.values, "zip": z.fillna("").astype(str).str.extract(r"(\d{5})", expand=False).values,
                          "r": (recip.fillna("").astype(str).str[:90].values if recip is not None else "")})
        s.rows.append(d)


def unpivot_multi(df):
    """PA style rows with CONTDATE1..3 and CONTAMT1..3 become one row per gift"""
    a = [c for c in df.columns if re.fullmatch(r"(?i)contamt\d", c)]
    if not a: return df
    out = []
    for c in a:
        k = c[-1]; dc = next((x for x in df.columns if x.lower() == f"contdate{k}"), None)
        t = df.copy(); t["_AMT"] = t[c]; t["_DATE"] = t[dc] if dc else ""
        out.append(t[t["_AMT"].astype(str).str.strip() != ""])
    return pd.concat(out, ignore_index=True)


def apply_rules(df, cfg, roles, acc):
    keep = pd.Series(True, index=df.index)
    for rule, sense in (("drop", False), ("keep", True)):
        r = cfg.get(rule)
        if not r: continue
        col = next((c for c in df.columns if norm(c) == norm(r["col"])), None)
        if col is None: continue
        hit = df[col].fillna("").astype(str).str.contains(r["re"], case=False, regex=True)
        if sense and not hit.any():
            acc.notes.append(f"keep rule {r['col']} matched nothing in a file, so it was not applied there"); continue
        acc.stats[f"{rule}_{r['col']}"] += float((~hit if sense else hit).sum())
        keep &= hit if sense else ~hit
    if not cfg.get("keep") and roles.get("ctype"):
        hit = df[roles["ctype"]].fillna("").astype(str).str.contains(r"individual|^ind$|person", case=False, regex=True)
        if hit.any():
            acc.stats["dropped_not_individual"] += float((~hit).sum()); keep &= hit
    return df[keep]


def take(df, cfg, noms, acc, ids=None, link=None, forced=None):
    """filter one frame to the nominees, push amount, date and zip to the accumulator"""
    acc.stats["rows_read"] += len(df)
    df = unpivot_multi(df)
    roles = detect(list(df.columns))
    if "_AMT" in df.columns: roles["amount"], roles["date"] = "_AMT", "_DATE"
    for need in ("amount", "date", "zip"):
        if need not in roles:
            acc.notes.append(f"no {need} column among: {', '.join(map(str, df.columns[:40]))}"); return
    if forced is not None:
        nom = pd.Series(forced, index=df.index); recip = pd.Series(f"drop file ({noms[forced]['name']})", index=df.index)
    elif ids is not None and link:
        lc = next((c for c in df.columns if norm(c) == norm(link)), None)
        if lc is None: acc.notes.append(f"link column {link} missing"); return
        nom = df[lc].astype(str).str.strip().map(ids).fillna(-1).astype(int); recip = df[lc]
    else:
        idmap = {str(i): k for k, n in enumerate(noms) for i in n.get("ids") or []}
        nom = pd.Series(-1, index=df.index)
        if idmap and roles.get("rid"): nom = df[roles["rid"]].astype(str).str.strip().map(idmap).fillna(-1).astype(int)
        if roles["names"]:
            txt = df[roles["names"]].fillna("").astype(str).agg(" | ".join, axis=1)
            byname = match_names(txt, noms).where(office_ok(df, roles["offices"]), -1)
            nom = nom.where(nom >= 0, byname)
            recip = df[roles["names"][0]]
        else:
            recip = df[roles["rid"]] if roles.get("rid") else None
            if not idmap: acc.notes.append("no committee or candidate name column and no ids; add ids in gov_sources.json"); return
    sel = nom >= 0
    if not sel.any(): return
    df = apply_rules(df[sel], cfg, roles, acc); nom = nom[df.index]
    acc.stats["rows_matched"] += len(df)
    acc.add(nom, to_amt(df[roles["amount"]]), to_date(df[roles["date"]]), df[roles["zip"]], None if recip is None else recip[df.index])


def filer_ids(cfg, noms, files):
    """read the filer table, match nominees there (office must say governor when the table has an office column)"""
    f = cfg["filer"]; ids = {}; names = defaultdict(set)
    for path in files:
        for df in frames(path, f.get("members"), f.get("columns")):
            roles = detect(list(df.columns))
            idc = next((c for c in df.columns if norm(c) == norm(f["id"])), None)
            if idc is None or not roles["names"]: log("  filer table without id or name columns:", list(df.columns)[:20]); continue
            txt = df[roles["names"]].fillna("").astype(str).agg(" | ".join, axis=1)
            m = match_names(txt, noms).where(office_ok(df, roles["offices"]), -1)
            explicit = {str(i): k for k, n in enumerate(noms) for i in n.get("ids") or []}
            for i, k, t in zip(df[idc].astype(str).str.strip(), m, txt):
                if i in explicit: ids[i] = explicit[i]; names[explicit[i]].add(t[:90])
                elif k >= 0 and i not in ids: ids[i] = int(k); names[int(k)].add(t[:90])
    for k, v in names.items(): log(f"  filer match {noms[k]['name']}: {sorted(v)[:6]}")
    return ids


def run_table(st, cy, cfg, noms, acc):
    srcs = cfg.get("sources", {}).get(str(cy), [])
    got = []
    for s in srcs:
        try: got.append((s, fetch(s["url"])))
        except Exception as e: acc.notes.append(f"download failed {s['url']}: {e}"); log("  download failed:", s["url"], e)
    ids = None
    if cfg.get("filer"):
        f = cfg["filer"]; fpaths = []
        if f.get("url"):
            try: fpaths.append(fetch(f["url"]))
            except Exception as e: acc.notes.append(f"filer download failed: {e}")
        fpaths += [p for _, p in got]
        fpaths += [os.path.join(drop_dir(st, cy), x) for x in sorted(os.listdir(drop_dir(st, cy)))] if os.path.isdir(drop_dir(st, cy)) else []
        ids = filer_ids(cfg, noms, fpaths)
        if not ids: acc.notes.append("no filer matched a nominee; add ids in gov_sources.json")
    for s, p in got:
        acc.sources.append(s["url"])
        for df in frames(p, s.get("members"), s.get("columns")):
            take(df, cfg, noms, acc, ids, (cfg.get("filer") or {}).get("link"))
    run_drop(st, cy, cfg, noms, acc, ids)


def run_drop(st, cy, cfg, noms, acc, ids=None):
    d = drop_dir(st, cy)
    if not os.path.isdir(d): return
    for fn in sorted(os.listdir(d)):
        p = os.path.join(d, fn)
        if os.path.isdir(p) or fn.endswith("_x"): continue
        if cfg.get("filer") and re.search(cfg["filer"].get("members") or "^$", fn, re.I): continue
        m = re.match(r"([DRIOL])[_\-. ]", fn, re.I)
        forced = None
        if m:
            want = {"D": "D", "R": "R"}.get(m.group(1).upper(), "O")
            forced = next((i for i, n in enumerate(noms) if n["party"] == want), None)
            if forced is None: acc.notes.append(f"{fn}: no {want} nominee in the registry"); continue
        acc.sources.append(f"drop/{fn}")
        log("  drop file", fn, "credited to " + noms[forced]["name"] if forced is not None else "matched by name")
        for df in frames(p):
            take(df, cfg, noms, acc, ids if forced is None else None, (cfg.get("filer") or {}).get("link") if forced is None else None, forced)


def run_socrata(st, cy, cfg, noms, acc):
    for s in cfg["sources"][str(cy)]:
        where = f"({s['where']}) AND sched_date between '{cy - 1}-01-01T00:00:00' and '{cy}-12-31T23:59:59'"
        cache = os.path.join(DL, f"{st}_{cy}_socrata.csv")
        if not (os.path.exists(cache) and os.path.getsize(cache) > 0):
            parts = []; off = 0
            while True:
                q = urllib.parse.urlencode({"$where": where, "$limit": 50000, "$offset": off, "$order": ":id"})
                req = urllib.request.Request(f"{s['url']}?{q}", headers=UA)
                try:
                    with urllib.request.urlopen(req, timeout=180) as r: txt = r.read().decode("utf-8", "replace")
                except urllib.error.HTTPError as e:
                    acc.notes.append(f"socrata error {e.code}: {e.read()[:300]!r}"); log("  socrata error", e.code); return
                df = pd.read_csv(io.StringIO(txt), dtype=str, keep_default_na=False)
                parts.append(df); off += len(df); log(f"  {off:,} rows")
                if len(df) < 50000: break
            pd.concat(parts, ignore_index=True).to_csv(cache, index=False)
        acc.sources.append(s["url"] + " where " + where)
        for df in frames(cache): take(df, cfg, noms, acc)
    run_drop(st, cy, cfg, noms, acc)


def run_calaccess(st, cy, cfg, noms, acc):
    p = fetch(cfg["sources"][str(cy)][0]["url"]); z = zipfile.ZipFile(p)
    mem = {os.path.basename(m).upper(): m for m in z.namelist()}

    def tsv(name, cols=None):
        return pd.read_csv(z.open(mem[name]), sep="\t", dtype=str, quoting=csv.QUOTE_NONE, encoding="latin-1", on_bad_lines="skip", usecols=cols, chunksize=A.chunk, keep_default_na=False)
    explicit = {str(i): k for k, n in enumerate(noms) for i in n.get("ids") or []}
    fid = dict(explicit)
    for df in tsv("FILERNAME_CD.TSV"):
        nm = (df.get("NAML", "") + " " + df.get("NAMF", "")).fillna("")
        m = match_names(nm, noms).where(nm.str.contains("GOV", case=False), -1)
        for i, k in zip(df["FILER_ID"].str.strip(), m):
            if k >= 0 and i not in fid: fid[i] = int(k)
    log(f"  {len(fid)} CAL-ACCESS filer ids matched")
    filing, f2f = {}, {}
    for df in tsv("FILER_FILINGS_CD.TSV", ["FILER_ID", "FILING_ID"]):
        df = df[df.FILER_ID.str.strip().isin(fid)]
        for a, b in zip(df.FILING_ID.str.strip(), df.FILER_ID.str.strip()): filing[a] = fid[b]; f2f[a] = b
    keep = []
    for df in tsv("RCPT_CD.TSV"):
        acc.stats["rows_read"] += len(df)
        df = df[df.FILING_ID.str.strip().isin(filing) & (df.FORM_TYPE.str.strip() == "A")]
        if len(df): keep.append(df)
    if not keep: acc.notes.append("no Schedule A rows for the matched filers"); return
    R = pd.concat(keep, ignore_index=True)
    R["AMEND_ID"] = pd.to_numeric(R.AMEND_ID, errors="coerce").fillna(0)
    R = R[R.AMEND_ID == R.groupby("FILING_ID").AMEND_ID.transform("max")]
    acc.stats["rows_matched"] += len(R)
    ind = R.ENTITY_CD.str.strip() == "IND"; acc.stats["dropped_not_individual"] += float((~ind).sum()); R = R[ind]
    nom = R.FILING_ID.str.strip().map(filing).astype(int)
    acc.sources.append(cfg["sources"][str(cy)][0]["url"])
    acc.add(nom, to_amt(R.AMOUNT), to_date(R.RCPT_DATE), R.CTRIB_ZIP4, "filer " + R.FILING_ID.str.strip().map(f2f).fillna(""))
    run_drop(st, cy, cfg, noms, acc)


def finish(st, cy, cfg, noms, acc):
    if not acc.rows: log(f"{st} {cy}: nothing matched"); return None
    D = pd.concat(acc.rows, ignore_index=True)
    lo, sep, hi = pd.Timestamp(f"{cy - 1}-01-01"), pd.Timestamp(f"{cy}-09-30"), pd.Timestamp(f"{cy}-12-31")
    acc.stats["dropped_bad_amount_or_date"] = float((D.amt.isna() | D.dt.isna()).sum())
    D = D[D.amt.notna() & D.dt.notna()]
    acc.stats["dropped_outside_window"] = float(((D.dt < lo) | (D.dt > hi)).sum())
    D = D[(D.dt >= lo) & (D.dt <= hi)].copy()
    a = D.amt.abs(); D["band"] = (a >= 200).astype(int) + (a >= 1000).astype(int) + (a >= 2500).astype(int)
    D["cnt"] = (D.amt > 0).astype(int); D["sep"] = D.dt <= sep
    D["p"] = D.nom.map({i: n["party"] for i, n in enumerate(noms)})
    X = xwalk(); M = D.merge(X, on="zip", how="left")
    acc.stats["unmatched_zip_usd"] = round(float(M[M.fips.isna()].amt.sum())); acc.stats["matched_usd"] = round(float(M[M.fips.notna()].amt.sum()))
    M = M[M.fips.notna()].copy(); M["usd"] = M.amt * M.w; M["n"] = M.cnt * M.w
    home = STFIPS[st]
    out_n = []
    for i, n in enumerate(noms):
        s = D[D.nom == i]; mm = M[M.nom == i]; row = {"name": n["name"], "party": n["party"]}
        for w in ("full", "sep30"):
            t = s if w == "full" else s[s.sep]
            b = t.groupby("band").agg(usd=("amt", "sum"), n=("cnt", "sum")).reindex(range(4), fill_value=0)
            row[w] = {"usd": round(float(t.amt.sum())), "n": int(t.cnt.sum()), "bands_usd": [round(float(x)) for x in b.usd], "bands_n": [int(x) for x in b.n]}
        tot = float(mm.usd.sum()); row["home_state_share"] = round(float(mm[mm.fips.str[:2] == home].usd.sum()) / tot, 4) if tot > 0 else None
        row["recipients"] = {k: round(float(v)) for k, v in s.groupby("r").amt.sum().sort_values(ascending=False).head(12).items() if k}
        out_n.append(row)
    counties = {}
    for w in ("full", "sep30"):
        S = M if w == "full" else M[M.sep]
        g = S.groupby(["fips", "band"])[["usd", "n"]].sum()
        pg = S.groupby(["fips", "p", "band"]).usd.sum()
        for (f, b), r in g.iterrows():
            c = counties.setdefault(f, {}).setdefault(w, {"usd": [0] * 4, "n": [0] * 4, "D": [0] * 4, "R": [0] * 4})
            c["usd"][b] = round(float(r.usd)); c["n"][b] = round(float(r.n))
        for (f, p, b), v in pg.items():
            if p in ("D", "R"): counties[f][w][p][b] = round(float(v))
    res = {"st": st, "cycle": cy, "office": "G", "built": time.strftime("%Y-%m-%dT%H:%M:%S"), "window": [str(lo.date()), str(hi.date())], "sep30": str(sep.date()),
           "adapter": cfg["adapter"], "sources": acc.sources, "individuals_only": bool(cfg.get("keep")) or acc.stats.get("dropped_not_individual", 0) > 0,
           "nominees": out_n, "counties": counties, "stats": {k: round(v) for k, v in acc.stats.items()},
           "unmatched_share": round(acc.stats["unmatched_zip_usd"] / max(1.0, acc.stats["unmatched_zip_usd"] + acc.stats["matched_usd"]), 4),
           "notes": sorted(set(acc.notes)) + ([cfg["notes"]] if cfg.get("notes") else []) + ([cfg["license"]] if cfg.get("license") else [])}
    od = os.path.join(A.out, str(cy)); os.makedirs(od, exist_ok=True)
    json.dump(res, open(os.path.join(od, f"{st}.json"), "w"), separators=(",", ":"))
    log(f"{st} {cy}: " + "; ".join(f"{r['name']} ${r['full']['usd']:,} from {r['full']['n']:,} gifts" for r in out_n) + f"; unmatched ZIP share {res['unmatched_share']}")
    for r in out_n:
        if r["recipients"]: log(f"  credited to {r['name']}: " + "; ".join(f"{k} ${v:,}" for k, v in list(r["recipients"].items())[:5]))
    if res["notes"]: log("  notes: " + " | ".join(res["notes"]))
    return res


def run(st, cy):
    cfg = REG[st]; noms = cfg["nominees"][str(cy)]; acc = Acc()
    if not noms: log(st, cy, "no nominees in the registry"); return
    ad = cfg["adapter"]
    if ad == "manual":
        if not (os.path.isdir(drop_dir(st, cy)) and os.listdir(drop_dir(st, cy))):
            log(f"{st} {cy}: manual state, drop folder empty ({drop_dir(st, cy)}); see --howto {st}"); return
        run_drop(st, cy, cfg, noms, acc)
    elif ad == "socrata": run_socrata(st, cy, cfg, noms, acc)
    elif ad == "calaccess": run_calaccess(st, cy, cfg, noms, acc)
    else: run_table(st, cy, cfg, noms, acc)
    return finish(st, cy, cfg, noms, acc)


# ------------------------------------------------------------- commands
if A.list:
    for st, c in REG.items():
        have = [cy for cy in ("2022", "2026") if os.path.exists(os.path.join(A.out, cy, f"{st}.json"))]
        drops = [cy for cy in ("2022", "2026") if os.path.isdir(drop_dir(st, cy)) and os.listdir(drop_dir(st, cy))]
        print(f"{st}  {c['adapter']:9s}  built: {','.join(have) or 'none':10s}  drop files: {','.join(drops) or 'none':10s}  2026: {' vs '.join(n['name'] for n in c['nominees']['2026'][:2])}")
    sys.exit()
if A.howto:
    c = REG[A.howto.upper()]
    print(f"{A.howto.upper()}  {c['name']}  {c['agency']}\nportal: {c['portal']}\nroute: {c['adapter']}\n\nwhat to do: {c['howto']}\n\nsearch export: {c.get('search_export')}\n\nlimits: {c.get('limits')}")
    for cy in ("2022", "2026"):
        print(f"\n{cy} nominees, save each one's itemized contributions as {drop_dir(A.howto.upper(), cy)}/<party letter>_<anything>.csv")
        for n in c["nominees"][cy]: print(f"  {n['party']}_  {n['name']}" + (f"   ({n['committee_hint']})" if n.get("committee_hint") else ""))
    sys.exit()
if A.probe:
    st = A.probe.upper(); cfg = REG[st]; cy = A.cycle
    paths = []
    for s in cfg.get("sources", {}).get(str(cy), []):
        if cfg["adapter"] == "socrata":
            req = urllib.request.Request(f"{s['url']}?$limit=5", headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r: print(r.read().decode()[:3000])
            continue
        try: paths.append((fetch(s["url"]), s))
        except Exception as e: print("download failed", s["url"], e)
    if os.path.isdir(drop_dir(st, cy)): paths += [(os.path.join(drop_dir(st, cy), f), {}) for f in sorted(os.listdir(drop_dir(st, cy)))]
    if cfg.get("filer", {}).get("url"):
        try: paths.append((fetch(cfg["filer"]["url"]), {"columns": cfg["filer"].get("columns")}))
        except Exception as e: print("filer download failed", e)
    for p, s in paths:
        if cfg["adapter"] == "calaccess": print(zipfile.ZipFile(p).namelist()[:80]); continue
        seen = set()
        for df in frames(p, None, s.get("columns"), chunk=200_000):
            key = tuple(df.columns)
            if key in seen: continue
            seen.add(key)
            print(f"\n== {os.path.basename(p)}: {len(df.columns)} columns\n{list(df.columns)}")
            r = detect(list(df.columns)); print("detected:", {k: v for k, v in r.items()})
            print(df.head(3).to_string()[:1500])
            if r["names"]:
                txt = df[r["names"]].fillna("").astype(str).agg(" | ".join, axis=1)
                m = match_names(txt, cfg["nominees"][str(cy)]).where(office_ok(df, r["offices"]), -1)
                for i, n in enumerate(cfg["nominees"][str(cy)]):
                    print(f"  {n['name']}: {sorted(set(txt[m == i].str[:80]))[:5]}")
            break
    sys.exit()

cycles = [int(x) for x in A.cycles.split(",")]
if A.states == "auto": states = [s for s, c in REG.items() if c["adapter"] != "manual"]
elif A.states == "all": states = list(REG)
else: states = [s.strip().upper() for s in A.states.split(",")]
for cy in cycles:
    for st in states:
        try: run(st, cy)
        except Exception as e:
            log(f"{st} {cy} failed: {type(e).__name__}: {e}")
log("done. Outputs in", A.out)
