// Every On Point email goes out here, through the Resend SDK with the key from RESEND_API_KEY and the On Point template.
import { Resend } from "resend";
import { EmailTemplate, type EmailTemplateProps } from "@/app/components/email/EmailTemplate";

export const FROM = process.env.ALERTS_FROM || "On Point Politics <alerts@onpointpolitics.us>";
let client: Resend | null = null;
const resend = () => (process.env.RESEND_API_KEY ? (client ??= new Resend(process.env.RESEND_API_KEY)) : null);

/** send one templated email; returns "sent", "skipped" when no key is set, or the error message */
export async function sendTemplated(to: string, subject: string, p: EmailTemplateProps, o: { idempotencyKey?: string; replyTo?: string; text?: string } = {}) {
  const r = resend(); if (!r) return "skipped";
  const { error } = await r.emails.send({
    from: FROM, to: [to], subject, react: EmailTemplate(p), replyTo: o.replyTo ?? process.env.ALERTS_REPLY_TO,
    text: o.text ?? `${p.body}\n\n${p.url}${p.unsubscribe ? `\n\nUnsubscribe: ${p.unsubscribe}` : ""}`,
    headers: p.unsubscribe ? { "List-Unsubscribe": `<${p.unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : undefined,
  }, o.idempotencyKey ? { idempotencyKey: o.idempotencyKey.slice(0, 256) } : undefined);
  return error ? `error ${error.name}: ${error.message}` : "sent";
}

/** a plain text email to the desk, such as a new consulting request */
export async function sendPlain(to: string, subject: string, text: string, replyTo?: string) {
  const r = resend(); if (!r) return "skipped";
  const { error } = await r.emails.send({ from: FROM, to: [to], subject, text, replyTo });
  return error ? `error ${error.name}: ${error.message}` : "sent";
}
