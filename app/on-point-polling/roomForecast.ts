// The forecast margin for every race On Point Polling has polled, so the polling room can show both side by side.
import { getModel } from "@/app/lib/forecastData";
import { raceHref } from "@/app/lib/opp";
import { STATE_POLLS } from "./polls/pollMapData";
import type { RoomForecast } from "./PollingRoom";

export function roomForecast(): RoomForecast {
  const races = getModel().races, out: RoomForecast = {};
  for (const p of STATE_POLLS) {
    const sen = races.find((r) => r.id === `sen-${p.st}`), gov = races.find((r) => r.id === `gov-${p.st}`);
    const pl = (r: typeof sen) => (r?.polls ?? []).slice(0, 30).map((x) => [x.age, Math.round(x.margin * 10) / 10, x.n || 600, x.pollster.startsWith("On Point") ? 1 : 0] as [number, number, number, number]);
    out[p.st] = { ...(sen ? { Senate: { m: sen.est.margin, href: raceHref(sen.id), pl: pl(sen) } } : {}), ...(gov ? { Governor: { m: gov.est.margin, href: raceHref(gov.id), pl: pl(gov) } } : {}) };
  }
  return out;
}
