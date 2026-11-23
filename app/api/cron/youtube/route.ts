// Every 30 minutes: look for a new video on the On Point YouTube channel and alert everyone who asked for videos.
// The first run only remembers the latest video, so nobody gets an alert for an old one.
import { NextResponse } from "next/server";
import { getJson, putJson, adminOk } from "@/app/lib/community/store";
import { notify } from "@/app/lib/community/alerts";
import { SOCIAL } from "@/app/lib/offers";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
type St = { channelId?: string; last?: string; at?: string };

async function channelId(st: St) {
  if (process.env.YOUTUBE_CHANNEL_ID) return process.env.YOUTUBE_CHANNEL_ID;
  if (st.channelId) return st.channelId;
  const html = await (await fetch(SOCIAL.youtube, { headers: { "User-Agent": "Mozilla/5.0 OnPointAlerts" } })).text();
  return html.match(/"channelId":"(UC[\w-]{22})"/)?.[1] ?? html.match(/channel\/(UC[\w-]{22})/)?.[1] ?? null;
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization"); const key = new URL(req.url).searchParams.get("key");
  if (!(process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) && !adminOk(key)) return new Response("Not found", { status: 404 });
  const st = (await getJson<St>("alerts/state/youtube.json")) ?? {};
  const cid = await channelId(st); if (!cid) return NextResponse.json({ ok: false, error: "could not find the channel id; set YOUTUBE_CHANNEL_ID" }, { status: 500 });
  const xml = await (await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${cid}`, { cache: "no-store" })).text();
  const entry = xml.split("<entry>")[1]; if (!entry) return NextResponse.json({ ok: true, note: "no videos in the feed" });
  const vid = entry.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/)?.[1]; const title = (entry.match(/<title>([^<]*)<\/title>/)?.[1] ?? "New video").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  if (!vid) return NextResponse.json({ ok: true, note: "no video id" });
  if (!st.last) { await putJson("alerts/state/youtube.json", { channelId: cid, last: vid, at: new Date().toISOString() }); return NextResponse.json({ ok: true, primed: vid }); }
  if (st.last === vid) return NextResponse.json({ ok: true, unchanged: vid });
  const url = `https://www.youtube.com/watch?v=${vid}`;
  const r = await notify("videos", `yt-${vid}`, { subject: `New video: ${title}`, text: "A new On Point Politics video just went up. Watch it now and drop your take in the comments.", url, cta: "Watch the video", sms: `New video: ${title} ${url}` });
  await putJson("alerts/state/youtube.json", { channelId: cid, last: vid, at: new Date().toISOString() });
  return NextResponse.json({ ok: true, video: vid, title, ...r });
}
