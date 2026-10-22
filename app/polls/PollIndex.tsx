import { AGGREGATES, buildAggregate, type AggregateDef } from "@/app/_polling/lib/aggregates";
import { AGG_GROUPS, pollHref, PRIMARIES } from "./registry";
import PollIndexView, { type PSection, type PTile } from "./PollIndexView";

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

const COLOR: Record<string, string> = { d: "#7fa6ff", r: "#ff8399", i: "#c9a8ff", "": "#c9c2d6" };

export default function PollIndex({ groups, title, lede, crumb }: { groups: string[]; title: React.ReactNode; lede: string; crumb?: string }) {
  const sections = AGG_GROUPS.filter((g) => groups.includes(g.key)).map((g) => ({ ...g, rows: rows(g.test) })).filter((g) => g.rows.length);
  const total = sections.reduce((a, s) => a + s.rows.length, 0);
  const latest = AGGREGATES.reduce((m, d) => d.polls.reduce((mm, p) => (p.endDate > mm ? p.endDate : mm), m), "");
  const cut = latest ? new Date(new Date(latest + "T00:00:00").getTime() - 7 * 864e5).toISOString().slice(0, 10) : "";
  const tile = (r: Row): PTile => ({ id: r.def.id, label: r.def.label, href: r.href, value: r.value, cls: r.cls, n: r.n, updated: r.updated, spark: r.spark,
    net: buildAggregate(r.def).latest?.net ?? null, fresh: r.def.polls.filter((p) => p.endDate > cut).length, color: COLOR[r.cls] ?? COLOR[""] });
  const secs: PSection[] = sections.map((s) => ({ key: s.key, title: s.title, tiles: s.rows.map(tile) }));
  const national = secs.find((s) => s.key === "national")?.tiles ?? [];
  return (
    <PollIndexView sections={secs.filter((s) => s.key !== "national")} national={national} title={title} lede={lede} crumb={crumb} total={total}
      primaries={groups.includes("primaries") ? Object.entries(PRIMARIES).map(([k, v]) => ({ href: `/polls/${k}`, title: v.title })) : undefined} />
  );
}
