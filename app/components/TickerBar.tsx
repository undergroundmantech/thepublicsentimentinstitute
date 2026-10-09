import Link from "next/link";
import { getModel, isInd } from "@/app/lib/forecastData";
import { fmtM, lastName, raceHref } from "@/app/lib/opp";
import DaysOut from "./DaysOut";

// The 38px bar under the masthead: days out, then a marquee of model margins for the
// marquee Senate and governor races in public/forecast/model.json.
export default function TickerBar() {
  const m = getModel();
  const items = m.races
    .filter((r) => r.office !== "house" && r.marquee)
    .sort((a, b) => Math.abs(a.stages.rate) - Math.abs(b.stages.rate))
    .slice(0, 16)
    .map((r) => {
      const ind = isInd(r);
      const mg = r.stages.rate;
      return {
        id: r.id,
        label: `${r.st} ${r.office === "senate" ? "Sen" : "Gov"}`,
        lead: lastName(mg < 0 ? r.dem : r.gop),
        cls: ind ? "i" : mg < 0 ? "d" : "r",
        text: fmtM(mg, ind),
      };
    });
  const row = (k: string) => items.map((t) => (
    <span key={k + t.id}><Link href={raceHref(t.id)} tabIndex={k === "b" ? -1 : undefined}><b>{t.label}</b>{t.lead} <i className={t.cls}>{t.text}</i></Link></span>
  ));
  return (
    <div className="opp">
      <div className="ticker-bar">
        <div className="wrap">
          <span className="lbl"><DaysOut initial={m.meta.daysOut} /></span>
          <div className="ticker" aria-label="Model margins in the closest races">
            <div className="ticker-track">{row("a")}<span aria-hidden="true" style={{ display: "contents" }}>{row("b")}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
