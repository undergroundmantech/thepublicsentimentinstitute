"use client";
// Read the site in another language. Picking one loads Google's page translator only then, so readers who stay in
// English never download it, and remembers the choice in the googtrans cookie the translator reads on every page.
// Google's own bar and popups are hidden; the picker is the only control. English reloads the page untranslated.
// Translating rewrites text nodes under React, so while a translation is on, removeChild and insertBefore are made
// tolerant of nodes the translator moved, the standard fix for React pages under Google Translate.
import { useEffect, useRef, useState } from "react";
import { ev } from "@/app/lib/ev";
import "./langpicker.css";

export const LANGS: [string, string, string][] = [
  ["en", "English", "English"], ["es", "Español", "Spanish"], ["zh-CN", "中文 简体", "Chinese, simplified"], ["zh-TW", "中文 繁體", "Chinese, traditional"],
  ["vi", "Tiếng Việt", "Vietnamese"], ["tl", "Tagalog", "Tagalog"], ["ko", "한국어", "Korean"], ["ht", "Kreyòl ayisyen", "Haitian Creole"],
  ["fr", "Français", "French"], ["pt", "Português", "Portuguese"], ["ar", "العربية", "Arabic"], ["ru", "Русский", "Russian"],
  ["uk", "Українська", "Ukrainian"], ["pl", "Polski", "Polish"], ["de", "Deutsch", "German"], ["it", "Italiano", "Italian"],
  ["ja", "日本語", "Japanese"], ["hi", "हिन्दी", "Hindi"], ["bn", "বাংলা", "Bengali"], ["pa", "ਪੰਜਾਬੀ", "Punjabi"],
  ["ur", "اردو", "Urdu"], ["fa", "فارسی", "Persian"], ["iw", "עברית", "Hebrew"], ["el", "Ελληνικά", "Greek"],
];
const CODES = LANGS.map((l) => l[0]).filter((c) => c !== "en");
const EVENT = "opp:lang";

function readLang(): string {
  try { const m = document.cookie.match(/(?:^|;\s*)googtrans=([^;]+)/); if (m) { const to = decodeURIComponent(m[1]).split("/")[2]; if (to && to !== "en" && CODES.includes(to)) return to; } } catch { /* no cookies */ }
  return "en";
}
function writeCookie(code: string | null) {
  const host = location.hostname; const parts = host.split("."); const root = parts.length > 2 ? "." + parts.slice(-2).join(".") : host.includes(".") ? "." + host : "";
  const set = (v: string, extra: string) => { document.cookie = `googtrans=${v}; path=/${extra}`; };
  for (const dom of ["", root ? `; domain=${root}` : ""].filter((d, i) => i === 0 || d)) {
    if (code) set(`/en/${code}`, `; max-age=31536000; SameSite=Lax${dom}`);
    else set("", `; max-age=0${dom}`);
  }
}

let patched = false;
function patchDom() {
  if (patched || typeof Node === "undefined") return; patched = true;
  const rc = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) return child;
    return rc.call(this, child) as T;
  };
  const ib = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
    if (ref && ref.parentNode !== this) return ib.call(this, node, null) as T;
    return ib.call(this, node, ref) as T;
  };
}

let loading: Promise<void> | null = null;
function loadTranslator(): Promise<void> {
  if (loading) return loading;
  patchDom();
  loading = new Promise((res) => {
    const w = window as unknown as { google?: { translate?: { TranslateElement: new (o: object, id: string) => unknown } }; oppGtInit?: () => void };
    if (!document.getElementById("opp-gt")) { const d = document.createElement("div"); d.id = "opp-gt"; d.setAttribute("aria-hidden", "true"); document.body.appendChild(d); }
    w.oppGtInit = () => { try { new w.google!.translate!.TranslateElement({ pageLanguage: "en", includedLanguages: CODES.join(","), autoDisplay: false }, "opp-gt"); } catch { /* translator unavailable */ } res(); };
    const s = document.createElement("script"); s.src = "https://translate.google.com/translate_a/element.js?cb=oppGtInit"; s.async = true; s.onerror = () => res();
    document.head.appendChild(s);
  });
  return loading;
}
function applyCombo(code: string, tries = 40) {
  const sel = document.querySelector<HTMLSelectElement>("select.goog-te-combo");
  if (!sel) { if (tries > 0) window.setTimeout(() => applyCombo(code, tries - 1), 150); return; }
  sel.value = code; sel.dispatchEvent(new Event("change"));
}
const dirOf = (c: string) => (["ar", "ur", "fa", "iw"].includes(c) ? "rtl" : "ltr");

export function setLanguage(code: string) {
  if (code === "en") { writeCookie(null); location.reload(); return; }
  writeCookie(code);
  document.documentElement.lang = code === "iw" ? "he" : code;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: code }));
  loadTranslator().then(() => applyCombo(code));
}

export default function LangPicker({ className = "btn icon lang", inMenu = false }: { className?: string; inMenu?: boolean }) {
  const [lang, setLang] = useState("en");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const cur = readLang(); setLang(cur);
    if (cur !== "en") { document.documentElement.lang = cur === "iw" ? "he" : cur; loadTranslator(); }
    const on = (e: Event) => setLang((e as CustomEvent<string>).detail);
    window.addEventListener(EVENT, on); return () => window.removeEventListener(EVENT, on);
  }, []);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  const pick = (c: string) => { setOpen(false); if (c === lang) return; ev("Language picked", { lang: c }); setLang(c); setLanguage(c); };
  const cur = LANGS.find((l) => l[0] === lang) ?? LANGS[0];
  return (
    <div className={`langp notranslate${inMenu ? " in-menu" : ""}`} ref={box} translate="no">
      <button type="button" className={className} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        aria-label={`Language: ${cur[2]}. Change language`} title="Language">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>
        <span className="lc">{inMenu ? cur[1] : lang === "en" ? "EN" : lang.split("-")[0].toUpperCase()}</span>
      </button>
      {open ? (
        <div className="langp-pop" role="listbox" aria-label="Read this site in">
          <div className="langp-h">Read this site in</div>
          <div className="langp-grid">
            {LANGS.map(([c, n, en]) => (
              <button key={c} type="button" role="option" aria-selected={c === lang} className={c === lang ? "on" : ""} onClick={() => pick(c)} lang={c === "iw" ? "he" : c} dir={dirOf(c)}>
                <b>{n}</b>{n !== en ? <span>{en}</span> : null}
              </button>
            ))}
          </div>
          <p className="langp-n">Translated automatically by Google. Names, numbers and quotes are as published in English; pick English to see the original.</p>
        </div>
      ) : null}
    </div>
  );
}
