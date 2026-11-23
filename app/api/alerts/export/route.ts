// The subscriber list as a CSV for the text platform, behind the admin key: /api/alerts/export?key=...&channel=sms
import { allSubs } from "@/app/lib/community/alerts";
import { adminOk } from "@/app/lib/community/store";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const u = new URL(req.url); if (!adminOk(u.searchParams.get("key"))) return new Response("Not found", { status: 404 });
  const ch = u.searchParams.get("channel");
  const rows = (await allSubs()).filter((s) => s.active && (ch === "sms" ? !!s.phone : ch === "email" ? !!s.email : true));
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = ["email,phone,topics,sms_consent_at,signed_up,source", ...rows.map((s) => [s.email, s.phone, s.topics.join(" "), s.sms?.at, s.created, s.from].map(q).join(","))].join("\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="onpoint-alerts-${ch ?? "all"}.csv"`, "Cache-Control": "no-store" } });
}
