import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "2026 national poll",
  description: "TPSI's 2026 national survey of registered and likely voters: motivation, the generic ballot, Vance vs Newsom, Trump approval and party trust on the issues.",
  alternates: { canonical: "/tpsi/polls/national-2026" },
};

const SURVEY_URL = "https://wss.pollfish.com/link/522d0e01-b70f-4955-8514-b42a7f10d4b6";

const FINDINGS = [
  { tag: "Motivation", t: "Voter motivation, 2026 midterms", v: "74%", cls: "", s: "Extremely motivated: 52% of registered and 74% of likely voters. High engagement expected among likely voters." },
  { tag: "Generic ballot", t: "2026 generic congressional ballot", v: "D +9", cls: "d", s: "Democrats +8 among registered voters (41 to 33) and +9 among likely voters (50 to 41), including leaners." },
  { tag: "2028 matchup", t: "Vance vs Newsom", v: "Newsom +4", cls: "d", s: "A close race: Newsom 47, Vance 42 among likely voters, with undecideds still high." },
  { tag: "Trump approval", t: "President Trump approval", v: "49%", cls: "", s: "Strong disapproval is the largest group, at 49% of registered and 48% of likely voters." },
];

const TRUST = [
  { issue: "Economy", dem: 37, rep: 33 },
  { issue: "Immigration", dem: 29, rep: 45 },
  { issue: "Healthcare", dem: 49, rep: 27 },
  { issue: "Crime", dem: 35, rep: 36 },
];

const net = (d: number, r: number) => (d === r ? "Even" : d > r ? `D +${d - r}` : `R +${r - d}`);

export default function Page() {
  return (
    <div className="opp">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/tpsi">TPSI</Link><span className="sep">/</span><Link href="/tpsi/polls">Polls</Link><span className="sep">/</span><span>National 2026</span></nav>
      <header className="ph">
        <div className="eye g">TPSI poll · Survey toplines</div>
        <h1>The 2026 national <em>poll</em></h1>
        <p className="lede">Weighted results among registered voters (n=316) and likely voters (n=249), fielded by The Public Sentiment Institute. Disclosure first polling on motivation, the ballot, hypotheticals, approval, the issues and policy.</p>
        <div className="pmeta">
          <span className="pill" style={{ background: "var(--glass2)", color: "var(--ink)" }}>National</span>
          <span>Registered voters <b className="mono">316</b> <span className="mono">(weighted n=282)</span></span>
          <span>Likely voters <b className="mono">249</b> <span className="mono">(weighted n=249)</span></span>
          <span>Field period <b className="mono">2026</b></span>
        </div>
      </header>

      <div className="layout">
        <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
          <div className="nat-kpis">
            {FINDINGS.map((f) => (
              <div key={f.tag} className="card tile">
                <span className="eye">{f.tag}</span>
                <span className="t">{f.t}</span>
                <span className={`v ${f.cls}`}>{f.v}</span>
                <span className="s">{f.s}</span>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-h"><h3>Party trust on key issues</h3><span className="eye" style={{ marginLeft: "auto" }}>Q18 · Registered voters</span></div>
            <div className="card-b">
              <div className="nat-trust">
                {TRUST.map((r) => (
                  <div key={r.issue} className="nat-trow">
                    <span className="nm">{r.issue}</span>
                    <div className="bars">
                      <div className="b"><i style={{ width: `${r.dem * 2}%`, background: "var(--dem)" }} /><em className="mono">{r.dem}%</em></div>
                      <div className="b"><i style={{ width: `${r.rep * 2}%`, background: "var(--gop)" }} /><em className="mono">{r.rep}%</em></div>
                    </div>
                    <span className={`mono nt ${r.dem > r.rep ? "d" : r.rep > r.dem ? "r" : ""}`}>{net(r.dem, r.rep)}</span>
                  </div>
                ))}
              </div>
              <div className="legend"><span><i style={{ background: "var(--dem)" }} />Trust Democrats</span><span><i style={{ background: "var(--gop)" }} />Trust Republicans</span></div>
              <p style={{ fontSize: 13, marginTop: 10 }}>Democrats are trusted more on healthcare; Republicans lead on immigration. The economy and crime are within a few points.</p>
            </div>
          </div>

          <div className="card">
            <div className="card-h"><h3>Selected toplines</h3><span className="eye" style={{ marginLeft: "auto" }}>Registered voters</span></div>
            <div className="tblwrap">
              <table className="tbl">
                <thead><tr><th>Issue trust</th><th style={{ textAlign: "right" }}>Dem</th><th style={{ textAlign: "right" }}>Rep</th><th style={{ textAlign: "right" }}>Net</th><th style={{ textAlign: "right" }}>Base</th><th style={{ textAlign: "right" }}>Period</th></tr></thead>
                <tbody>
                  {TRUST.map((r) => (
                    <tr key={r.issue}>
                      <td>{r.issue} trust</td>
                      <td className="n d">{r.dem}%</td>
                      <td className="n r">{r.rep}%</td>
                      <td className={`n ${r.dem > r.rep ? "d" : r.rep > r.dem ? "r" : ""}`}>{net(r.dem, r.rep)}</td>
                      <td className="n" style={{ color: "var(--mute)" }}>282 RV</td>
                      <td className="n" style={{ color: "var(--mute)" }}>2026</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid2">
            <div className="card">
              <div className="card-h"><h3>Trump overall approval</h3><span className="eye" style={{ marginLeft: "auto" }}>Q16</span></div>
              <div className="card-b">
                <div className="kv"><span>Strongly disapprove, registered</span><span>49%</span></div>
                <div className="kv"><span>Strongly disapprove, likely</span><span>48%</span></div>
                <p style={{ fontSize: 13, marginTop: 10 }}>Strong disapproval leads every other response among both registered and likely voters.</p>
              </div>
            </div>
            <div className="card">
              <div className="card-h"><h3>Most important issues</h3><span className="eye" style={{ marginLeft: "auto" }}>Q7 · RV</span></div>
              <div className="card-b">
                <div className="kv"><span>Top priority</span><span>Economy</span></div>
                <div className="kv"><span>Economy mean rank</span><span>3.58</span></div>
                <div className="kv"><span>Lowest priority</span><span>Guns</span></div>
                <p style={{ fontSize: 13, marginTop: 10 }}>The economy and healthcare top the list; lower mean rank means higher priority.</p>
              </div>
            </div>
          </div>
        </div>

        <aside className="side">
          <div className="card">
            <div className="card-h"><h3>Data status</h3></div>
            <div className="card-b" style={{ paddingBlock: 6 }}>
              <div className="kv"><span>Weighting</span><span>Weighted</span></div>
              <div className="kv"><span>Release</span><span>Public</span></div>
              <div className="kv"><span>Version</span><span>v1.0</span></div>
              <div className="kv"><span>Universe</span><span>RV and LV</span></div>
            </div>
          </div>
          <div className="card"><div className="card-b">
            <div className="eye">Get involved</div>
            <p style={{ fontSize: 14, margin: "8px 0 12px" }}>Request custom cuts, crosstabs or recurring waves.</p>
            <Link className="btn g" href="/tpsi/services">Partner with TPSI</Link>
          </div></div>
          <div className="card"><div className="card-b">
            <div className="eye">Take the survey</div>
            <p style={{ fontSize: 14, margin: "8px 0 12px" }}>Contribute to the live national sentiment baseline.</p>
            <a className="btn" href={SURVEY_URL} target="_blank" rel="noopener noreferrer">Participate</a>
          </div></div>
          <div className="callout"><div className="eye">Methodology</div>Weighted toplines with transparent disclosure. Full weighting details are on the <Link href="/tpsi/methodology" style={{ textDecoration: "underline" }}>methodology page</Link>.</div>
        </aside>
      </div>
      <style>{`
        .opp .nat-kpis { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; }
        @media (max-width: 700px) { .opp .nat-kpis { grid-template-columns: 1fr; } }
        .opp .nat-kpis .tile .v { font-size: 34px; margin: 4px 0 2px; }
        .opp .nat-trust { display: grid; gap: 12px; }
        .opp .nat-trow { display: grid; grid-template-columns: 110px 1fr 64px; gap: 14px; align-items: center; }
        .opp .nat-trow .nm { font-weight: 700; font-size: 14px; }
        .opp .nat-trow .bars { display: grid; gap: 4px; }
        .opp .nat-trow .b { display: flex; align-items: center; gap: 8px; height: 12px; }
        .opp .nat-trow .b i { display: block; height: 100%; border-radius: 3px; }
        .opp .nat-trow .b em { font-style: normal; font-size: 11.5px; color: var(--ink2); }
        .opp .nat-trow .nt { text-align: right; font-weight: 700; font-size: 13px; }
        .opp .nat-trow .nt.d { color: var(--dem2); } .opp .nat-trow .nt.r { color: var(--gop2); }
      `}</style>
    </div>
  );
}
