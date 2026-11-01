"use client";

// Appearance selector: Pro Dark, Pro Light or Theme (app/lib/theme.ts).
//  variant "menu"    the masthead icon button. It shows the current mode and opens a three-item menu
//                    (menuitemradio). Arrow keys, Home and End move between items; Escape and Tab close it.
//  variant "inline"  a labelled segmented radio group for the phone menu. Arrow keys move and select, as in any
//                    radio group. Each segment is 44px tall.
// Server and first client render show Pro Dark, the default; the real mode is read from <html data-mode> after mount.
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { getMode, MODE_LABEL, MODE_NOTE, MODES, readStoredMode, setMode, THEME_EVENT, type Mode } from "../lib/theme";
import "./modepicker.css";

function ModeIcon({ mode }: { mode: Mode }) {
  const p = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (mode === "light") return <svg {...p}><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.5 1.5M17.9 17.9l1.5 1.5M2.5 12h2M19.5 12h2M4.6 19.4l1.5-1.5M17.9 6.1l1.5-1.5" /></svg>;
  if (mode === "themed") return <svg {...p}><path d="M12 3.2l1.9 5.4 5.5 1.9-5.5 1.9L12 17.8l-1.9-5.4-5.5-1.9 5.5-1.9z" /><path d="M18.6 15.6l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z" /></svg>;
  return <svg {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>;
}

function useMode(): Mode {
  const [mode, setModeState] = useState<Mode>("dark");
  useEffect(() => {
    // pages rendered on the client, such as a not found page, skip the inline head script, so apply the choice here
    const saved = readStoredMode();
    if (saved && saved !== getMode()) setMode(saved, false);
    const sync = () => setModeState(getMode());
    sync();
    window.addEventListener(THEME_EVENT, sync);
    return () => window.removeEventListener(THEME_EVENT, sync);
  }, []);
  return mode;
}

const step = (m: Mode, by: number) => MODES[(MODES.indexOf(m) + by + MODES.length) % MODES.length];

export default function ThemeToggle({ className = "btn icon", variant = "menu" }: { className?: string; variant?: "menu" | "inline" }) {
  const mode = useMode();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<Partial<Record<Mode, HTMLButtonElement | null>>>({});

  const choose = (m: Mode) => { if (m !== getMode()) setMode(m); };

  useEffect(() => {
    if (!open) return;
    items.current[getMode()]?.focus();
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  if (variant === "inline") {
    const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
      const by = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      if (!by) return;
      e.preventDefault();
      const next = step(mode, by);
      choose(next);
      items.current[next]?.focus();
    };
    return (
      <div className="modep-seg" role="radiogroup" aria-label="Appearance" onKeyDown={onKey}>
        {MODES.map((m) => (
          <button key={m} type="button" role="radio" aria-checked={m === mode} tabIndex={m === mode ? 0 : -1}
            ref={(el) => { items.current[m] = el; }} onClick={() => choose(m)}>
            <ModeIcon mode={m} /><span>{MODE_LABEL[m]}</span>
          </button>
        ))}
      </div>
    );
  }

  const close = () => { setOpen(false); trigger.current?.focus(); };
  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const at = MODES.find((m) => items.current[m] === document.activeElement) ?? mode;
    const go = (m: Mode) => { e.preventDefault(); items.current[m]?.focus(); };
    if (e.key === "ArrowDown") go(step(at, 1));
    else if (e.key === "ArrowUp") go(step(at, -1));
    else if (e.key === "Home") go(MODES[0]);
    else if (e.key === "End") go(MODES[MODES.length - 1]);
    else if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "Tab") close(); // focus returns to the button first, so Tab carries on from there
  };
  return (
    <div className="modep" ref={box}>
      <button type="button" ref={trigger} className={className} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? "opp-modep" : undefined}
        aria-label={`Appearance: ${MODE_LABEL[mode]}. Change appearance`} title={`Appearance: ${MODE_LABEL[mode]}`}
        onClick={() => setOpen((o) => !o)}>
        <ModeIcon mode={mode} />
      </button>
      {open ? (
        <div className="modep-pop" id="opp-modep" role="menu" aria-label="Appearance" onKeyDown={onMenuKey}>
          {MODES.map((m) => (
            <button key={m} type="button" role="menuitemradio" aria-checked={m === mode} tabIndex={-1}
              ref={(el) => { items.current[m] = el; }} onClick={() => { choose(m); close(); }}>
              <ModeIcon mode={m} />
              <span className="t"><b>{MODE_LABEL[m]}</b><small>{MODE_NOTE[m]}</small></span>
              <i className="ck" aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
