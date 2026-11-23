// The consulting intake form. Each request is stored and, when Resend is set up, emailed to the desk.
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { putJson, storeReady } from "@/app/lib/community/store";
import { sendPlain } from "@/app/lib/community/mailer";

export const dynamic = "force-dynamic";
const F = ["name", "email", "org", "role", "race", "need", "budget", "when", "notes"] as const;
export async function POST(req: Request) {
  if (!storeReady()) return NextResponse.json({ ok: false, error: "The form is not switched on yet. Email info@publicsentimentinstitute.com instead." }, { status: 503 });
  let b: Record<string, unknown>; try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 }); }
  if (b.website) return NextResponse.json({ ok: true });
  const r = Object.fromEntries(F.map((k) => [k, String(b[k] ?? "").trim().slice(0, k === "notes" ? 2000 : 200)])) as Record<(typeof F)[number], string>;
  if (!r.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) return NextResponse.json({ ok: false, error: "Add your name and a working email." }, { status: 400 });
  if (!r.need) return NextResponse.json({ ok: false, error: "Pick what you need." }, { status: 400 });
  const at = new Date().toISOString(); const id = at.slice(0, 10) + "-" + crypto.randomBytes(4).toString("hex");
  await putJson(`intake/${id}.json`, { ...r, at });
  const text = F.map((k) => `${k}: ${r[k]}`).join("\n");
  await sendPlain(process.env.INTAKE_TO || "info@publicsentimentinstitute.com", `New consulting request: ${r.need} from ${r.name}${r.org ? `, ${r.org}` : ""}`, text, r.email).catch(() => null);
  return NextResponse.json({ ok: true, id });
}
