// IndexNow: tells Bing, and the engines that share its index (DuckDuckGo, Yahoo, Ecosia and others), which pages
// changed, so the early vote, forecast and results pages are recrawled within minutes instead of days. Run by the
// Vercel cron in vercel.json every six hours; the key file it names is public/c7c79cadea6e7e8a1e9cc08c7650a65e.txt.
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { SITE } from "@/app/lib/seo";
import { STN } from "@/app/results/2026/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const KEY = "c7c79cadea6e7e8a1e9cc08c7650a65e";

function authorized(req: Request) {
  const s = process.env.CRON_SECRET; if (!s) return true;
  return req.headers.get("authorization") === `Bearer ${s}`;
}
const slug = (st: string) => (STN[st] ?? st).toLowerCase().replace(/[^a-z]+/g, "-");

function urls(): string[] {
  const out = new Set<string>(["/", "/forecast", "/maps/early-vote", "/results/2026", "/results/monitor", "/polls", "/polls/generic-ballot", "/polls/approval", "/what-if", "/swingometer", "/forecast/legislatures", "/forecast/measures", "/forecast/statewide"]);
  try {
    const races = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/results/2026/index.json"), "utf8")).races as { id: string; k: string; st: string }[];
    for (const r of races) {
      out.add(`/results/2026/${slug(r.st)}`); out.add(`/maps/early-vote/${slug(r.st)}`);
      const s = r.st.toLowerCase();
      if (r.k === "sen") { out.add(`/forecast/${s}/senate`); out.add(`/results/2026/${r.id}`); }
      if (r.k === "gov") { out.add(`/forecast/${s}/governor`); out.add(`/results/2026/${r.id}`); }
    }
  } catch { /* the core list still goes */ }
  return [...out].map((p) => `${SITE.url}${p}`);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const host = new URL(SITE.url).host;
  const list = urls();
  const r = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST", headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host, key: KEY, keyLocation: `${SITE.url}/${KEY}.txt`, urlList: list }),
  }).catch((e) => ({ ok: false, status: 0, statusText: String(e) } as Response));
  return NextResponse.json({ submitted: list.length, status: r.status, ok: r.ok });
}
