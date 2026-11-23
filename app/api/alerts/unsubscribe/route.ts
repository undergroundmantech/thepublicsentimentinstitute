import { unsubscribe } from "@/app/lib/community/alerts";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const u = new URL(req.url); const ok = await unsubscribe(u.searchParams.get("id") ?? "", u.searchParams.get("t") ?? "");
  const msg = ok ? "You're unsubscribed from On Point alerts. You won't get more emails or texts from this list." : "That unsubscribe link didn't work. Reply STOP to any text, or write to info@publicsentimentinstitute.com and we'll take you off.";
  return new Response(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>On Point alerts</title><body style="font-family:Arial,sans-serif;max-width:520px;margin:60px auto;padding:0 20px;color:#141218"><h1 style="font-size:22px">On Point alerts</h1><p>${msg}</p><p><a href="/">Back to On Point Politics</a></p></body>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
