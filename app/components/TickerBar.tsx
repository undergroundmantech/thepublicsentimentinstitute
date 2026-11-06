import Link from "@/app/components/Link";
import { getModel } from "@/app/lib/forecastData";
import { lastName, raceHref } from "@/app/lib/opp";
import { getAcc, mg, cls, winnerName } from "@/app/accuracy/data";

// The 38px bar under the masthead. After Election Day it reads the result against the final forecast in the closest
// marquee Senate and governor races, from public/accuracy/2026.json, and the label opens the accuracy report.
export default function TickerBar() {
  const m = getModel();
  const marquee = new Set(m.races.filter((r) => r.office !== "house" && r.marquee).map((r) => r.id));
  const A = getAcc();
  const items = A.races
    .filter((r) => marquee.has(r.id) && r.act != null && Math.abs(r.fm) < 99)
    .sort((a, b) => Math.abs(a.fm) - Math.abs(b.fm))
    .slice(0, 18)
    .map((r) => ({
      id: r.id,
      label: `${r.st} ${r.o === "senate" ? "Sen" : "Gov"}`,
      lead: lastName(winnerName(r)),
      cls: cls(r.act, r.ind),
      text: mg(r.act, r.ind),
      fc: mg(r.fm, r.ind),
      verb: r.fin ? "" : " leads",
    }));
  const row = (k: string) => items.map((t) => (
    <span key={k + t.id}><Link href={raceHref(t.id)} tabIndex={k === "b" ? -1 : undefined}><b>{t.label}</b>{t.lead}{t.verb} <i className={t.cls}>{t.text}</i><em className="fc">forecast {t.fc}</em></Link></span>
  ));
  return (
    <div className="opp">
      <div className="ticker-bar">
        <div className="wrap">
          <Link className="lbl" href="/accuracy">FINAL · RESULTS VS FORECAST</Link>
          <div className="ticker" aria-label="Results against the final forecast in the closest races">
            <div className="ticker-track">{row("a")}<span aria-hidden="true" style={{ display: "contents" }}>{row("b")}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
