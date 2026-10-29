"""Minimal xlsx reader (zipfile + xml only; no third-party dependency). Returns sheets as lists of row lists of strings."""
import re, zipfile, xml.etree.ElementTree as ET

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def _col(ref):
    letters = re.match(r"[A-Z]+", ref).group(0)
    n = 0
    for ch in letters:
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def read_xlsx(path):
    z = zipfile.ZipFile(path)
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
        for si in root.findall("m:si", NS):
            shared.append("".join(t.text or "" for t in si.iter("{%s}t" % NS["m"])))
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    target = {r.get("Id"): r.get("Target") for r in rels}
    out = {}
    for s in wb.find("m:sheets", NS):
        rid = s.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
        t = target[rid]
        t = t if t.startswith("xl/") else "xl/" + t.lstrip("/")
        root = ET.fromstring(z.read(t))
        rows = []
        for row in root.iter("{%s}row" % NS["m"]):
            cells = {}
            for c in row.findall("m:c", NS):
                v = c.find("m:v", NS)
                if c.get("t") == "inlineStr":
                    val = "".join(x.text or "" for x in c.iter("{%s}t" % NS["m"]))
                elif v is None or v.text is None:
                    val = ""
                elif c.get("t") == "s":
                    val = shared[int(v.text)]
                else:
                    val = v.text
                cells[_col(c.get("r"))] = val
            if cells:
                rows.append([cells.get(i, "") for i in range(max(cells) + 1)])
        out[s.get("name")] = rows
    return out
