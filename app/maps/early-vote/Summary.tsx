// Server rendered text for the early vote tracker: the plain language lede under the page title, the
// state by state index and the questions people search for. It is what search engines and AI answers
// read and quote, so every number here is the same feed the interactive desk above it draws.
import Link from "next/link";
import { type EarlyVote, type EvState, commas, millions, longDate, pct } from "./server";

const ELECTION = Date.UTC(2026, 10, 3);
const daysLeft = (snap: string) => Math.max(0, Math.round((ELECTION - Date.parse(`${snap}T12:00:00Z`)) / 86_400_000));

export const SUMMARY_CSS = `
.evs-lede{max-width:72ch;margin:4px 0 22px;color:var(--ink2);font-size:15.5px;line-height:1.65}
.evs-lede b{color:var(--ink);font-weight:700}
.evs-lede a{color:var(--ink);text-decoration:underline;text-underline-offset:3px}
.evs-sec{margin:44px 0 0}
.evs-sec h2{font-family:var(--font-d);font-weight:800;letter-spacing:-.02em;font-size:22px;margin:0 0 6px;color:var(--ink)}
.evs-sec>p{color:var(--mute);margin:0 0 14px;max-width:72ch;line-height:1.6;font-size:14px}
.evs-tw{overflow-x:auto;border:1px solid var(--line);border-radius:14px;background:rgba(var(--line-rgb),.02)}
.evs-t{width:100%;border-collapse:collapse;font-size:13.5px;min-width:620px}
.evs-t th{font:700 10.5px var(--font-m);letter-spacing:.14em;text-transform:uppercase;color:var(--mute);text-align:right;padding:11px 14px;border-bottom:1px solid var(--line2);white-space:nowrap}
.evs-t th:first-child,.evs-t td:first-child{text-align:left}
.evs-t td{padding:9px 14px;border-bottom:1px solid var(--line);text-align:right;font-family:var(--font-m);font-variant-numeric:tabular-nums;color:var(--ink2);white-space:nowrap}
.evs-t tr:last-child td{border-bottom:0}
.evs-t td a{font-family:var(--font-b);font-weight:700;color:var(--ink);text-decoration:none}
.evs-t td a:hover,.evs-t td a:focus-visible{text-decoration:underline}
.evs-t .d{color:var(--dem2)} .evs-t .r{color:#ff8a8a} .evs-t .na{color:var(--mute2)}
.evs-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}
.evs-k{border:1px solid var(--line);border-radius:14px;padding:14px 16px;background:rgba(var(--line-rgb),.02)}
.evs-k span{display:block;font:700 10.5px var(--font-m);letter-spacing:.14em;text-transform:uppercase;color:var(--mute)}
.evs-k b{display:block;font:800 24px var(--font-d);letter-spacing:-.02em;color:var(--ink);margin-top:6px;font-variant-numeric:tabular-nums}
.evs-k small{display:block;color:var(--mute);font-size:12.5px;margin-top:2px}
.evs-faq{display:grid;gap:10px;max-width:80ch}
.evs-faq details{border:1px solid var(--line);border-radius:12px;padding:12px 16px;background:rgba(var(--line-rgb),.02)}
.evs-faq summary{cursor:pointer;font-weight:700;color:var(--ink);font-size:15px}
.evs-faq details p{color:var(--ink2);margin:10px 0 2px;line-height:1.65;font-size:14.5px}
.evs-links{display:flex;flex-wrap:wrap;gap:8px}
.evs-links a{border:1px solid var(--line2);border-radius:999px;padding:6px 12px;font-size:13px;color:var(--ink2);text-decoration:none}
.evs-links a:hover,.evs-links a:focus-visible{color:var(--ink);border-color:var(--ink2)}
`;

const partyLine = (x: { dem: number; rep: number; ind: number; partyTotal?: number }, total: number) =>
  `registered Democrats have cast ${pct(x.dem, total)} of these ballots, Republicans ${pct(x.rep, total)} and independents and third parties ${pct(x.ind, total)}`;

export function nationalFaq(ev: EarlyVote): [string, string][] {
  const party = ev.states.filter((s) => s.partyShare > 0.5);
  return [
    ["How many people have voted early in the 2026 midterms?",
      `As of ${longDate(ev.snapshot)}, ${commas(ev.total)} ballots have been cast across ${ev.states.length} reporting states: ${commas(ev.mail)} mail ballots returned and ${commas(ev.inperson)} cast in person. Another ${commas(Math.max(0, ev.requested - ev.mail))} mail ballots sent or requested have not been returned yet.`],
    ["Which states report early votes by party?",
      `${party.length} states report the party registration of early voters: ${party.map((s) => s.name).join(", ")}. In those states ${partyLine(ev, ev.partyTotal)}. Party registration shows who has voted, not how they voted. For states that report no party, On Point Polling estimates the party mix from county results and voter demographics.`],
    ["When is Election Day 2026?",
      `Election Day is Tuesday, November 3, 2026, ${daysLeft(ev.snapshot)} days after the latest count. Early voting dates, mail ballot deadlines and in person hours are set by each state.`],
    ["Where do these early vote numbers come from?",
      "Counts come from state and county election offices, compiled by civicAPI and refreshed every day. On Point Politics adds the party and demographic estimates, the comparison with 2022 and 2024 and the check against the On Point forecast."],
    ["Does the early vote tell us who will win?",
      "Not by itself. Early voters lean older and more partisan than Election Day voters, and the mix changes as more ballots come in. The tracker compares each state with its own pace in 2022 and 2024 and with the On Point forecast, which is the better test of whether a state is running ahead of or behind expectations."],
  ];
}

export function stateFaq(ev: EarlyVote, s: EvState): [string, string][] {
  const hasParty = s.partyShare > 0.5;
  return [
    [`How many people have voted early in ${s.name}?`,
      `As of ${longDate(ev.snapshot)}, ${commas(s.total)} ballots have been cast in ${s.name}: ${commas(s.mail)} mail ballots returned and ${commas(s.inperson)} cast in person.${s.requested ? ` Voters have requested ${commas(s.requested)} mail ballots.` : ""}`],
    [`Does ${s.name} report early votes by party?`,
      hasParty
        ? `Yes. Of the ballots cast so far, ${partyLine(s, s.total)}. Party registration shows who has voted, not how they voted.`
        : `No. ${s.name} does not publish the party registration of early voters, so On Point Polling estimates the party mix from county results and voter demographics on the map above.`],
    [`When is Election Day in ${s.name}?`,
      `Election Day is Tuesday, November 3, 2026, ${daysLeft(ev.snapshot)} days after the latest count. Check the ${s.name} election office for early voting locations, hours and mail ballot deadlines.`],
  ];
}

export function faqLd(items: [string, string][]) {
  return { "@type": "FAQPage", mainEntity: items.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };
}

function Faq({ items }: { items: [string, string][] }) {
  return (
    <section className="evs-sec" aria-labelledby="evs-faq">
      <h2 id="evs-faq">Early vote questions</h2>
      <div className="evs-faq">
        {items.map(([q, a], i) => (
          <details key={q} open={i === 0}><summary>{q}</summary><p>{a}</p></details>
        ))}
      </div>
    </section>
  );
}

export function NationalLede({ ev }: { ev: EarlyVote }) {
  return (
    <p className="evs-lede">
      As of <b>{longDate(ev.snapshot)}</b>, <b>{commas(ev.total)}</b> ballots have been cast in the 2026 midterm elections across{" "}
      <b>{ev.states.length} reporting states</b>: {millions(ev.mail)} mail ballots returned and {millions(ev.inperson)} cast in person.
      In the states that report party, {partyLine(ev, ev.partyTotal)}. This early vote tracker updates every day with each state&apos;s
      count, its pace against 2022 and 2024, and what the ballots so far mean for the <Link href="/forecast">On Point forecast</Link>.
    </p>
  );
}

export function StateLede({ ev, s, fc }: { ev: EarlyVote; s: EvState; fc?: { href: string; label: string } }) {
  const hasParty = s.partyShare > 0.5;
  return (
    <p className="evs-lede">
      As of <b>{longDate(ev.snapshot)}</b>, <b>{commas(s.total)}</b> ballots have been cast in {s.name}: {commas(s.mail)} mail ballots
      returned and {commas(s.inperson)} cast in person.{" "}
      {hasParty ? <>So far {partyLine(s, s.total)}.</> : <>{s.name} reports no party with its early votes, so the party mix below is an On Point Polling estimate.</>}{" "}
      Updated daily, with every county, the pace against 2022 and 2024 and the <Link href={fc?.href ?? "/forecast"}>{fc?.label ?? "On Point forecast"}</Link>.
    </p>
  );
}

function StateTable({ ev }: { ev: EarlyVote }) {
  return (
    <div className="evs-tw">
      <table className="evs-t">
        <thead><tr><th scope="col">State</th><th scope="col">Ballots cast</th><th scope="col">Mail returned</th><th scope="col">In person</th><th scope="col">Democrats</th><th scope="col">Republicans</th></tr></thead>
        <tbody>
          {ev.states.map((s) => {
            const has = s.partyShare > 0.5;
            return (
              <tr key={s.st}>
                <td><Link href={`/maps/early-vote/${s.slug}`}>{s.name}</Link></td>
                <td>{commas(s.total)}</td><td>{commas(s.mail)}</td><td>{commas(s.inperson)}</td>
                <td className={has ? "d" : "na"}>{has ? pct(s.dem, s.total) : "not reported"}</td>
                <td className={has ? "r" : "na"}>{has ? pct(s.rep, s.total) : "not reported"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function NationalIndex({ ev }: { ev: EarlyVote }) {
  return (
    <div className="evs">
      <style>{SUMMARY_CSS}</style>
      <section className="evs-sec" aria-labelledby="evs-states">
        <h2 id="evs-states">Early vote by state</h2>
        <p>Every state reporting ballots for November 3, 2026, largest first. Party shares are of all ballots cast, from the states that publish party registration. Open a state for its counties.</p>
        <StateTable ev={ev} />
      </section>
      <Faq items={nationalFaq(ev)} />
    </div>
  );
}

export function StateIndex({ ev, s }: { ev: EarlyVote; s: EvState }) {
  const has = s.partyShare > 0.5;
  const others = ev.states.filter((x) => x.st !== s.st);
  return (
    <div className="evs">
      <style>{SUMMARY_CSS}</style>
      <section className="evs-sec" aria-labelledby="evs-st">
        <h2 id="evs-st">{s.name} early vote at a glance</h2>
        <p>Count as of {longDate(ev.snapshot)}, from state and county election offices.</p>
        <div className="evs-grid">
          <div className="evs-k"><span>Ballots cast</span><b>{commas(s.total)}</b><small>mail and in person</small></div>
          <div className="evs-k"><span>Mail returned</span><b>{commas(s.mail)}</b><small>{s.requested ? `of ${commas(s.requested)} requested` : "mail ballots"}</small></div>
          <div className="evs-k"><span>In person</span><b>{commas(s.inperson)}</b><small>early in person</small></div>
          <div className="evs-k"><span>Party</span><b>{has ? `D ${pct(s.dem, s.total)}` : "Modeled"}</b><small>{has ? `R ${pct(s.rep, s.total)}, other ${pct(s.ind, s.total)}` : "no party reported"}</small></div>
        </div>
      </section>
      <Faq items={stateFaq(ev, s)} />
      <section className="evs-sec" aria-labelledby="evs-more">
        <h2 id="evs-more">Early vote in other states</h2>
        <p><Link href="/maps/early-vote">The nationwide early vote tracker</Link> has every state on one map.</p>
        <nav className="evs-links" aria-label="Other states">
          {others.map((x) => <Link key={x.st} href={`/maps/early-vote/${x.slug}`}>{x.name}</Link>)}
        </nav>
      </section>
    </div>
  );
}
