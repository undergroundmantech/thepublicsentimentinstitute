// A band on the home page for the Brazil runoff, shown until the count is done. Written in Portuguese for the
// readers it is for, with the English line under it.
import Link from "next/link";
import { getBr } from "./data";
import { nf } from "./lib";

export default function BrasilHomeBand() {
  if (Date.now() > Date.parse("2026-10-27T12:00:00Z")) return null;
  const n = getBr().national;
  return (
    <section className="sec" lang="pt-BR" translate="no">
      <Link href="/brasil" className="glass" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "14px 22px", padding: "16px 20px", borderRadius: 14, textDecoration: "none", border: "1px solid var(--line)", background: "linear-gradient(90deg, rgba(0,166,81,.14), rgba(255,204,41,.08) 40%, transparent), var(--glass)" }}>
        <svg width="34" height="24" viewBox="0 0 22 16" aria-hidden="true"><rect width="22" height="16" rx="3" fill="#00a651" /><path d="M11 2 20 8 11 14 2 8Z" fill="#ffcc29" /><circle cx="11" cy="8" r="3.4" fill="#1d3f9a" /></svg>
        <span style={{ display: "grid", gap: 2, flex: "1 1 320px" }}>
          <b style={{ font: "800 18px var(--font-d)", color: "var(--hi)", letterSpacing: "-.02em" }}>Brasil 2026: o 2º turno é domingo, 25 de outubro</b>
          <span style={{ fontSize: 13, color: "var(--mute)" }}>Previsão, mapa por município e apuração ao vivo em português. Brazil runoff forecast and live results.</span>
        </span>
        <span style={{ font: "800 15px var(--font-m)", whiteSpace: "nowrap" }}>
          <span style={{ color: "var(--mute)", fontSize: 12 }}>Chance </span><span style={{ color: "#8fb2ff" }}>Flávio {nf(100 * n.p_flavio)}%</span><span style={{ color: "var(--mute)" }}> x </span><span style={{ color: "#ff8f96" }}>Lula {nf(100 * n.p_lula)}%</span>
        </span>
        <span className="btn sm" style={{ whiteSpace: "nowrap" }}>Ver a previsão</span>
      </Link>
    </section>
  );
}
