import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAx, money, PART_LABEL, PARTY_LABEL, seatLong, STATE_NAME, type Member, type Part } from "../data";
import { Grade, Meter } from "../AxTable";
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

function Ring({ v, g }: { v: number | null; g: string | null }) {
  const r = 54, c = 2 * Math.PI * r, f = v == null ? 0 : v / 100;
  return (
    <svg className={`ax-ring g-${g ?? "na"}`} viewBox="0 0 132 132" role="img" aria-label={v == null ? "Not enough data" : `Index ${v.toFixed(1)} of 100`}>
      <circle cx="66" cy="66" r={r} className="tr" />
      <circle cx="66" cy="66" r={r} className="fg" strokeDasharray={`${c * f} ${c}`} transform="rotate(-90 66 66)" />
      <text x="66" y="66" className="v" textAnchor="middle">{v == null ? "?" : v.toFixed(1)}</text>
      <text x="66" y="88" className="l" textAnchor="middle">of 100</text>
    </svg>
  );
}

function PartCard({ k, m, w }: { k: Part; m: Member; w: number }) {
  const s = m.parts[k];
  let big: React.ReactNode = null, lines: React.ReactNode[] = [], src: { href: string; label: string } | null = null, missing: string | null = null;
  if (k === "lobby") {
    const L = m.lobby;
    if (L.missing) missing = L.missing === "page could not be read" ? "TrackAIPAC lists this state's members, but its page could not be read in full, so this part is left out for now." : "TrackAIPAC does not list this member.";
    else {
      big = L.approved ? "$0" : money(L.amount);
      if (L.approved) lines.push("TrackAIPAC marks this member as rejecting AIPAC money and shows no dollar figure; it is counted as zero.");
      else {
        if (L.pacs != null) lines.push(`${money(L.pacs)} in direct and earmarked gifts from pro-Israel PACs`);
        if (L.ie) lines.push(`${money(L.ie)} in outside spending by pro-Israel PACs for this member`);
      }
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
      if ((F.raised ?? 0) < 25000) missing = "Less than $25,000 raised this cycle, too little for a fair share, so this part is left out.";
      if (F.note) lines.push(F.note.replace(/[()]/g, "").replace(/(\d)-(\d)/g, "$1 to $2").replace(/post-conversion/g, "later"));
      src = { href: F.url, label: "FEC candidate page" };
    }
  } else {
    const T = m.trades;
    if (T.none) { big = "None"; lines.push("No trades are listed for this member in Quiver Quantitative's table for the last year. That table can miss members, so a missing entry is not proof of no trades."); src = { href: "https://www.quiverquant.com/congresstrading/", label: "Quiver Quantitative, last year" }; }
    else {
      big = T.n.toLocaleString(); lines.push(`${T.n === 1 ? "trade" : "trades"} reported in the last year`);
      if (T.volume) lines.push(`about ${money(T.volume)} in estimated volume`);
      if (T.note) lines.push(T.note);
      src = { href: T.url ?? "https://www.quiverquant.com/congresstrading/", label: T.url?.includes("curved") ? "CurvedTrading" : "Quiver Quantitative, last year" };
    }
  }
  return (
    <div className={`card ax-part${s == null ? " off" : ""}`}>
      <div className="card-h"><h3>{PART_LABEL[k]}</h3><span className="eye">{w}% of the index</span></div>
      {missing && s == null ? <p className="ax-miss">{missing}</p> : null}
      {big != null ? <div className="ax-big">{big}</div> : null}
      <ul>{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
      <div className="ax-ps"><span>Part score</span><b>{s != null ? s.toFixed(1) : "Left out"}</b><Meter v={s ?? 0} /></div>
      {src ? <a className="ax-src" href={src.href} target="_blank" rel="noopener noreferrer">Source: {src.label}</a> : null}
    </div>
  );
}

export default async function MemberPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ax = getAx(); const m = ax.members.find((x) => x.slug === slug); if (!m) notFound();
  const peers = ax.members.filter((x) => x.st === m.st && x.id !== m.id).sort((a, b) => (b.index ?? -1) - (a.index ?? -1));
  const partyRanked = ax.members.filter((x) => x.party === m.party && x.index != null).sort((a, b) => b.index! - a.index!);
  const pr = partyRanked.findIndex((x) => x.id === m.id) + 1;
  return (
    <div className="opp ax ax-mem">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/accountability">Accountability Index</Link><span className="sep">/</span><span>{STATE_NAME[m.st] ?? m.st}</span></nav>
      <header className="ax-mh">
        <div>
          <div className="eye gold">{m.ch === "S" ? "U.S. Senate" : "U.S. House"} · {PARTY_LABEL[m.party]} · in Congress since {m.since}</div>
          <h1>{m.name}</h1>
          <p className="dek">{seatLong(m)}</p>
          {m.index != null ? (
            <p className="ax-verdict">Rank <b>{m.rank}</b> of {ax.ranked} in Congress and <b>{pr}</b> of {partyRanked.length} {m.party === "D" ? "Democrats" : m.party === "R" ? "Republicans" : "independents"}. {m.coverage < 3 ? "One of the three measures is missing for this member, so the score rests on the other two." : "All three measures are on file."}</p>
          ) : <p className="ax-verdict">There is not enough data on file to score this member yet: the index needs campaign money from the FEC and at least one more measure.</p>}
        </div>
        <div className="ax-score"><Ring v={m.index ?? null} g={m.grade ?? null} /><Grade g={m.grade ?? null} big /></div>
      </header>

      <section aria-label="What goes into the score">
        <div className="ax-sec-h"><h2>What goes into the score</h2><span className="eye">each part 0 to 100, higher is more independent</span></div>
        <div className="ax-parts">
          {(["lobby", "pac", "trading"] as Part[]).map((k) => <PartCard key={k} k={k} m={m} w={ax.weights[k]} />)}
          <div className="card ax-part off">
            <div className="card-h"><h3>Votes that helped donors</h3><span className="eye">not scored yet</span></div>
            <p className="ax-miss">This part will compare the member&apos;s votes with the industries that fund their campaigns. It needs donor industry data we cannot yet read reliably, so it is not part of any score today.</p>
          </div>
        </div>
      </section>

      <section aria-label="Scorecards">
        <div className="ax-sec-h"><h2>Scorecards beside the index</h2><span className="eye">shown for context, never blended in</span></div>
        <div className="ax-cards">
          <div className="card ax-sc"><span className="eye">America First Foundation</span>{m.aff ? <><b>{m.aff.grade}</b><span>{m.aff.aligned != null ? `${m.aff.aligned} of ${m.aff.total} actions aligned with its positions on immigration, trade and foreign policy` : "Graded too few actions to score"}</span><a href={m.aff.url} target="_blank" rel="noopener noreferrer">Read the scorecard</a></> : <span>Not listed</span>}</div>
          <div className="card ax-sc"><span className="eye">League of Conservation Voters</span>{m.lcv ? <><b>{m.lcv.score ?? "N/A"}{m.lcv.score != null ? <small>%</small> : null}</b><span>2025 environmental score, lifetime {m.lcv.lifetime ?? "N/A"}{m.lcv.lifetime != null ? "%" : ""}</span><a href={m.lcv.url} target="_blank" rel="noopener noreferrer">Read the scorecard</a></> : <span>Not listed</span>}</div>
          <div className="card ax-sc"><span className="eye">Heritage Action</span>{m.heritage ? <><b>{m.heritage.score ?? "N/A"}{m.heritage.score != null ? <small>%</small> : null}</b><span>119th Congress score, lifetime {m.heritage.lifetime ?? "N/A"}{m.heritage.lifetime != null ? "%" : ""}</span><a href={m.heritage.url} target="_blank" rel="noopener noreferrer">Read the scorecard</a></> : <span>Not listed</span>}</div>
        </div>
      </section>

      {peers.length ? (
        <section aria-label="Delegation">
          <div className="ax-sec-h"><h2>The rest of the {STATE_NAME[m.st] ?? m.st} delegation</h2><span className="eye">{peers.length} {peers.length === 1 ? "member" : "members"}</span></div>
          <div className="ax-peers">{peers.map((p) => (
            <Link key={p.id} href={`/accountability/${p.slug}`} className="card"><span className={`pt p-${p.party}`}>{p.party}</span><b>{p.name}</b><span className="seat">{p.seat}</span><span className="v">{p.index != null ? p.index.toFixed(1) : "Not scored"}</span><Grade g={p.grade ?? null} /></Link>
          ))}</div>
        </section>
      ) : null}
      <p className="ax-foot">Scores are built from public records and the sources linked above. See something wrong? <Link href="/contact">Tell us</Link> and we will correct it with a note. <Link href="/accountability/methodology">How the index works</Link>.</p>
    </div>
  );
}
