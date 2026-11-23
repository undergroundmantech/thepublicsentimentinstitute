// Alert subscribers and the senders that reach them. Email goes out through Resend and texts through Twilio when their
// keys are set; with no keys the list still grows and can be exported as a CSV for the Horizon text program.
import { getJson, hid, listKeys, putJson, sign } from "./store";
import { TOPICS, type Topic } from "../offers";
import { sendTemplated } from "./mailer";

export interface Sub {
  id: string; email?: string; phone?: string; topics: Topic[]; active: boolean; from: string; created: string; updated: string;
  sms?: { consent: true; text: string; at: string }; name?: string;
}
import { SMS_CONSENT, SMS_CONSENT_PAGE } from "../offers";
export { SMS_CONSENT, SMS_CONSENT_PAGE };
export const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://onpointpolitics.us";

export const normEmail = (e?: string | null) => { const s = (e ?? "").trim().toLowerCase(); return /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/.test(s) ? s : ""; };
export const normPhone = (p?: string | null) => { const d = (p ?? "").replace(/\D/g, ""); const n = d.length === 11 && d.startsWith("1") ? d.slice(1) : d; return n.length === 10 && !/^[01]/.test(n) ? "+1" + n : ""; };
const keyOf = (id: string) => `alerts/subs/${id}.json`;
export const unsubUrl = (id: string) => `${SITE}/api/alerts/unsubscribe?id=${id}&t=${sign(id)}`;

export async function upsertSub(input: { email?: string; phone?: string; topics: string[]; smsConsent: boolean; from: string; form?: string; name?: string }) {
  const email = normEmail(input.email), phone = normPhone(input.phone);
  if (!email && !phone) return { ok: false as const, error: "Enter an email address or a mobile number." };
  if (phone && !input.smsConsent) return { ok: false as const, error: "Check the box to agree to text messages, or leave the phone number blank." };
  const topics = TOPICS.map((t) => t.k).filter((k) => input.topics.includes(k)) as Topic[];
  if (!topics.length) return { ok: false as const, error: "Pick at least one thing to hear about." };
  const id = hid(email || phone); const now = new Date().toISOString();
  const old = await getJson<Sub>(keyOf(id));
  const sub: Sub = { id, email: email || old?.email, phone: phone || old?.phone, topics, active: true, from: input.from.slice(0, 80), created: old?.created ?? now, updated: now,
    sms: phone ? { consent: true, text: input.form === "sms" ? SMS_CONSENT_PAGE : SMS_CONSENT, at: now } : old?.sms, name: (input.name ?? "").trim().slice(0, 60) || old?.name };
  await putJson(keyOf(id), sub);
  // a welcome on each new channel: the confirmation text the SMS program promises, and a hello email with the unsubscribe link
  const welcome: Promise<unknown>[] = [];
  if (phone && (!old?.phone || old.phone !== phone || !old.active)) welcome.push(sendSms(phone, "On Point Polling (TPSI): You're signed up for On Point alerts on new videos, polls and forecast updates. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to cancel."));
  if (email && (!old?.email || !old.active)) welcome.push(sendEmail(email, { subject: "You're on the On Point list", text: "You'll get an email the moment a new On Point video goes up, a new poll drops or the forecast moves, depending on what you picked. In the meantime, the 2028 forecast and the majority tracker are live on the site.", url: `${SITE}/2028`, cta: "Open the 2028 forecast" }, id, "welcome"));
  await Promise.allSettled(welcome);
  return { ok: true as const, id, channels: { email: !!sub.email, sms: !!sub.phone } };
}

export async function unsubscribe(id: string, t: string) {
  if (!/^[a-f0-9]{32}$/.test(id) || t !== sign(id)) return false;
  const s = await getJson<Sub>(keyOf(id)); if (!s) return false;
  await putJson(keyOf(id), { ...s, active: false, updated: new Date().toISOString() }); return true;
}

export async function allSubs(): Promise<Sub[]> {
  const keys = (await listKeys("alerts/subs/")).filter((k) => k.endsWith(".json"));
  const out: Sub[] = [];
  for (let i = 0; i < keys.length; i += 20) {
    const got = await Promise.all(keys.slice(i, i + 20).map((k) => getJson<Sub>(k)));
    for (const s of got) if (s) out.push(s);
  }
  return out;
}

async function sendEmail(to: string, m: { subject: string; text: string; url: string; cta: string }, id: string, key?: string) {
  return sendTemplated(to, m.subject, { title: m.subject, body: m.text, url: m.url, cta: m.cta, unsubscribe: unsubUrl(id) }, { idempotencyKey: key ? `${key}/${id}` : undefined });
}

async function sendSms(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID, tok = process.env.TWILIO_AUTH_TOKEN; if (!sid || !tok) return "skipped";
  const f = new URLSearchParams({ To: to, Body: body });
  if (process.env.TWILIO_MESSAGING_SERVICE_SID) f.set("MessagingServiceSid", process.env.TWILIO_MESSAGING_SERVICE_SID); else if (process.env.TWILIO_FROM) f.set("From", process.env.TWILIO_FROM); else return "skipped";
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, { method: "POST", headers: { Authorization: "Basic " + Buffer.from(`${sid}:${tok}`).toString("base64") }, body: f });
  return r.ok ? "sent" : `error ${r.status}`;
}

/** send one alert to everyone who picked its topic, once: a repeat of the same alert id is refused */
export async function notify(topic: Topic, alertId: string, m: { subject: string; text: string; url: string; cta: string; sms: string }) {
  const logKey = `alerts/sends/${alertId.replace(/[^a-z0-9_-]/gi, "-").slice(0, 120)}.json`;
  if (await getJson(logKey)) return { already: true, email: 0, sms: 0 };
  const subs = (await allSubs()).filter((s) => s.active && s.topics.includes(topic));
  let email = 0, sms = 0; const errors: string[] = [];
  for (const s of subs) {
    if (s.email) { const r = await sendEmail(s.email, m, s.id, `alert-${alertId}`); if (r === "sent") email++; else if (r !== "skipped") errors.push(r); }
    if (s.phone && s.sms?.consent) { const r = await sendSms(s.phone, `On Point Polling (TPSI): ${m.sms} Reply STOP to opt out.`); if (r === "sent") sms++; else if (r !== "skipped") errors.push(r); }
  }
  await putJson(logKey, { topic, alertId, at: new Date().toISOString(), subject: m.subject, url: m.url, audience: subs.length, email, sms, errors: errors.slice(0, 20) });
  return { already: false, audience: subs.length, email, sms, errors: errors.length };
}
