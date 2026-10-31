"use client";
// The Watchdog nav, built for someone who has never seen the section: the tools sit in three plain groups
// (follow the money, follow the people, places), the current tool is lit, and the line under the nav says in one
// sentence what the tool in front of you answers. On a phone the groups scroll sideways and the active tab is
// scrolled into view; the bar stays stuck just under the site header.
import Link from "@/app/components/Link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { WD_DESK, WD_GROUPS, ToolIcon, toolFor, type Tool } from "./tools";

// the flat list, for anything that still wants it; Ledger records stays out until its data is exported
export const WD_TABS = [WD_DESK, ...WD_GROUPS.flatMap((g) => g.tools)].map((t) => ({ href: t.href, label: t.label }));

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

function Tab({ t, on }: { t: Tool; on: boolean }) {
  return (
    <Link href={t.href} className={`wd-tab${on ? " on" : ""}`} aria-current={on ? "page" : undefined} title={t.question}>
      <ToolIcon k={t.key} size={15} /><span>{t.label}</span>
    </Link>
  );
}

/** The "you are here" line: the tool in front of you and the one question it answers, plus the terminal's clock. */
function HereLine({ tool, path }: { tool: Tool; path: string }) {
  const [now, setNow] = useState("");
  useEffect(() => { const tick = () => setNow(new Date().toLocaleTimeString("en-US", { hour12: false, timeZone: "America/New_York" })); tick(); const id = setInterval(tick, 1000); return () => clearInterval(id); }, []);
  const seg = path.replace(/^\/watchdog\/?/, "").split("/")[0] || "start";
  return (
    <div className="wdt-status wd-here">
      <span className="rec" aria-hidden="true"><i />LIVE</span>
      <span className="path" aria-hidden="true">watchdog://{seg}</span>
      <p className="here" key={tool.key}>
        <span className="q">{tool.key === "desk" ? "Start here." : tool.question}</span> <span className="d">{tool.desc}</span>
      </p>
      <span className="clock" aria-hidden="true">{now} ET</span>
    </div>
  );
}

export default function WatchdogNav() {
  const path = usePathname() || "/watchdog";
  const tool = toolFor(path);
  const railRef = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(0);
  const [edge, setEdge] = useState({ l: false, r: false });

  // stick just under the site header, whatever height it has right now (it shrinks once the page scrolls)
  useIso(() => {
    const head = document.querySelector<HTMLElement>("header.opp-top");
    if (!head) return;
    const set = () => setTop(Math.round(head.getBoundingClientRect().height));
    set();
    const ro = new ResizeObserver(set); ro.observe(head);
    return () => ro.disconnect();
  }, []);

  // on a phone the rail scrolls sideways: fade whichever side has more, and bring the active tab into view
  useEffect(() => {
    const el = railRef.current; if (!el) return;
    const upd = () => setEdge({ l: el.scrollLeft > 4, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    const on = el.querySelector<HTMLElement>(".wd-tab.on");
    if (on && el.scrollWidth > el.clientWidth) {
      // show the whole group the active tab sits in, label included, when it fits; otherwise center the tab
      const grp = on.closest<HTMLElement>(".wd-grp") ?? on, rr = el.getBoundingClientRect();
      const g = grp.getBoundingClientRect(), r = on.getBoundingClientRect();
      el.scrollLeft += g.width <= rr.width - 24 ? g.left - rr.left - 12 : r.left - rr.left - (rr.width - r.width) / 2;
    }
    upd();
    el.addEventListener("scroll", upd, { passive: true }); window.addEventListener("resize", upd);
    return () => { el.removeEventListener("scroll", upd); window.removeEventListener("resize", upd); };
  }, [path]);

  return (
    <>
      <div className="wdt-tape" aria-hidden="true"><span>WATCHDOG INVESTIGATION</span><span>FOLLOW THE MONEY</span><span>EVERY CLAIM SOURCED</span><span>WATCHDOG INVESTIGATION</span><span>FOLLOW THE MONEY</span><span>EVERY CLAIM SOURCED</span></div>
      <nav className="wd-nav" aria-label="Watchdog tools" style={{ top }}>
        <Link href="/watchdog" className="wd-brand" aria-label="Watchdog, start here"><i aria-hidden="true" />Watchdog<small>OS</small></Link>
        <div className={`wd-rail${edge.l ? " fl" : ""}${edge.r ? " fr" : ""}`} ref={railRef}>
          <div className={`wd-grp wd-grp-start${tool.key === "desk" ? " has-on" : ""}`}>
            <span className="wd-grp-l" aria-hidden="true">New here?</span>
            <div className="wd-grp-t"><Tab t={WD_DESK} on={tool.key === "desk"} /></div>
          </div>
          {WD_GROUPS.map((g) => (
            <div key={g.key} className={`wd-grp${g.tools.some((t) => t.key === tool.key) ? " has-on" : ""}`} role="group" aria-label={g.label}>
              <span className="wd-grp-l" aria-hidden="true">{g.label}</span>
              <div className="wd-grp-t">{g.tools.map((t) => <Tab key={t.key} t={t} on={t.key === tool.key} />)}</div>
            </div>
          ))}
        </div>
      </nav>
      <HereLine tool={tool} path={path} />
    </>
  );
}
