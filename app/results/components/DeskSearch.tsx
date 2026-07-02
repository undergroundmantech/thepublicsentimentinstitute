"use client";

import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
// Reuse the EXACT pure search layer the command palette uses — one index,
// fuzzy matcher, suggestions. Only the presentation here is house-styled.
import {
  useElectionIndex,
  searchElections,
  getSuggestions,
} from "../onpoint/lib/electionIndex.js";
import { candColor } from "../onpoint/electionLib.js";

type Doc = {
  id: number;
  race: any;
  contest?: string;
  title?: string;
  office?: string;
  province?: string;
  stateName?: string;
  date?: string;
  reporting?: number;
  hasResult?: boolean;
  leader?: { cand?: { name?: string; party?: string } } | null;
};

function fmtDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
const surname = (n?: string) => (n ? n.trim().split(/\s+/).pop() : "");
const partyLetter = (cand: any) => {
  const p = String(cand?.party || "").toLowerCase();
  if (/democr/.test(p)) return "D";
  if (/republic|gop/.test(p)) return "R";
  if (/independ/.test(p)) return "I";
  return "";
};

// wrap the query's matched substrings in the contest name — the panel answers
// the query visibly instead of listing lookalike rows
function highlight(text: string, q: string): React.ReactNode {
  const t = String(text || "");
  const toks = q.toLowerCase().split(/\s+/).filter((x) => x.length >= 2);
  if (!toks.length) return t;
  const lower = t.toLowerCase();
  const ranges: [number, number][] = [];
  for (const tok of toks) {
    const at = lower.indexOf(tok);
    if (at >= 0) ranges.push([at, at + tok.length]);
  }
  if (!ranges.length) return t;
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  const out: React.ReactNode[] = [];
  let pos = 0;
  merged.forEach(([s, e], k) => {
    if (s > pos) out.push(t.slice(pos, s));
    out.push(<mark key={k} className="desk-hl">{t.slice(s, e)}</mark>);
    pos = e;
  });
  if (pos < t.length) out.push(t.slice(pos));
  return out;
}

function Row({
  doc,
  query,
  active,
  onPick,
  onHover,
}: {
  doc: Doc;
  query: string;
  active: boolean;
  onPick: () => void;
  onHover: () => void;
}) {
  const cand = doc.hasResult ? doc.leader?.cand : null;
  const col = cand ? candColor(cand) : null;
  const lead = Number((doc.leader as any)?.lead) || 0;
  const margin = cand
    ? lead >= 100
      ? "unopp."
      : `${partyLetter(cand) ? partyLetter(cand) + "+" : "+"}${lead < 10 ? lead.toFixed(1) : Math.round(lead)}`
    : "";
  const meta = [doc.office, doc.date ? fmtDate(doc.date) : ""].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onMouseEnter={onHover}
      onClick={onPick}
      className="desk-srow"
      data-active={active ? "1" : undefined}
    >
      <span className="desk-srow-tick" aria-hidden style={{ background: col || "rgba(244,244,239,0.16)" }} />
      <span className="desk-srow-st">{doc.province || "—"}</span>
      <span className="desk-srow-main">
        <span className="desk-srow-title">{highlight(doc.contest || doc.title || "", query)}</span>
        <span className="desk-srow-meta">{meta}</span>
      </span>
      <span className="desk-srow-right">
        {cand ? (
          <>
            <b style={{ color: col || undefined }}>{surname(cand.name)} {margin}</b>
            <span>{Math.round(doc.reporting || 0)}% in</span>
          </>
        ) : (
          <span className="desk-srow-await">awaiting returns</span>
        )}
      </span>
    </button>
  );
}

export default function DeskSearch({
  active,
  onPick,
  inputRef,
  variant = "hero",
}: {
  /** Warm the index when true (e.g. hero in view). */
  active: boolean;
  onPick: (doc: Doc) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  variant?: "hero" | "pill";
}) {
  const { index, error } = useElectionIndex(active) as { index: any; error: boolean };
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const localRef = useRef<HTMLInputElement | null>(null);
  const ref = inputRef || localRef;
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const dq = useDeferredValue(query);


  const results: Doc[] = useMemo(() => {
    if (!index) return [];
    return dq.trim() ? (searchElections(index, dq, 6) as Doc[]) : (getSuggestions(index, 6) as Doc[]);
  }, [index, dq]);

  useEffect(() => setCursor(0), [dq, open]);

  // Global hotkeys: "/" and ⌘K focus the box (do not open the modal).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable;
      if ((e.key === "/" && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        ref.current?.focus();
        ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ref]);

  // Click-away closes the dropdown.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  const choose = (doc?: Doc) => {
    const d = doc || results[cursor];
    if (d) {
      setOpen(false);
      onPick(d);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setCursor((c) => Math.min(c + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose();
    } else if (e.key === "Escape") {
      if (query) setQuery("");
      else (e.target as HTMLInputElement).blur();
      setOpen(false);
    }
  };

  const showList = open && (results.length > 0 || (!!dq.trim() && !!index));

  return (
    <div ref={wrapRef} className={`desk-search ${variant}`} style={{ position: "relative" }}>
      <div className="desk-search-field">
        <svg className="desk-search-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          ref={ref}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={variant === "pill" ? "Search any race…" : "Search any race — a state, an office, a candidate…"}
          aria-label="Search any race"
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={showList}
        />
        <kbd className="desk-search-kbd" aria-hidden>
          {typeof navigator !== "undefined" && /Mac/.test(navigator.platform) ? "⌘K" : "Ctrl K"}
        </kbd>
      </div>

      {showList ? (
        <div className="desk-search-pop" role="listbox">
          <div className="desk-spop-h" aria-hidden>
            <span>{dq.trim() ? `${results.length} match${results.length === 1 ? "" : "es"}` : "latest boards"}</span>
            <span>{index ? `${index.count.toLocaleString("en-US")} contests` : "loading the season…"}</span>
          </div>
          {results.length === 0 ? (
            <div className="desk-search-empty">
              {error ? "couldn’t load the season index — retry in a moment." : (
                <>no matches on <b>“{dq.trim()}”</b> — try a state, an office, or a candidate.</>
              )}
            </div>
          ) : (
            results.map((doc, i) => (
              <Row
                key={doc.id ?? i}
                doc={doc}
                query={dq}
                active={i === cursor}
                onPick={() => choose(doc)}
                onHover={() => setCursor(i)}
              />
            ))
          )}
          <div className="desk-search-foot">
            <span>{dq.trim() ? "every contest of the 2026 season" : "tonight’s boards"}</span>
            <span className="desk-search-keys" aria-hidden>↑↓ move · ↵ open</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
