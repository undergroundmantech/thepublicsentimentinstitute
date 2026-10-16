import type { Metadata } from "next";
import Link from "next/link";
import fs from "fs";
import path from "path";

export const metadata: Metadata = {
  title: "Interactive maps",
  description: "The forecast map, the early vote tracker, the electoral map, party registration and voter registration, state by state and county by county.",
  alternates: { canonical: "/maps" },
};

// Server rendered. Every mini map is drawn from the same files the full maps
// read, so the thumbnails always match the data behind them.

type Geo = { frame: [number, number]; states: Record<string, string> };
type Race = { office: string; st: string; est: { margin: number } };
type Model = {
  meta: { updated: string; daysOut: number };
  chambers: Record<string, { demControl: number; gopControl: number; demSeats: number; gopSeats: number; seatsTotal: number }>;
  races: Race[];
};
type Elect = {
  nation: { turnout: number; modeShare: { mail: number; early: number; eday: number } };
  states: Record<string, { turnout: number; margin24: number; modeShare: { mail: number; early: number; eday: number } }>;
  counties: Record<string, unknown>;
};
type Reg = {
  national_total: number;
  national_party: { DEM: number; REP: number; UNA: number; OTH: number };
  states: { abbr: string; total: number; registers_by_party: boolean; party: { DEM: number; REP: number } | null }[];
};

function readJson<T>(rel: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", rel), "utf8")) as T;
  } catch {
    return null;
  }
}

// Positive margins are Republican, negative Democratic, in points.
function leanFill(m: number | null | undefined): string {
  if (m == null || !Number.isFinite(m)) return "var(--mm-none)";
  const pct = Math.round(10 + 90 * Math.pow(Math.min(Math.abs(m), 40) / 40, 0.8));
  return `color-mix(in srgb, var(${m > 0 ? "--mm-r" : "--mm-d"}) ${pct}%, var(--mm-even))`;
}
function seqFill(t: number | null | undefined): string {
  if (t == null || !Number.isFinite(t)) return "var(--mm-none)";
  const pct = Math.round(8 + 92 * Math.max(0, Math.min(1, t)));
  return `color-mix(in srgb, var(--mm-v) ${pct}%, var(--mm-even))`;
}

function MiniMap({ geo, fill, label }: { geo: Geo; fill: (st: string) => string; label: string }) {
  const [w, h] = geo.frame;
  return (
    <svg className="mm-map" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
      {Object.entries(geo.states).map(([st, d]) => (
        <path key={st} d={d} style={{ fill: fill(st) }} />
      ))}
    </svg>
  );
}

const fmtM = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n.toLocaleString("en-US"));
const pct0 = (x: number) => `${Math.round(x * 100)}%`;

function Chev() {
  return <i className="mm-chev" aria-hidden="true" />;
}

export default function Page() {
  const geo = readJson<Geo>("forecast/geo.json");
  const model = readJson<Model>("forecast/model.json");
  const elect = readJson<Elect>("earlyvote-electorate.json");
  const reg = readJson<Reg>("voterreg/summary.json");

  // Forecast: the Senate race where there is one, otherwise the governor race.
  const fc: Record<string, number> = {};
  for (const r of model?.races ?? []) if (r.office === "governor" && fc[r.st] == null) fc[r.st] = r.est.margin;
  for (const r of model?.races ?? []) if (r.office === "senate") fc[r.st] = r.est.margin;

  const regBy: Record<string, Reg["states"][number]> = {};
  for (const s of reg?.states ?? []) regBy[s.abbr] = s;
  const maxLogReg = Math.max(1, ...(reg?.states ?? []).map((s) => Math.log10(Math.max(1, s.total))));
  const minLogReg = Math.min(maxLogReg, ...(reg?.states ?? []).filter((s) => s.total > 0).map((s) => Math.log10(s.total)));

  const ch = model?.chambers;
  const ns = elect?.nation;
  const partyStates = (reg?.states ?? []).filter((s) => s.registers_by_party).length;
  const np = reg?.national_party;
  const regLead = np ? ((np.DEM - np.REP) / Math.max(1, np.DEM + np.REP)) * 100 : null;

  const odds = (k: string) => (ch?.[k] ? Math.max(ch[k].demControl, ch[k].gopControl) : null);
  const side = (k: string) => (ch?.[k] ? (ch[k].demControl >= ch[k].gopControl ? "d" : "r") : "n");

  const cards = [
    {
      href: "/maps/electoral",
      eye: "2024 baseline",
      t: "Electoral map",
      s: "Paint every state and build your own path to 270, or to Senate and governor control.",
      stat: "538",
      statL: "electoral votes",
      fill: (st: string) => leanFill(elect?.states[st]?.margin24),
      leg: ["R+40", "even", "D+40"],
      cta: "Build a map",
    },
    {
      href: "/maps/party-registration",
      eye: `${partyStates} states by party`,
      t: "Party registration",
      s: "Which party leads the voter rolls in every state and county that registers by party.",
      stat: regLead == null ? "n/a" : `${regLead >= 0 ? "D" : "R"}+${Math.abs(regLead).toFixed(1)}`,
      statL: "national two party lead",
      fill: (st: string) => {
        const s = regBy[st];
        if (!s || !s.registers_by_party || !s.party) return "var(--mm-none)";
        const two = s.party.DEM + s.party.REP;
        return two > 0 ? leanFill(((s.party.REP - s.party.DEM) / two) * 100) : "var(--mm-none)";
      },
      leg: ["R lead", "even", "D lead"],
      cta: "See the rolls",
    },
    {
      href: "/maps/voter-registration",
      eye: "State reports",
      t: "Voter registration",
      s: "Registered voter totals by state and county, straight from each state's own reports.",
      stat: reg ? fmtM(reg.national_total) : "n/a",
      statL: "registered voters",
      fill: (st: string) => {
        const s = regBy[st];
        if (!s || !(s.total > 0)) return "var(--mm-none)";
        return seqFill((Math.log10(s.total) - minLogReg) / Math.max(0.01, maxLogReg - minLogReg));
      },
      leg: ["fewer", "", "more"],
      cta: "Explore totals",
    },
  ];

  return (
    <div className="opp mm">
      <style>{CSS}</style>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span className="sep">/</span>
        <span>Maps</span>
      </nav>

      <header className="ph mm-head">
        <div>
          <div className="eye g">Interactive maps</div>
          <h1>
            Every map, <em>one place</em>
          </h1>
          <p className="lede">The forecast, the early vote and the voter rolls, state by state and county by county.</p>
        </div>
        <dl className="mm-strip">
          <div>
            <dt>Days out</dt>
            <dd className="mono">{model?.meta.daysOut ?? "n/a"}</dd>
          </div>
          <div>
            <dt>Races modeled</dt>
            <dd className="mono">{model?.races.length ?? "n/a"}</dd>
          </div>
          <div>
            <dt>Counties</dt>
            <dd className="mono">{elect ? Object.keys(elect.counties).length.toLocaleString("en-US") : "n/a"}</dd>
          </div>
          <div>
            <dt>Model updated</dt>
            <dd className="mono">{model?.meta.updated ?? "n/a"}</dd>
          </div>
        </dl>
      </header>

      <section className="mm-feat" aria-label="Featured maps">
        <article className="card mm-card mm-big">
          <Link href="/forecast" className="mm-hit" aria-label="Open the forecast map" />
          <div className="mm-top">
            <span className="mm-eye">
              <i className="mm-live" aria-hidden="true" /> Live model
            </span>
            <span className="mm-tag mono">2026</span>
          </div>
          <h2 className="mm-t">Forecast map</h2>
          <p className="mm-s">The 2026 model for the Senate, House and governors, down to the county, rerun every day.</p>
          <div className="mm-art">{geo && <MiniMap geo={geo} fill={(st) => leanFill(fc[st])} label="Forecast margins by state" />}</div>
          <div className="mm-odds">
            {(["senate", "house", "governor"] as const).map((k) => (
              <Link key={k} href={`/forecast?office=${k}`} className={`mm-odd ${side(k)}`}>
                <span className="k">{k === "governor" ? "Governors" : k === "house" ? "House" : "Senate"}</span>
                <span className="v mono">{odds(k) == null ? "n/a" : pct0(odds(k) as number)}</span>
                <span className="w">{side(k) === "d" ? "Dem control" : side(k) === "r" ? "GOP control" : ""}</span>
                <Chev />
              </Link>
            ))}
          </div>
          <div className="mm-foot">
            <Legend l={["R+40", "even", "D+40"]} />
            <Link href="/forecast" className="mm-go g">
              Open forecast <Chev />
            </Link>
          </div>
        </article>

        <article className="card mm-card mm-big">
          <Link href="/maps/early-vote" className="mm-hit" aria-label="Open the early vote tracker" />
          <div className="mm-top">
            <span className="mm-eye">
              <i className="mm-live" aria-hidden="true" /> Updated daily
            </span>
            <span className="mm-tag mono">Ballots</span>
          </div>
          <h2 className="mm-t">Early vote tracker</h2>
          <p className="mm-s">Mail and in person early ballots by state and county, with a party lead estimate where states report none.</p>
          <div className="mm-art">
            {geo && (
              <MiniMap
                geo={geo}
                fill={(st) => {
                  const m = elect?.states[st]?.modeShare;
                  return m ? seqFill(m.mail + m.early) : "var(--mm-none)";
                }}
                label="Expected share of ballots cast before Election Day"
              />
            )}
          </div>
          <div className="mm-odds">
            <div className="mm-odd n">
              <span className="k">Expected ballots</span>
              <span className="v mono">{ns ? fmtM(ns.turnout) : "n/a"}</span>
              <span className="w">nationwide</span>
            </div>
            <div className="mm-odd n">
              <span className="k">By mail</span>
              <span className="v mono">{ns ? pct0(ns.modeShare.mail) : "n/a"}</span>
              <span className="w">of all ballots</span>
            </div>
            <div className="mm-odd n">
              <span className="k">Early in person</span>
              <span className="v mono">{ns ? pct0(ns.modeShare.early) : "n/a"}</span>
              <span className="w">of all ballots</span>
            </div>
          </div>
          <div className="mm-foot">
            <Legend l={["less early", "", "more early"]} seq />
            <Link href="/maps/early-vote" className="mm-go g">
              Open tracker <Chev />
            </Link>
          </div>
        </article>
      </section>

      <section className="mm-grid" aria-label="More maps">
        {cards.map((c) => (
          <article key={c.href} className="card mm-card">
            <Link href={c.href} className="mm-hit" aria-label={`Open ${c.t.toLowerCase()}`} />
            <div className="mm-top">
              <span className="mm-eye">{c.eye}</span>
            </div>
            <div className="mm-art sm">{geo && <MiniMap geo={geo} fill={c.fill} label={c.t} />}</div>
            <h2 className="mm-t sm">{c.t}</h2>
            <p className="mm-s">{c.s}</p>
            <div className="mm-foot">
              <div className="mm-stat">
                <b className="mono">{c.stat}</b>
                <span>{c.statL}</span>
              </div>
              <Link href={c.href} className="mm-go">
                {c.cta} <Chev />
              </Link>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function Legend({ l, seq }: { l: string[]; seq?: boolean }) {
  return (
    <div className="mm-leg" aria-hidden="true">
      <span>{l[0]}</span>
      <i className={seq ? "seq" : "div"} />
      <span>{l[2]}</span>
    </div>
  );
}

const CSS = `
:root { --mm-d:#2152d6; --mm-r:#c8352b; --mm-even:#d4d0de; --mm-none:rgba(150,144,170,.34); --mm-v:#8c5cff; --mm-stroke:rgba(10,7,17,.55); }
:root[data-theme="light"] { --mm-d:#1f4fd1; --mm-r:#c63a2c; --mm-even:#eceaf1; --mm-none:rgba(120,114,140,.18); --mm-v:#6d3ae0; --mm-stroke:rgba(255,255,255,.9); }

.mm .mm-head { display:flex; flex-wrap:wrap; align-items:flex-end; justify-content:space-between; gap:20px 32px; }
.mm .mm-strip { display:grid; grid-template-columns:repeat(4, auto); gap:0; margin:0; border:1px solid var(--line); border-radius:14px; background:var(--glass); overflow:hidden; }
.mm .mm-strip > div { padding:10px 18px; border-left:1px solid var(--line); }
.mm .mm-strip > div:first-child { border-left:0; }
.mm .mm-strip dt { font:700 10.5px var(--font-b); letter-spacing:.14em; text-transform:uppercase; color:var(--mute); }
.mm .mm-strip dd { margin:4px 0 0; font:700 18px var(--font-m); font-variant-numeric:tabular-nums; color:var(--hi); }

.mm .mm-feat { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:18px; margin-bottom:18px; }
.mm .mm-grid { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:18px; }

.mm .mm-card { position:relative; display:flex; flex-direction:column; gap:10px; padding:20px 22px; border-radius:18px; isolation:isolate;
  transition: transform .22s cubic-bezier(.2,.7,.2,1), box-shadow .22s, border-color .22s; }
.mm .mm-card::before { content:""; position:absolute; inset:0; border-radius:inherit; padding:1px; background:var(--grad); opacity:0;
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude;
  transition: opacity .22s; pointer-events:none; z-index:2; }
.mm .mm-card:hover, .mm .mm-card:focus-within { transform:translateY(-3px); box-shadow:var(--shadow-md, 0 12px 32px rgba(0,0,0,.4)); }
.mm .mm-card:hover::before, .mm .mm-card:focus-within::before { opacity:1; }
.mm .mm-hit { position:absolute; inset:0; z-index:1; border-radius:inherit; }
.mm .mm-hit:focus-visible { outline:2px solid var(--ind); outline-offset:3px; }
.mm .mm-card a:not(.mm-hit) { position:relative; z-index:3; }

.mm .mm-top { display:flex; align-items:center; justify-content:space-between; gap:10px; }
.mm .mm-eye { display:inline-flex; align-items:center; gap:8px; font:700 11px var(--font-b); letter-spacing:.16em; text-transform:uppercase; color:var(--mute); }
.mm .mm-live { width:7px; height:7px; border-radius:50%; background:var(--win); box-shadow:0 0 0 0 color-mix(in srgb, var(--win) 60%, transparent); animation:mmPulse 2.4s ease-out 3; }
@keyframes mmPulse { 0% { box-shadow:0 0 0 0 color-mix(in srgb, var(--win) 55%, transparent); } 100% { box-shadow:0 0 0 9px transparent; } }
.mm .mm-tag { font:700 11px var(--font-m); letter-spacing:.08em; color:var(--ink2); padding:4px 9px; border-radius:999px; border:1px solid var(--line2); background:var(--glass2); }

.mm .mm-t { margin:2px 0 0; font:800 26px/1.1 var(--font-d); letter-spacing:-.03em; color:var(--hi); }
.mm .mm-t.sm { font-size:19px; margin-top:4px; }
.mm .mm-s { margin:0; color:var(--ink2); font-size:14px; line-height:1.5; max-width:60ch; }

.mm .mm-art { position:relative; margin:4px -4px 2px; aspect-ratio: 975 / 560; max-width:100%; display:grid; place-items:center;
  border-radius:12px; background:radial-gradient(120% 90% at 50% 40%, rgba(var(--line-rgb),.05), transparent 70%); overflow:hidden; }
.mm .mm-art.sm { aspect-ratio: 975 / 600; margin-top:6px; }
.mm .mm-map { width:100%; height:100%; display:block; transition: transform .5s cubic-bezier(.2,.7,.2,1); }
.mm .mm-map path { stroke:var(--mm-stroke); stroke-width:.9; stroke-linejoin:round; transition: opacity .2s; }
.mm .mm-card:hover .mm-map { transform:scale(1.025); }

.mm .mm-odds { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:8px; }
.mm .mm-odd { position:relative; display:grid; gap:2px; padding:10px 12px; border-radius:12px; border:1px solid var(--line); background:var(--glass2); text-decoration:none; color:inherit; transition: border-color .18s, background .18s, transform .18s; }
.mm .mm-odd .k { font:700 10.5px var(--font-b); letter-spacing:.12em; text-transform:uppercase; color:var(--mute); }
.mm .mm-odd .v { font:700 22px var(--font-m); font-variant-numeric:tabular-nums; color:var(--hi); }
.mm .mm-odd .w { font-size:12px; color:var(--ink2); }
.mm .mm-odd.d .v { color:var(--dem); }
.mm .mm-odd.r .v { color:var(--gop); }
.mm a.mm-odd { cursor:pointer; padding-right:28px; }
.mm a.mm-odd .mm-chev { position:absolute; right:12px; top:50%; margin-top:-4px; opacity:.5; transition: transform .18s, opacity .18s; }
.mm a.mm-odd:hover { border-color:var(--line2); background:rgba(var(--line-rgb),.08); transform:translateY(-1px); }
.mm a.mm-odd:hover .mm-chev { opacity:1; transform:translateX(2px) rotate(-45deg); }
.mm a.mm-odd:focus-visible { outline:2px solid var(--ind); outline-offset:2px; }

.mm .mm-foot { margin-top:auto; padding-top:8px; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.mm .mm-stat { display:grid; gap:1px; }
.mm .mm-stat b { font:700 20px var(--font-m); font-variant-numeric:tabular-nums; color:var(--hi); }
.mm .mm-stat span { font-size:12px; color:var(--mute); }

.mm .mm-go { display:inline-flex; align-items:center; gap:9px; padding:9px 16px; border-radius:999px; font:700 13px var(--font-b); text-decoration:none;
  border:1px solid var(--line2); background:var(--glass2); color:var(--hi); transition: transform .18s, box-shadow .18s, background .18s, border-color .18s; white-space:nowrap; }
.mm .mm-go:hover { border-color:var(--hi); transform:translateY(-1px); }
.mm .mm-go.g { border:0; background:var(--grad); background-size:160% 100%; color:#fff; box-shadow:var(--shadow-grad); }
.mm .mm-go.g:hover { background-position:100% 0; box-shadow:0 10px 34px rgba(131,68,156,.5); }
.mm .mm-go:focus-visible { outline:2px solid var(--ind); outline-offset:3px; }
.mm .mm-chev { display:inline-block; width:7px; height:7px; border-right:2px solid currentColor; border-bottom:2px solid currentColor; transform:rotate(-45deg); transition: transform .18s; }
.mm .mm-go:hover .mm-chev { transform:translateX(3px) rotate(-45deg); }

.mm .mm-leg { display:inline-flex; align-items:center; gap:8px; font:700 10.5px var(--font-m); letter-spacing:.06em; text-transform:uppercase; color:var(--mute); }
.mm .mm-leg i { display:inline-block; width:96px; height:8px; border-radius:999px; }
.mm .mm-leg i.div { background:linear-gradient(90deg, var(--mm-r), var(--mm-even), var(--mm-d)); }
.mm .mm-leg i.seq { background:linear-gradient(90deg, var(--mm-even), var(--mm-v)); }

@media (max-width: 1080px) { .mm .mm-grid { grid-template-columns:repeat(2, minmax(0,1fr)); } }
@media (max-width: 860px) {
  .mm .mm-feat, .mm .mm-grid { grid-template-columns:minmax(0,1fr); }
  .mm .mm-strip { grid-template-columns:repeat(2, minmax(0,1fr)); width:100%; }
  .mm .mm-strip > div:nth-child(3) { border-left:0; }
  .mm .mm-strip > div:nth-child(n+3) { border-top:1px solid var(--line); }
}
@media (max-width: 480px) {
  .mm .mm-card { padding:16px; }
  .mm .mm-odds { grid-template-columns:minmax(0,1fr); }
  .mm .mm-t { font-size:22px; }
}
@media (prefers-reduced-motion: reduce) {
  .mm .mm-card, .mm .mm-map, .mm .mm-go, .mm .mm-odd, .mm .mm-chev { transition:none; }
  .mm .mm-card:hover, .mm .mm-card:focus-within { transform:none; }
  .mm .mm-card:hover .mm-map { transform:none; }
  .mm .mm-live { animation:none; }
}
`;
