import { NextResponse } from "next/server";
import { upsertSub } from "@/app/lib/community/alerts";
import { storeReady } from "@/app/lib/community/store";

export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  if (!storeReady()) return NextResponse.json({ ok: false, error: "Signups are not switched on yet. Please try again soon." }, { status: 503 });
  let b: { email?: string; phone?: string; topics?: string[]; smsConsent?: boolean; from?: string; website?: string; form?: string; name?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 }); }
  if (b.website) return NextResponse.json({ ok: true });              // a bot filled the hidden field
  const r = await upsertSub({ email: b.email, phone: b.phone, topics: Array.isArray(b.topics) ? b.topics.map(String) : [], smsConsent: !!b.smsConsent, from: String(b.from ?? "site"), form: b.form, name: b.name });
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
