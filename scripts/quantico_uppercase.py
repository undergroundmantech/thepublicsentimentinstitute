#!/usr/bin/env python3
"""
Force uppercase wherever Quantico (display font) is used.

Targets:
  CSS-in-JS / CSS class rules:
    font-family: var(--font-display), ...;
    font-family: "Quantico", ...;
  → inject `text-transform: uppercase;` immediately after, if not already present
    in the same declaration block.

  Inline React style objects:
    fontFamily: "var(--font-display)..."  (or font.display)
  → add `textTransform: "uppercase"` if not present in the same object literal.
"""
from __future__ import annotations
import re
from pathlib import Path

ROOT = Path("/workspaces/thepublicsentimentinstitute/app")

# ---------- CSS rule pass ----------
# Match a font-family declaration mentioning --font-display or "Quantico".
CSS_FF_RE = re.compile(
    r"(font-family\s*:\s*[^;]*?(?:--font-display|Quantico)[^;]*;)",
    re.IGNORECASE,
)

def patch_css_block(text: str) -> tuple[str, int]:
    """For each font-family decl referencing Quantico, if the surrounding
    declaration block (between { and }) doesn't already contain text-transform,
    insert `text-transform: uppercase;` right after the font-family decl."""
    count = 0
    out = []
    i = 0
    for m in CSS_FF_RE.finditer(text):
        # Find enclosing block { ... } for this match
        # Scan backwards for nearest '{' that isn't matched by a later '}'
        depth = 0
        block_start = -1
        for j in range(m.start() - 1, -1, -1):
            ch = text[j]
            if ch == "}":
                depth += 1
            elif ch == "{":
                if depth == 0:
                    block_start = j
                    break
                depth -= 1
        block_end = -1
        depth = 0
        for j in range(m.end(), len(text)):
            ch = text[j]
            if ch == "{":
                depth += 1
            elif ch == "}":
                if depth == 0:
                    block_end = j
                    break
                depth -= 1
        if block_start == -1 or block_end == -1:
            continue
        block = text[block_start:block_end]
        if "text-transform" in block.lower():
            continue
        # Insert right after the matched font-family declaration
        out.append((m.end(), " text-transform: uppercase;"))
        count += 1

    if not out:
        return text, 0
    # Apply insertions from end → start
    out.sort(reverse=True)
    new = text
    for pos, ins in out:
        new = new[:pos] + ins + new[pos:]
    return new, count


# ---------- Inline JSX style pass ----------
# Match: { ...  fontFamily: "...display..." or font.display, ... }
# We rewrite by adding textTransform: "uppercase" to the object if missing.
JSX_FF_RE = re.compile(
    r"(\{[^{}]*?fontFamily\s*:\s*(?:\"[^\"]*?(?:--font-display|Quantico|display)[^\"]*?\"|font\.display)[^{}]*?\})",
    re.DOTALL,
)

def patch_jsx(text: str) -> tuple[str, int]:
    count = 0
    def repl(m: re.Match[str]) -> str:
        nonlocal count
        block = m.group(1)
        if "textTransform" in block:
            return block
        # Insert textTransform after fontFamily entry
        new_block = re.sub(
            r"(fontFamily\s*:\s*(?:\"[^\"]*\"|font\.display))(\s*,?)",
            r'\1, textTransform: "uppercase"\2',
            block,
            count=1,
        )
        if new_block != block:
            count += 1
        return new_block
    new = JSX_FF_RE.sub(repl, text)
    return new, count


def main() -> None:
    total_css = 0
    total_jsx = 0
    files_touched = 0
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix not in {".tsx", ".ts", ".css"}:
            continue
        if "/node_modules/" in str(path):
            continue
        original = path.read_text(encoding="utf-8")
        new, c1 = patch_css_block(original)
        new, c2 = patch_jsx(new)
        if new != original:
            path.write_text(new, encoding="utf-8")
            files_touched += 1
            total_css += c1
            total_jsx += c2
            print(f"  {path.relative_to(ROOT.parent)}  css+{c1}  jsx+{c2}")
    print(f"\nFiles touched: {files_touched}")
    print(f"CSS insertions: {total_css}")
    print(f"JSX insertions: {total_jsx}")


if __name__ == "__main__":
    main()
