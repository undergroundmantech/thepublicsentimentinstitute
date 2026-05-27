#!/usr/bin/env python3
"""
Sweep all polling/results/goldstandard pages and flip dark-theme CSS token
declarations to the v2 light theme. This is conservative: we only rewrite the
TOKEN VALUES of well-known custom properties, so the rest of the markup is
untouched.

The pages declare blocks like:
    .res-page {
        --background:    #0a0a0a;
        --panel:         #0f0f15;
        --panel2:        #141420;
        --foreground:    #f5f5f0;
        --muted:         rgba(255,255,255,0.55);
        --border:        rgba(255,255,255,0.08);
        ...
    }
After this script, those become the v2 light tokens. Most of each page's
visual surface is built from var(--panel) / var(--foreground) / var(--border),
so flipping the tokens flips the whole surface.
"""
import re
from pathlib import Path

# Map: custom property name -> new value (v2 light)
TOKEN_MAP = {
    "--background":   "#f6f7fb",
    "--background2":  "#ffffff",
    "--bg":           "#f6f7fb",
    "--bg2":          "#ffffff",
    "--panel":        "#ffffff",
    "--panel2":       "#fbfbfd",
    "--panel3":       "#f3f4f9",
    "--surface":      "#ffffff",
    "--surface2":     "#fbfbfd",
    "--foreground":   "#0b0d1c",
    "--fg":           "#0b0d1c",
    "--ink":          "#0b0d1c",
    "--text":         "#0b0d1c",
    "--muted":        "#6b7088",
    "--muted2":       "#9aa0b4",
    "--muted3":       "#b7bccc",
    "--border":       "rgba(15, 16, 32, 0.08)",
    "--border2":      "rgba(15, 16, 32, 0.14)",
    "--border3":      "rgba(15, 16, 32, 0.22)",
}

# Regex to match a custom-property declaration line inside a CSS rule.
# Example matches:
#     --panel: #0f0f15;
#     --panel:        #0f0f15;
#     --panel:#0f0f15 ;
TOKEN_RE = re.compile(
    r"(--[a-zA-Z0-9_-]+)\s*:\s*([^;{}]+?)\s*;"
)

def rewrite_tokens(text: str) -> tuple[str, int]:
    count = 0
    def repl(m: re.Match) -> str:
        nonlocal count
        name = m.group(1)
        if name in TOKEN_MAP:
            new_val = TOKEN_MAP[name]
            count += 1
            return f"{name}: {new_val};"
        return m.group(0)
    new_text = TOKEN_RE.sub(repl, text)
    return new_text, count

# Additional safe in-css color replacements (hardcoded dark surfaces / text).
# These run AFTER the token rewrites. They're conservative — limited to values
# that almost certainly indicate dark-theme paint.
HARD_REPLACEMENTS = [
    # Page-level dark backgrounds
    ("background:#0a0a0a",   "background:#f6f7fb"),
    ("background:#0b0b0f",   "background:#ffffff"),
    ("background:#0f0f15",   "background:#ffffff"),
    ("background:#141420",   "background:#fbfbfd"),
    ("background:#0d0d14",   "background:#ffffff"),
    ("background:#070709",   "background:#f6f7fb"),
    ("background: #0a0a0a",  "background: #f6f7fb"),
    ("background: #0b0b0f",  "background: #ffffff"),
    ("background: #0f0f15",  "background: #ffffff"),
    ("background: #141420",  "background: #fbfbfd"),
    ("background: #0d0d14",  "background: #ffffff"),
    ("background: #070709",  "background: #f6f7fb"),
    # Body text on dark
    ("color:#f5f5f0",  "color:#0b0d1c"),
    ("color: #f5f5f0", "color: #0b0d1c"),
    ("color:#f0f0f5",  "color:#0b0d1c"),
    ("color: #f0f0f5", "color: #0b0d1c"),
    ("color:#fefefe",  "color:#0b0d1c"),
    ("color: #fefefe", "color: #0b0d1c"),
    # Borders on dark
    ("rgba(255,255,255,0.06)",  "rgba(15,16,32,0.08)"),
    ("rgba(255,255,255,0.07)",  "rgba(15,16,32,0.08)"),
    ("rgba(255,255,255,0.08)",  "rgba(15,16,32,0.10)"),
    ("rgba(255,255,255,0.09)",  "rgba(15,16,32,0.10)"),
    ("rgba(255,255,255,0.10)",  "rgba(15,16,32,0.12)"),
    ("rgba(255,255,255,0.12)",  "rgba(15,16,32,0.14)"),
    ("rgba(255,255,255,0.14)",  "rgba(15,16,32,0.16)"),
    ("rgba(255,255,255,0.05)",  "rgba(15,16,32,0.06)"),
    ("rgba(255,255,255,0.04)",  "rgba(15,16,32,0.05)"),
    ("rgba(255, 255, 255, 0.06)",  "rgba(15,16,32,0.08)"),
    ("rgba(255, 255, 255, 0.08)",  "rgba(15,16,32,0.10)"),
    ("rgba(255, 255, 255, 0.10)",  "rgba(15,16,32,0.12)"),
    # Muted text on dark → muted on light
    ("rgba(255,255,255,0.85)", "rgba(15,16,32,0.85)"),
    ("rgba(255,255,255,0.80)", "rgba(15,16,32,0.80)"),
    ("rgba(255,255,255,0.75)", "rgba(15,16,32,0.75)"),
    ("rgba(255,255,255,0.70)", "rgba(15,16,32,0.70)"),
    ("rgba(255,255,255,0.65)", "rgba(15,16,32,0.65)"),
    ("rgba(255,255,255,0.60)", "rgba(15,16,32,0.60)"),
    ("rgba(255,255,255,0.55)", "rgba(15,16,32,0.55)"),
    ("rgba(255,255,255,0.50)", "rgba(15,16,32,0.50)"),
    ("rgba(255,255,255,0.45)", "rgba(15,16,32,0.55)"),
    ("rgba(255,255,255,0.40)", "rgba(15,16,32,0.55)"),
    ("rgba(255,255,255,0.38)", "rgba(15,16,32,0.55)"),
    ("rgba(255,255,255,0.35)", "rgba(15,16,32,0.50)"),
    ("rgba(255,255,255,0.30)", "rgba(15,16,32,0.50)"),
    ("rgba(255,255,255,0.28)", "rgba(15,16,32,0.45)"),
    ("rgba(255,255,255,0.25)", "rgba(15,16,32,0.45)"),
    ("rgba(255,255,255,0.22)", "rgba(15,16,32,0.45)"),
    ("rgba(255,255,255,0.20)", "rgba(15,16,32,0.40)"),
    ("rgba(255,255,255,0.18)", "rgba(15,16,32,0.40)"),
    # bg=0 with alpha (page bg overlays)
    ("rgba(0,0,0,0.6)",  "rgba(255,255,255,0.6)"),
    ("rgba(0,0,0,0.5)",  "rgba(255,255,255,0.5)"),
    ("rgba(0,0,0,0.4)",  "rgba(255,255,255,0.4)"),
    ("rgba(0,0,0,0.35)", "rgba(255,255,255,0.35)"),
    ("rgba(0,0,0,0.30)", "rgba(255,255,255,0.30)"),
]

def hard_replace(text: str) -> tuple[str, int]:
    count = 0
    for old, new in HARD_REPLACEMENTS:
        c = text.count(old)
        if c:
            text = text.replace(old, new)
            count += c
    return text, count

ROOTS = [
    Path("app/polling"),
    Path("app/results"),
    Path("app/goldstandard"),
    Path("app/forecastratings"),
    Path("app/electoralmap"),
    Path("app/latestpoll"),
    Path("app/tpsipoll"),
    Path("app/contact"),
    Path("app/SMSOptIn"),
    Path("app/TermsAndConditions"),
]

files = []
for r in ROOTS:
    if not r.exists():
        continue
    files.extend(r.rglob("*.tsx"))

total_token = total_hard = 0
touched = 0
for f in files:
    src = f.read_text()
    new, n1 = rewrite_tokens(src)
    new, n2 = hard_replace(new)
    if new != src:
        f.write_text(new)
        touched += 1
        total_token += n1
        total_hard  += n2
        print(f"  {f}: tokens={n1} hard={n2}")

print(f"\nDone. Files modified: {touched} / {len(files)}")
print(f"Token replacements: {total_token}")
print(f"Hard-coded color replacements: {total_hard}")
