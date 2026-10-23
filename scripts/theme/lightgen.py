#!/usr/bin/env python3
"""Generate light theme overrides for CSS written dark first.

For every declaration whose value holds a dark only literal colour, emit
html[data-theme="light"] <selector> { prop: mapped } with the colour mapped to its light counterpart.
Usage: lightgen.py out.css in1.css [in2.css ...]

Watchdog, from app/watchdog:
  python3 ../../scripts/theme/lightgen.py light.gen.css watchdog.css terminal.css desk.css trail.css \
    connections/connections.css counties/counties.css endorsements/endorse.css ledger/ledger.css \
    media/media.css money/money.css paid/paid.css
Every colour declaration is copied under the light prefix, mapped where it holds a dark only literal and kept
as written otherwise, so the copies win over the originals in exactly the order the originals win over each other.
Hand tuned light rules live beside it in light.css, which loads after the generated file.
"""
import re, sys

RGBA = re.compile(r"rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)")
HEX = re.compile(r"#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b")

def lum(r, g, b):
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255

# explicit hex maps: light pastel text and accents that only read on dark
HEXMAP = {
    "ffd98a": "#9a6a06", "ffe2a0": "#a87410", "ffe2a3": "#6b4a00", "ffe7b0": "#6b4a00", "e9e2ff": "#3a2f5c",
    "8fb0ff": "#2a63f0", "6b93ff": "#2a63f0", "ff8399": "#e8264b", "c9a8ff": "#7c3aed", "b78cff": "#7c3aed",
    "d8d0ea": "#3a3350", "c9c2d6": "#4a4360", "cfc7e2": "#3a3350", "c9c1dc": "#3a3350", "a79fbd": "#6b6384", "8e86a3": "#6b6384",
    "d8ffe9": "#0b2a1b", "9fd8b8": "#2f5a45", "5f9b7b": "#5f7f6f", "eafff3": "#062014", "39ff9c": "#0a8a4c", "a6ffd2": "#0f6b3e",
    "9fe3c1": "#0f8a55", "3fd07a": "#12924f", "8fe0a8": "#0f7a45", "021108": "#ffffff", "04361d": "#d9f5e6",
    "0a0711": "#ffffff", "07050f": "#f5f3fa", "120820": "#ece8f6", "2a1d08": "#fff3d6", "121212": "#121212", "f4c430": "#f4c430",
    "d6e2ff": "#2a63f0", "ffdce4": "#e8264b", "ff9a5c": "#d0561c", "ffb547": "#a66300", "ff4d5e": "#d61f3c",
}

def map_color(r, g, b, a, prop, val):
    """Return the light replacement for one rgba colour, or None to keep it."""
    key = "%02x%02x%02x" % (r, g, b)
    if a is None:
        a = 1.0
    is_bg = prop.startswith("background") or prop in ("fill",)
    is_text = prop in ("color", "-webkit-text-fill-color", "caret-color")
    sheen = "transparent" in val and prop.startswith("background")
    if key in HEXMAP and a >= 0.99:
        return HEXMAP[key]
    if (r, g, b) == (255, 255, 255):
        if is_text:
            return "var(--ink)" if a > 0.8 else "rgba(17,0,25,%.2f)" % min(1, a + 0.1)
        if sheen:
            return "rgba(255,255,255,%.2f)" % min(0.75, a * 3 + 0.2)
        if prop.startswith("box-shadow") or prop.startswith("text-shadow") or prop == "filter":
            return "rgba(40,20,80,%.2f)" % min(0.4, a * 0.6)
        if a > 0.8:
            return "#110019" if prop in ("stroke", "outline", "outline-color", "border-color", "border") else None
        return "rgba(17,0,25,%.3f)" % min(0.5, a * 1.1)
    if (r, g, b) == (0, 0, 0):
        if prop.startswith("box-shadow") or prop == "filter" or prop.startswith("text-shadow"):
            return "rgba(40,20,80,%.2f)" % min(0.35, a * 0.5)
        if prop.startswith("background"):
            return "rgba(255,255,255,%.2f)" % a
        return None
    if lum(r, g, b) < 0.09:  # near black panels and outlines
        if prop.startswith("box-shadow") or prop.startswith("text-shadow"):
            return "rgba(40,20,80,%.2f)" % min(0.35, a * 0.5)
        if prop in ("stroke",) or prop.startswith("border") or prop.startswith("outline"):
            return "rgba(255,255,255,%.2f)" % max(0.85, a)
        if is_text:
            return None
        return "rgba(255,255,255,%.2f)" % max(0.82, a) if a > 0.5 else "rgba(255,255,255,%.2f)" % a
    if (r, g, b) in ((255, 217, 138), (255, 226, 160)):
        return "rgba(176,122,0,%.2f)" % a if a < 0.99 else "#9a6a06"
    if (r, g, b) == (57, 255, 156):
        return "rgba(8,140,76,%.2f)" % min(1, a * 1.15)
    if (r, g, b) in ((143, 176, 255),):
        return "rgba(42,99,240,%.2f)" % a
    if (r, g, b) in ((255, 131, 153),):
        return "rgba(232,38,75,%.2f)" % a
    if key in HEXMAP:
        hx = HEXMAP[key].lstrip("#")
        return "rgba(%d,%d,%d,%.2f)" % (int(hx[0:2], 16), int(hx[2:4], 16), int(hx[4:6], 16), a)
    return None

def to_rgb(h):
    h = h.lower()
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)

def convert(prop, val):
    changed = False
    def rr(m):
        nonlocal changed
        r, g, b = int(m.group(1)), int(m.group(2)), int(m.group(3))
        a = float(m.group(4)) if m.group(4) else None
        out = map_color(r, g, b, a, prop, val)
        if out is None:
            return m.group(0)
        changed = True
        return out
    def hr(m):
        nonlocal changed
        r, g, b = to_rgb(m.group(1))
        out = map_color(r, g, b, None, prop, val)
        if out is None:
            return m.group(0)
        changed = True
        return out
    v2 = RGBA.sub(rr, val)
    v2 = HEX.sub(hr, v2)
    return v2 if changed else None

def strip_comments(s):
    return re.sub(r"/\*.*?\*/", "", s, flags=re.S)

COLORPROP = re.compile(r"^(color|background(-color|-image)?|border(-top|-right|-bottom|-left)?(-color)?|outline(-color)?|box-shadow|text-shadow|fill|stroke|filter|-webkit-text-fill-color|caret-color|accent-color)$")
def parse(s, out, wrap=None):
    i = 0
    n = len(s)
    while i < n:
        j = s.find("{", i)
        if j < 0:
            break
        sel = s[i:j].strip()
        # find matching brace
        depth, k = 1, j + 1
        while k < n and depth:
            if s[k] == "{": depth += 1
            elif s[k] == "}": depth -= 1
            k += 1
        body = s[j + 1:k - 1]
        i = k
        if sel.startswith("@media") or sel.startswith("@supports"):
            parse(body, out, sel)
            continue
        if sel.startswith("@"):
            continue  # keyframes, property, font-face
        decls = []
        for d in re.split(r";(?![^(]*\))", body):
            if ":" not in d:
                continue
            p, v = d.split(":", 1)
            p = p.strip().lower(); v = v.strip()
            if not p or p.startswith("--"):
                continue
            if not COLORPROP.match(p):
                continue
            nv = convert(p, v)
            decls.append((p, nv or v, bool(nv)))
        # every colour declaration is copied, mapped or not, so the copies keep the cascade of the originals
        if not decls:
            continue
        decls = ["%s: %s" % (p, v) for p, v, _ in decls]
        sels = []
        for one in re.split(r",(?![^(]*\))", sel):
            one = one.strip()
            if not one:
                continue
            if one.startswith(":root") or one.startswith("html"):
                continue
            sels.append('html[data-theme="light"] ' + one)
        if not sels:
            continue
        rule = "%s { %s; }" % (", ".join(sels), "; ".join(decls))
        out.append((wrap, rule))

def main():
    dst, srcs = sys.argv[1], sys.argv[2:]
    rules = []
    for f in srcs:
        rules.append((None, "/* from %s */" % f.split("/app/")[-1]))
        parse(strip_comments(open(f).read()), rules)
    lines = ["/* Light theme overrides, generated by scripts/theme/lightgen.py from the dark first stylesheets listed below. Edit those, then regenerate. */"]
    for wrap, r in rules:
        lines.append("%s { %s }" % (wrap, r) if wrap else r)
    open(dst, "w").write("\n".join(lines) + "\n")
    print(dst, len(rules))

main()
