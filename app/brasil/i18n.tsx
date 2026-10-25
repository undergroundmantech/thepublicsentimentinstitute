"use client";
// English by default; a reader can switch the Brazil pages to Brazilian Portuguese, written by hand, and the choice is
// remembered on this device. Pages render in English first, so search engines and the first paint always agree, and
// switch to Portuguese right after load for a reader who picked it.
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { fmt, type Lang } from "./lib";

const KEY = "opp_br_lang";
const Ctx = createContext<{ lang: Lang; set: (l: Lang) => void }>({ lang: "en", set: () => {} });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    try {
      const q = new URLSearchParams(location.search).get("lang");
      const v = q === "pt" || q === "en" ? q : localStorage.getItem(KEY);
      if (v === "pt") setLang("pt");
    } catch { /* no storage */ }
  }, []);
  useEffect(() => {
    const h = document.documentElement, was = h.lang;
    h.lang = lang === "pt" ? "pt-BR" : "en";
    return () => { h.lang = was || "en"; };
  }, [lang]);
  const set = useCallback((l: Lang) => { setLang(l); try { localStorage.setItem(KEY, l); } catch { /* no storage */ } }, []);
  return <Ctx.Provider value={{ lang, set }}><div className={`br-lang-${lang}`} {...(lang === "pt" ? { translate: "no" as const } : {})}>{children}</div></Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);
export const useFmt = () => fmt(useContext(Ctx).lang);

/** one piece of copy in both languages; server pages pass both versions and the reader's choice picks one */
export function T({ en, pt }: { en: React.ReactNode; pt: React.ReactNode }) {
  const { lang } = useContext(Ctx);
  return <>{lang === "pt" ? pt : en}</>;
}

export function LangToggle() {
  const { lang, set } = useContext(Ctx);
  return (
    <div className="br-langs" role="group" aria-label="Language">
      <button type="button" aria-pressed={lang === "en"} onClick={() => set("en")}>English</button>
      <button type="button" aria-pressed={lang === "pt"} onClick={() => set("pt")} lang="pt-BR">Português</button>
    </div>
  );
}
