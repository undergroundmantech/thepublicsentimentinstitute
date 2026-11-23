import type { Metadata } from "next";
import Link from "@/app/components/Link";
import StayConnected from "@/app/components/StayConnected";
import { PAY_REPLAY, WORKSHOPS } from "@/app/lib/offers";
import { seo } from "@/app/lib/seo";
import "@/app/components/community.css";

export const metadata: Metadata = seo({ title: "Polling workshops: learn how polls and forecasts work", description: "Live classes from On Point Polling: how polls are weighted, how likely voter screens work, how to grade any poll, and how to build a county by county forecast.", path: "/workshops" });

const FAQ = [
  ["Do I need to know statistics?", "No. The first class assumes nothing past high school math, and every step is done live in a spreadsheet you keep."],
  ["What if I can't make it live?", "Every seat includes the replay and the files, and Weighting Room full members get the whole replay library."],
  ["Do you share the On Point model?", "The class teaches the standard methods every pollster uses, step by step. The On Point weighting model itself stays private."],
  ["Can I get a refund?", "Yes, a full refund up to 48 hours before the first session, no questions asked."],
];

export default function Page() {
  return (
    <div className="opp">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/community">Community</Link><span className="sep">/</span><span>Workshops</span></nav>
      <header className="ph">
        <div className="eye" style={{ color: "var(--gold)" }}>Live workshops</div>
        <h1>Learn polling from the desk that <em>called 2026</em></h1>
        <p className="lede">Small live classes on Zoom: how a poll of a thousand people describes a country, how weighting and likely voter screens work, and how to build a county forecast of your own.</p>
      </header>
      <div className="cm-grid" style={{ maxWidth: 1100, margin: "0 auto", alignItems: "stretch" }}>
        {WORKSHOPS.map((w) => (
          <article key={w.id} className="cm-card" id={w.id} style={{ borderColor: "rgba(231,179,65,.55)" }}>
            <span className="eye" style={{ color: "var(--gold)" }}>{w.format}</span>
            <h2 style={{ fontSize: 22 }}>{w.name}</h2>
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6, fontSize: 14 }}>{w.points.map((p) => <li key={p}>{p}</li>)}</ul>
            <div className="cm-row" style={{ alignItems: "baseline" }}><b style={{ font: "800 30px var(--font-d)" }}>${w.price}</b><span className="cm-mute">${w.early} for the first 20 seats · {w.when}</span></div>
            {w.pay ? <a className="btn gold" href={w.pay} target="_blank" rel="noopener noreferrer" style={{ justifySelf: "start" }}>Save my seat</a> : <a className="btn gold" href="#ws-list" style={{ justifySelf: "start" }}>Get the date first</a>}
          </article>
        ))}
      </div>
      {PAY_REPLAY ? <p className="hire-line" style={{ textAlign: "center" }}>Missed the live class? <a href={PAY_REPLAY} target="_blank" rel="noopener noreferrer">Buy the replay and files</a>.</p> : null}
      <div id="ws-list"><StayConnected from="workshops" title="Get the next workshop date first" note="Seats are capped so every question gets answered. Sign up and you hear about each class before it is announced anywhere else, with the early price." pick={["workshops"]} /></div>
      <section style={{ maxWidth: 1000, margin: "0 auto 40px", display: "grid", gap: 8 }}>
        <h2 style={{ fontSize: 22 }}>Questions</h2>
        {FAQ.map(([q, a]) => <details key={q} className="cm-card" style={{ padding: 14 }}><summary style={{ fontWeight: 800, cursor: "pointer" }}>{q}</summary><p style={{ margin: "8px 0 0", fontSize: 14 }}>{a}</p></details>)}
      </section>
    </div>
  );
}
