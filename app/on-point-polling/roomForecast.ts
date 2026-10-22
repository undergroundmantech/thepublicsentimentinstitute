// The forecast margin for every race On Point Polling has polled, so the polling room can show both side by side.
import { getModel } from "@/app/lib/forecastData";
import { raceHref } from "@/app/lib/opp";
import { STATE_POLLS } from "./polls/pollMapData";
import type { RoomForecast } from "./PollingRoom";

export function roomForecast(): RoomForecast {
  const races = getModel().races, out: RoomForecast = {};
  for (const p of STATE_POLLS) {
    const sen = races.find((r) => r.id === `sen-${p.st}`), gov = races.find((r) => r.id === `gov-${p.st}`);
    out[p.st] = { ...(sen ? { Senate: { m: sen.est.margin, href: raceHref(sen.id) } } : {}), ...(gov ? { Governor: { m: gov.est.margin, href: raceHref(gov.id) } } : {}) };
  }
  return out;
}
