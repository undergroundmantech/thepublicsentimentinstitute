// A test send of the On Point template, for checking Resend after setup. It needs the admin key, so nobody else can
// use the site to send mail: POST /api/send?key=ADMIN_KEY with an optional JSON body { "to": "you@example.com" }.
// With no address it goes to Resend's test inbox, delivered@resend.dev.
import { sendTemplated } from "@/app/lib/community/mailer";
import { adminOk } from "@/app/lib/community/store";

export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const u = new URL(req.url);
  if (!adminOk(u.searchParams.get("key") ?? req.headers.get("x-admin-key"))) return Response.json({ error: "Not allowed." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { to?: string };
  const to = b.to && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.to) ? b.to : "delivered@resend.dev";
  const r = await sendTemplated(to, "On Point email test", { title: "Your On Point emails work", body: "This is a test of the On Point alert email. If you can read this, Resend and your domain are set up.", url: "https://onpointpolitics.us/2028", cta: "Open the 2028 forecast", eyebrow: "Setup test" }, { idempotencyKey: `test/${Date.now()}` });
  return Response.json({ to, result: r }, { status: r === "sent" ? 200 : 500 });
}
