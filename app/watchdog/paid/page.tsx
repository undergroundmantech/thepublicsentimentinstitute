import type { Metadata } from "next";
import Link from "@/app/components/Link";
import { getGraph, usd } from "../data";
import { Pointy } from "@/app/components/home/Mascot";
import "./paid.css";

export const metadata: Metadata = { title: "Who gets paid", description: "The media buyers, ad makers, pollsters, consultants and other firms that campaigns and super PACs pay in the 2026 midterms, and who pays them." };

const KIND: Record<string, string> = { "media buy": "Media buying", digital: "Digital", mail: "Mail", polling: "Polling", consulting: "Consulting and strategy", other: "Other services", "ads, mail and other work": "Ads, mail and other work", "fundraising platform": "Fundraising platforms" };

export default function Page() {
  const g = getGraph();
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const vend = new Map<string, { name: string; what: string; total: number; from: { name: string; id: string; side: string | null; v: number; src: string }[] }>();
  for (const e of g.edges) {
    if (e.k !== "paid" || !e.t.startsWith("v:")) continue;
    const v = byId.get(e.t)!, payer = byId.get(e.s)!;
    const row = vend.get(e.t) ?? { name: v.name, what: v.what ?? "other", total: 0, from: [] };
    row.total += e.v ?? 0; row.from.push({ name: payer.name, id: payer.id, side: payer.side, v: e.v ?? 0, src: e.src }); vend.set(e.t, row);
  }
  const rows = [...vend.entries()].sort((a, b) => b[1].total - a[1].total);
  const max = rows[0]?.[1].total ?? 1;
  const total = rows.reduce((a, [, r]) => a + r.total, 0);
  return (
    <>
      <header className="wd-hero">
        <div>
          <div className="eye gold">Watchdog · Who gets paid</div>
          <h1>The firms <em>behind the ads.</em></h1>
          <p className="lede">Every dollar a campaign or super PAC spends ends up with someone: media buyers, ad makers, mail houses, pollsters and consultants. These are the {rows.length} biggest payees we can trace, {usd(total)} in all.</p>
        </div>
        <Pointy className="pd-pty keep" pose="point" prop="magnifier" size={120} look={-1} flip detective say={<>Same firm on both sides of a race? That shows up here.</>} />
      </header>
      <div className="pd-grid">
        {rows.map(([id, r], i) => (
          <article key={id} className="card pd-card" style={{ animationDelay: `${Math.min(i, 20) * 0.04}s` }}>
            <div className="pd-top">
              <span className="pd-kind">{KIND[r.what] ?? r.what}</span>
              <Link href={`/watchdog/connections?name=${encodeURIComponent(id)}`} className="pd-name">{r.name}</Link>
              <b className="pd-amt">{usd(r.total)}</b>
            </div>
            <div className="wd-bar"><i style={{ width: `${(r.total / max) * 100}%`, background: "linear-gradient(90deg,#e7b341,#ffd98a)" }} /></div>
            <div className="pd-from">
              {r.from.sort((a, b) => b.v - a.v).slice(0, 4).map((f, k) => (
                <div key={k}><Link href={`/watchdog/connections?name=${encodeURIComponent(f.id)}`} className={f.side === "D" ? "d" : f.side === "R" ? "r" : ""}>{f.name}</Link><span className="mono">{usd(f.v)}</span></div>
              ))}
            </div>
            <div className="pd-src">{r.from.some((f) => f.src === "Ledger") ? "Ledger, from FEC filings" : r.from[0]?.src ? <a href={r.from[0].src} target="_blank" rel="noreferrer">Source</a> : null}</div>
          </article>
        ))}
      </div>
      <p className="wd-src">Payments are the largest disbursements reported by each group or campaign, from public compilations of FEC filings and from Ledger. A firm paid by a super PAC is doing ordinary work; this list shows who, not wrongdoing.</p>
    </>
  );
}
