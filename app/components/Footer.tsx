import Link from "@/app/components/Link";
import { Lockup } from "./opp/Logo";
import { MENU } from "./navMenu";
import { Pointy } from "@/app/components/home/Mascot";

// The footer lists the same groups as the masthead (navMenu.ts): the four main tabs, then each section under More.
const dedupe = (a: (readonly [string, string])[]) => a.filter((x, i, arr) => arr.findIndex((y) => y[0] === x[0]) === i);
const COLS = MENU.flatMap((g) => g.more
  ? g.cols.map((c) => ({ h: c.h, links: dedupe([[c.href ?? g.href, `All of ${c.h}`] as const, ...c.links.map((l) => [l.href, l.label] as const)]) }))
  : [{ h: g.label, links: dedupe([[g.href, `All of ${g.label}`] as const, ...g.cols.flatMap((c) => c.links.map((l) => [l.href, l.label] as const))]) }]);

export default function Footer() {
  return (
    <footer className="opp">
      <div className="foot" style={{ position: "relative" }}>
        <Pointy className="cam-foot" pose="sit" prop="flag" size={110} look={-1} />
        <div className="wrap">
          <div className="cols">
            <div>
              <div className="fbrand"><Lockup height={40} /></div>
              <p style={{ margin: 0, maxWidth: "40ch", color: "var(--mute)" }}>
                Nonpartisan polling and forecasts. The most accurate poll and the #1 forecast of 2026, by On Point Polling, Miami.
              </p>
              <p style={{ margin: "14px 0 0", display: "flex", gap: 12, flexWrap: "wrap" }}><Link href="/accuracy">2026 accuracy report</Link><Link href="/search">Search</Link><Link href="/llms.txt">For language models</Link><a href="https://www.youtube.com/@onpointpoliticsofficial?sub_confirmation=1" target="_blank" rel="noopener" data-ev="YouTube subscribe" data-ev-d='{"from":"footer"}'>YouTube</a><a href="https://onpointpolitics.substack.com" target="_blank" rel="noopener">Newsletter</a></p>
            </div>
            {COLS.map((c) => (
              // a collapsible group: always open on a wide screen, folded on a phone by LiteMotion so the footer is one screen
              <details key={c.h} className="fgrp" open>
                <summary><h4>{c.h}</h4></summary>
                <ul>{c.links.map(([href, label]) => <li key={href + label}><Link href={href}>{label}</Link></li>)}</ul>
              </details>
            ))}
          </div>
          <div className="bottom">
            <span>© 2026 On Point Politics and On Point Polling</span>
            <span><Link href="/terms">Terms</Link> · <Link href="/terms#privacy">Privacy</Link> · <Link href="/on-point-polling/sms">SMS opt in</Link></span>
          </div>
        </div>
      </div>
    </footer>
  );
}
