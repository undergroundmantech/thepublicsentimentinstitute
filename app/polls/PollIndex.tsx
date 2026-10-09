import Link from "next/link";
import { AGGREGATES, buildAggregate, type AggregateDef } from "@/app/_polling/lib/aggregates";
import { AGG_GROUPS, pollHref, PRIMARIES } from "./registry";

type Row = { def: AggregateDef; href: string; value: string; cls: string; n: number; updated: string | null; spark: number[] };

function side(def: AggregateDef, net: number) {
  // net = seriesA - seriesB; color the leader by its party word, national series by their meaning
  const s = net >= 0 ? def.seriesA : def.seriesB;
  const p = (s.party || "").toLowerCase();
  if (p.startsWith("dem")) return "d";
  if (p.startsWith("rep")) return "r";
  if (p.startsWith("ind")) return "i";
  if (/harris|newsom|democrat/i.test(s.label)) return "d";
  if (/trump|vance|republican/i.test(s.label)) return "r";
  return "";
}

function rows(test: (d: AggregateDef) => boolean): Row[] {
  return AGGREGATES.filter(test).map((def) => {
    const b = buildAggregate(def);
    const l = b.latest;
    const daily = b.daily.slice(-60).map((x) => x.net);
    return {
      def, href: pollHref(def.id), n: b.polls.length, updated: b.daily.length ? b.daily[b.daily.length - 1].date : null, spark: daily,
      value: l ? def.fmtMargin(l.net) : "No polls", cls: l ? side(def, l.net) : "",
    };
  });
}

function Spark({ data, cls }: { data: number[]; cls: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * 100).toFixed(1)},${(26 - ((v - min) / span) * 22).toFixed(1)}`).join(" ");
  const color = cls === "d" ? "var(--dem)" : cls === "r" ? "var(--gop)" : cls === "i" ? "var(--ind)" : "var(--ink2)";
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" style={{ width: "100%", height: 28 }} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
    </svg>
  );
}

export default function PollIndex({ groups, title, lede, crumb }: { groups: string[]; title: React.ReactNode; lede: string; crumb?: string }) {
  const sections = AGG_GROUPS.filter((g) => groups.includes(g.key)).map((g) => ({ ...g, rows: rows(g.test) })).filter((g) => g.rows.length);
  const total = sections.reduce((a, s) => a + s.rows.length, 0);
  return (
    <div className="opp">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="sep">/</span>
        {crumb ? <><Link href="/polls">Polls</Link><span className="sep">/</span><span>{crumb}</span></> : <span>Polls</span>}
      </nav>
      <header className="ph">
        <div className="eye g">Polling averages</div>
        <h1>{title}</h1>
        <p className="lede">{lede}</p>
        <div className="pmeta"><span><b>{total}</b> tracked averages</span><span>Every poll counted, weighted by recency, sample, voter screen and pollster grade</span><Link className="btn sm" href="/api/polls/generic-ballot">Public JSON</Link></div>
      </header>
      {sections.map((s) => (
        <section className="sec" key={s.key} style={{ paddingBlock: "18px" }}>
          <div className="sec-h"><div><h2 style={{ fontSize: 22 }}>{s.title}</h2></div><span className="eye" style={{ marginLeft: "auto" }}>{s.rows.length} averages</span></div>
          <div className="tiles">
            {s.rows.map((r) => (
              <Link key={r.def.id} href={r.href} className="card tile">
                <span className="t">{r.def.label}</span>
                <span className={`v mono ${r.cls}`}>{r.value}</span>
                <Spark data={r.spark} cls={r.cls} />
                <span className="s">{r.n} polls{r.updated ? ` · through ${new Date(r.updated + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
      {groups.includes("primaries") && (
        <section className="sec" style={{ paddingBlock: "18px" }}>
          <div className="sec-h"><div><h2 style={{ fontSize: 22 }}>2026 primaries</h2></div></div>
          <div className="tiles">
            {Object.entries(PRIMARIES).map(([k, v]) => (
              <Link key={k} href={`/polls/${k}`} className="card tile"><span className="t">{v.title}</span><span className="s">/polls/{k}</span></Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
