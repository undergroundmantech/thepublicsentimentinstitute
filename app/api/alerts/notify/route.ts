// Send an alert by hand, behind the admin key: a new poll, a majority tracker change or a forecast update.
// POST /api/alerts/notify?key=...  {"topic":"polls","id":"poll-2026-12-01","subject":"...","text":"...","url":"...","sms":"..."}
import { NextResponse } from "next/server";
import { notify } from "@/app/lib/community/alerts";
import { adminOk } from "@/app/lib/community/store";
import { TOPICS, type Topic } from "@/app/lib/offers";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function POST(req: Request) {
  const u = new URL(req.url); if (!adminOk(u.searchParams.get("key"))) return new Response("Not found", { status: 404 });
  const b = await req.json().catch(() => null) as { topic?: string; id?: string; subject?: string; text?: string; url?: string; sms?: string; cta?: string } | null;
  if (!b || !TOPICS.some((t) => t.k === b.topic) || !b.id || !b.subject || !b.url) return NextResponse.json({ ok: false, error: "topic, id, subject and url are required" }, { status: 400 });
  const r = await notify(b.topic as Topic, b.id, { subject: b.subject, text: b.text ?? "", url: b.url, cta: b.cta ?? "Open it", sms: b.sms ?? `${b.subject} ${b.url}` });
  return NextResponse.json({ ok: true, ...r });
}
