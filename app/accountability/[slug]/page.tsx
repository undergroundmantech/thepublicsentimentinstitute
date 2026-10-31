import type { Metadata } from "next";
import Link from "@/app/components/Link";
import { notFound } from "next/navigation";
import { getAx, money, PARTS, PART_LABEL, PARTY_LABEL, seatLong, STATE_NAME, type Member, type Part } from "../data";
import { Grade } from "../AxTable";
import { Strip } from "../AxViz";
import "../accountability.css";

export function generateStaticParams() { return getAx().members.map((m) => ({ slug: m.slug })); }
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; const m = getAx().members.find((x) => x.slug === slug);
  if (!m) return {};
  return {
    title: `${m.name} on the Accountability Index`,
    description: m.index != null ? `${m.name}, ${seatLong(m)}, scores ${m.index.toFixed(1)} of 100 for independence from special interest money, grade ${m.grade}, rank ${m.rank} of ${getAx().ranked}.` : `${m.name}, ${seatLong(m)}, on the On Point Politics Accountability Index.`,
    alternates: { canonical: `https://onpointpolitics.com/accountability/${m.slug}` },
  };
}

/** The big dial: a full ring of 100 ticks, lit up to the score. */
function Dial({ v, g }: { v: number | null; g: string | null }) {
  const n = 100, on = v == null ? 0 : Math.round(v);
  return (
    <svg className={`ax-dial g-${g ?? "na"}`} viewBox="-110 -110 220 220" role="img" aria-label={v == null ? "Not enough data" : `Index ${v.toFixed(1)} of 100, grade ${g}`}>
      {Array.from({ length: n }, (_, i) => { const a = (-90 + (i * 360) / n) * (Math.PI / 180); const r0 = 86, r1 = i % 10 === 0 ? 104 : 98; return <line key={i} x1={r0 * Math.cos(a)} y1={r0 * Math.sin(a)} x2={r1 * Math.cos(a)} y2={r1 * Math.sin(a)} className={i < on ? "lit" : "dim"} style={{ animationDelay: `${i * 9}ms` }} />; })}
      <text y="4" textAnchor="middle" className="v">{v == null ? "?" : v.toFixed(1)}</text>
      <text y="30" textAnchor="middle" className="l">of 100</text>
    </svg>
  );
}

/** Small ring for one part score. */
function Mini({ v, k }: { v: number | null | undefined; k: Part }) {
  const r = 26, c = 2 * Math.PI * r, f = v == null ? 0 : v / 100;
  return (
    <svg className={`ax-mini p-${k}`} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r={r} className="tr" />
      <circle cx="32" cy="32" r={r} className="fg" strokeDasharray={`${c * f} ${c}`} transform="rotate(-90 32 32)" />
      <text x="32" y="37" textAnchor="middle">{v == null ? "?" : Math.round(v)}</text>
    </svg>
  );
}

function detail(k: Part, m: Member) {
  let big: string | null = null; const lines: string[] = []; let src: { href: string; label: string } | null = null; let missing: string | null = null;
  if (k === "lobby") {
    const L = m.lobby;
    if (L.missing) missing = L.missing === "page could not be read" ? "TrackAIPAC lists this state's members, but its page could not be read in full." : "TrackAIPAC does not list this member.";
    else {
      big = L.approved ? "$0" : money(L.amount);
      if (L.approved) lines.push("TrackAIPAC marks this member as rejecting AIPAC money and shows no dollar figure; it is counted as zero.");
      else { if (L.pacs != null) lines.push(`${money(L.pacs)} in direct and earmarked gifts from pro-Israel PACs`); if (L.ie) lines.push(`${money(L.ie)} in outside spending by pro-Israel PACs for this member`); }
      if (L.tags) lines.push(`TrackAIPAC notes: ${L.tags.replace(/;/g, ",")}`);
      src = { href: "https://www.trackaipac.com/congress", label: "TrackAIPAC, career total" };
    }
  } else if (k === "pac") {
    const F = m.money;
    if (!F) missing = "No FEC campaign committee is on file for this member, so no campaign money can be read.";
    else {
      big = F.pacShare == null ? "None" : `${Math.round(F.pacShare * 100)}%`;
      lines.push(`${money(F.pac)} from PACs and other committees of ${money(F.raised)} raised`);
      if (F.individual) lines.push(`${money(F.individual)} from individual donors`);
      lines.push(`${F.period.replace(/(\d)-(\d)/g, "$1 to $2").replace(/-/g, " ")}, filings through ${new Date(F.coverageThrough + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`);
      if ((F.raised ?? 0) < 25000) missing = "Less than $25,000 raised this cycle, too little for a fair share.";
      if (F.note) lines.push(F.note.replace(/[()]/g, "").replace(/(\d)-(\d)/g, "$1 to $2").replace(/post-conversion/g, "later"));
      src = { href: F.url, label: "FEC candidate page" };
    }
  } else if (k === "trading") {
    const T = m.trades;
    if (T.none) { big = "None"; lines.push("No trades are listed for this member in Quiver Quantitative's table for the last year. That table can miss members, so a missing entry is not proof of no trades."); src = { href: "https://www.quiverquant.com/congresstrading/", label: "Quiver Quantitative, last year" }; }
    else {
      big = T.n.toLocaleString(); lines.push(`${T.n === 1 ? "trade" : "trades"} reported in the last year`);
      if (T.volume) lines.push(`about ${money(T.volume)} in estimated volume`);
      if (T.note) lines.push(T.note);
      src = { href: T.url ?? "https://www.quiverquant.com/congresstrading/", label: T.url?.includes("curved") ? "CurvedTrading" : "Quiver Quantitative, last year" };
    }
  } else {
    const c = m.parts.cross;
    if (c == null) missing = "Too few scorecards list this member to place them.";
    else {
      big = c.toFixed(1);
      lines.push(`Left scorecards ${m.side.L != null ? Math.round(m.side.L) : "not enough on file, party median used"}, right scorecards ${m.side.R != null ? Math.round(m.side.R) : "not enough on file, party median used"}, on a scale where each party's average member is 0 or 100`);
      lines.push("A typical member of either party lands near 50. Earning credit from the other side's groups raises it; falling short of your own side's groups lowers it.");
      src = { href: "/accountability/methodology", label: "how the scorecards are rescaled" };
    }
  }
  return { big, lines, src, missing };
}

export default async function MemberPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ax = getAx(); const m = ax.members.find((x) => x.slug === slug); if (!m) notFound();
  const ranked = ax.members.filter((x) => x.index != null);
  const peers = ax.members.filter((x) => x.st === m.st && x.id !== m.id).sort((a, b) => (b.index ?? -1) - (a.index ?? -1));
  const partyRanked = ranked.filter((x) => x.party === m.party).sort((a, b) => b.index! - a.index!);
  const pr = partyRanked.findIndex((x) => x.id === m.id) + 1;
  const pct = m.index != null ? Math.round((100 * ranked.filter((x) => x.index! < m.index!).length) / ranked.length) : null;
  const avg = (p: string) => { const x = ranked.filter((y) => y.party === p); return x.reduce((s, y) => s + y.index!, 0) / (x.length || 1); };
  const tot = PARTS.reduce((s, k) => s + ax.weights[k], 0);
  const val = (k: Part) => m.parts[k] ?? ax.medians[k];
  const imp = new Set(m.imputed ?? []);
  return (
    <div className={`opp ax ax-x ax-mem pc-${m.party}`}>
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/accountability">Accountability Index</Link><span className="sep">/</span><span>{STATE_NAME[m.st] ?? m.st}</span></nav>
      <header className="ax-mh2">
        <div className="ax-mh2-l">
          <div className="eye gold">{m.ch === "S" ? "U.S. Senate" : "U.S. House"} · {PARTY_LABEL[m.party]} · in Congress since {m.since}</div>
          <h1>{m.name}</h1>
          <p className="dek">{seatLong(m)}</p>
          {m.index != null ? (
            <div className="ax-chips">
              <div><b>#{m.rank}</b><span>of {ax.ranked} in Congress</span></div>
              <div><b>#{pr}</b><span>of {partyRanked.length} {m.party === "D" ? "Democrats" : m.party === "R" ? "Republicans" : "independents"}</span></div>
              <div><b>{pct}%</b><span>of members score lower</span></div>
              <div><b>{imp.size ? "Partial" : "Full"}</b><span>{imp.size ? `${[...imp].map((k) => PART_LABEL[k as Part].toLowerCase()).join(", ")} at the median` : "all four measures on file"}</span></div>
            </div>
          ) : <p className="ax-verdict">There is not enough data on file to score this member yet: the index needs campaign money from the FEC.</p>}
        </div>
        <div className="ax-mh2-r"><Dial v={m.index ?? null} g={m.grade ?? null} /><Grade g={m.grade ?? null} big /></div>
      </header>

      {m.index != null ? (
        <section className="ax-panel" aria-labelledby="ax-add-h">
          <div className="ax-sec-h"><h2 id="ax-add-h">How the score adds up</h2><span className="eye">each block is a measure, sized by its weight and filled by the score</span></div>
          <div className="ax-stack" role="img" aria-label={`Index ${m.index.toFixed(1)} made of ${PARTS.map((k) => `${PART_LABEL[k]} ${val(k).toFixed(0)}`).join(", ")}`}>
            {PARTS.map((k) => (
              <div key={k} className={`blk p-${k}${imp.has(k) ? " imp" : ""}`} style={{ flex: ax.weights[k] }}>
                <div className="fill" style={{ width: `${val(k)}%` }} />
                <span className="t">{PART_LABEL[k]}</span>
                <span className="n">+{((ax.weights[k] * val(k)) / tot).toFixed(1)} <em>of {Math.round((100 * ax.weights[k]) / tot)}</em></span>
              </div>
            ))}
          </div>
          <div className="ax-stack-f"><span>Points earned</span><b>{m.index.toFixed(1)}</b><span>of 100</span></div>
        </section>
      ) : null}

      <section aria-labelledby="ax-parts-h">
        <div className="ax-sec-h"><h2 id="ax-parts-h">The record</h2><span className="eye">each part 0 to 100, higher is more independent</span></div>
        <div className="ax-parts2">
          {PARTS.map((k) => {
            const d = detail(k, m);
            return (
              <article key={k} className={`ax-p2 p-${k}${imp.has(k) ? " imp" : ""}`}>
                <div className="ph"><Mini v={m.parts[k] ?? (imp.has(k) ? ax.medians[k] : null)} k={k} /><div><h3>{PART_LABEL[k]}</h3><span>{ax.weights[k]}% of the index{imp.has(k) ? " · median used" : ""}</span></div></div>
                {d.big ? <div className="big">{d.big}</div> : null}
                {d.missing ? <p className="miss">{d.missing}{imp.has(k) ? ` The index uses the median of every member, ${ax.medians[k].toFixed(0)}.` : ""}</p> : null}
                <ul>{d.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
                {d.src ? <a className="src" href={d.src.href} target="_blank" rel="noopener noreferrer">Source: {d.src.label}</a> : null}
              </article>
            );
          })}
          <article className="ax-p2 off">
            <div className="ph"><div><h3>Votes that helped donors</h3><span>not scored yet</span></div></div>
            <p className="miss">This part will compare the member&apos;s votes with the industries that fund their campaigns. It needs donor industry data we cannot yet read reliably, so it is not part of any score today.</p>
          </article>
        </div>
      </section>

      {m.index != null ? (
        <section className="ax-panel" aria-labelledby="ax-strip-h">
          <div className="ax-sec-h"><h2 id="ax-strip-h">Where {m.last} stands in Congress</h2><span className="eye">every member, from 0 to 100</span></div>
          <Strip me={m.slug} avgD={avg("D")} avgR={avg("R")} />
        </section>
      ) : null}

      <section className="ax-panel" aria-labelledby="ax-sc-h">
        <div className="ax-sec-h"><h2 id="ax-sc-h">The eight scorecards</h2><span className="eye">the raw score each group gives, and where it sits between the parties</span></div>
        <div className="ax-cards8">
          {(["L", "R"] as const).map((side) => (
            <div key={side} className={`ax-side s-${side}`}>
              <div className="ax-side-h"><b>{side === "L" ? "Left leaning" : "Right leaning"}</b><span>{m.side[side] != null ? `side score ${Math.round(m.side[side]!)}` : "party median used"}</span></div>
              {ax.cards.filter((c) => c.lean === side).map((c) => {
                const v = m.cards[c.id];
                const pos = (x: number) => `${Math.max(0, Math.min(100, x))}%`;
                return (
                  <div key={c.id} className="ax-c8">
                    <div className="h"><a href={v?.url ?? c.source} target="_blank" rel="noopener noreferrer">{c.name}</a>{c.w > 1 ? <em>counts twice</em> : null}<b>{v ? `${Math.round(v.score)}${v.grade ? ` · ${v.grade}` : ""}` : "Not listed"}</b></div>
                    <div className="track" aria-hidden="true">
                      <i className="pd" style={{ left: pos(c.meanD) }} title={`Average Democrat ${c.meanD}`} /><i className="pr" style={{ left: pos(c.meanR) }} title={`Average Republican ${c.meanR}`} />
                      {v ? <i className="me" style={{ left: pos(v.score) }} /> : null}
                    </div>
                    <div className="f"><span>{c.year}</span><span>avg D {Math.round(c.meanD)} · avg R {Math.round(c.meanR)}</span></div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      {peers.length ? (
        <section aria-labelledby="ax-del-h">
          <div className="ax-sec-h"><h2 id="ax-del-h">The rest of the {STATE_NAME[m.st] ?? m.st} delegation</h2><span className="eye">{peers.length} {peers.length === 1 ? "member" : "members"}</span></div>
          <div className="ax-peers">{peers.map((p) => (
            <Link key={p.id} href={`/accountability/${p.slug}`} className="ax-peer"><span className={`pt p-${p.party}`}>{p.party}</span><b>{p.name}</b><span className="seat">{p.seat}</span><span className="v">{p.index != null ? p.index.toFixed(1) : "Not scored"}</span><Grade g={p.grade ?? null} /><i className="bar"><u style={{ width: `${p.index ?? 0}%` }} /></i></Link>
          ))}</div>
        </section>
      ) : null}
      <p className="ax-foot">Scores are built from public records and the sources linked above. See something wrong? <Link href="/contact">Tell us</Link> and we will correct it with a note. <Link href="/accountability/methodology">How the index works</Link>.</p>
    </div>
  );
}
