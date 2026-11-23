// The On Point email: a header band, a headline, a short body, one button and the unsubscribe line. Email clients
// ignore stylesheets, so every style is inline and the layout is a single table column.
import * as React from "react";

export interface EmailTemplateProps { firstName?: string; title: string; body: string; url: string; cta: string; unsubscribe?: string; eyebrow?: string }

export function EmailTemplate({ firstName, title, body, url, cta, unsubscribe, eyebrow = "On Point Politics" }: EmailTemplateProps) {
  return (
    <div style={{ backgroundColor: "#efebe2", padding: "24px 12px", fontFamily: "Arial, Helvetica, sans-serif", color: "#141218" }}>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ maxWidth: 560, margin: "0 auto", backgroundColor: "#ffffff", border: "2px solid #141218", borderRadius: 14 }}>
        <tbody>
          <tr><td style={{ backgroundColor: "#110019", borderRadius: "12px 12px 0 0", padding: "18px 24px" }}>
            <span style={{ color: "#ffffff", fontSize: 20, fontWeight: 800, letterSpacing: 0.5 }}>ON POINT</span>
            <span style={{ color: "#b9a7ff", fontSize: 11, fontWeight: 700, letterSpacing: 3, marginLeft: 8 }}>POLITICS</span>
          </td></tr>
          <tr><td style={{ padding: "24px 24px 8px" }}>
            <p style={{ margin: "0 0 8px", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#6b5fa8", fontWeight: 700 }}>{eyebrow}</p>
            <h1 style={{ margin: "0 0 12px", fontSize: 22, lineHeight: "28px" }}>{firstName ? `${firstName}, ${title.charAt(0).toLowerCase()}${title.slice(1)}` : title}</h1>
            <p style={{ margin: "0 0 20px", fontSize: 15, lineHeight: "24px", color: "#3a3640" }}>{body}</p>
            <a href={url} style={{ display: "inline-block", backgroundColor: "#6d28d9", color: "#ffffff", textDecoration: "none", fontWeight: 700, fontSize: 15, padding: "12px 20px", borderRadius: 10 }}>{cta}</a>
          </td></tr>
          <tr><td style={{ padding: "24px", fontSize: 12, lineHeight: "18px", color: "#777777" }}>
            You asked for On Point alerts at onpointpolitics.us.{unsubscribe ? <> <a href={unsubscribe} style={{ color: "#777777" }}>Unsubscribe</a></> : null}<br />
            On Point Politics LLC · Miami, Florida
          </td></tr>
        </tbody>
      </table>
    </div>
  );
}
export default EmailTemplate;
