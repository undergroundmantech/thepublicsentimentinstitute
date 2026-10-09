"use client";

import Link from "next/link";
import { useState } from "react";

const SECTIONS = [
  {
    id: "what-we-collect",
    title: "What Personal Information Do We Collect?",
    content: `When registering on our site, as appropriate, you may be asked to enter your name, email address, mailing address, phone number, or other details to help you with your experience.`,
  },
  {
    id: "when-we-collect",
    title: "When Do We Collect Information?",
    content: `We collect information from you when you register on our site, subscribe to a newsletter, respond to a survey, fill out a form, or enter information on our site.`,
  },
  {
    id: "how-we-use",
    title: "How Do We Use Your Information?",
    content: `We may use the information we collect from you when you register, sign up for our newsletter, respond to a survey or polling communication, surf the website, or use certain other site features in the following ways:\n\n· To improve our website in order to better serve you.\n· To allow us to better service you in responding to your customer service requests.\n· To administer a survey, poll, or other research feature.\n· To send periodic emails regarding your participation or other information and services.\n\nWe do not share, trade, or sell the data collected on our website, except as required by law.`,
  },
  {
    id: "protection",
    title: "How Do We Protect Visitor Information?",
    content: `We use vulnerability scanning and PCI-standard scanning. We use malware scanning. We use an SSL certificate to ensure your data is transmitted securely.`,
  },
  {
    id: "cookies",
    title: "Do We Use Cookies?",
    content: `Yes. Cookies are small files that a site or its service provider transfers to your computer's hard drive through your Web browser (if you allow) that enable the site's or service provider's systems to recognize your browser and capture and remember certain information. We use cookies to help us understand your preferences based on previous or current site activity, which enables us to provide you with improved services. We also use cookies to help us compile aggregate data about site traffic and site interaction so that we can offer better site experiences and tools in the future.\n\nWe use cookies to:\n\n· Understand and save user preferences for future visits.\n· Compile aggregate data about site traffic and site interactions in order to offer better site experiences and tools in the future.\n\nYou can choose to have your computer warn you each time a cookie is being sent, or you can choose to turn off all cookies through your browser settings. If you disable cookies, some features may be disabled; however, you can still use the site.`,
  },
  {
    id: "third-party",
    title: "Third Party Disclosure",
    content: `We do not sell, trade, or otherwise transfer to outside parties your personally identifiable information unless we provide you with advance notice. This does not include website hosting partners and other parties who assist us in operating our website, conducting our business, or servicing you, so long as those parties agree to keep this information confidential. We may also release your information when we believe release is appropriate to comply with the law, enforce our site policies, or protect ours or others' rights, property, or safety.\n\nWe do not share, trade, or sell the data collected on our website, except as required by law.`,
  },
  {
    id: "caloppa",
    title: "California Online Privacy Protection Act (CalOPPA)",
    content: `CalOPPA is the first state law in the nation to require commercial websites and online services to post a privacy policy. We agree to the following:\n\n· Users can visit our site anonymously.\n· Once this privacy policy is created, we will add a link to it on our home page or on the first significant page after entering our website.\n· Our Privacy Policy link includes the word "Privacy" and can easily be found on the page specified above.\n· Users will be notified of any privacy policy changes on our Privacy Policy page.\n· Users are able to change their personal information by emailing us or calling us.`,
  },
  {
    id: "dnt",
    title: "Do Not Track Signals",
    content: `We honor Do Not Track signals and do not track, plant cookies, or use advertising when a Do Not Track (DNT) browser mechanism is in place.`,
  },
  {
    id: "coppa",
    title: "COPPA (Children's Online Privacy Protection Act)",
    content: `We do not specifically market to children under 13 years of age.`,
  },
  {
    id: "fair-info",
    title: "Fair Information Practices",
    content: `In order to be in line with Fair Information Practices, should a data breach occur, we will notify users via email within 1 business day and via on-site notification within 1 business day. We also agree to the individual redress principle, which requires that individuals have a right to pursue legally enforceable rights against data collectors and processors who fail to adhere to the law.`,
  },
  {
    id: "can-spam",
    title: "CAN-SPAM Act",
    content: `We collect your email address in order to send information, respond to inquiries, and/or other requests or questions, and to communicate with you about surveys and research. In accordance with CAN-SPAM, we agree to:\n\n· Not use false or misleading subjects or email addresses.\n· Identify the message as an advertisement in some reasonable way.\n· Include the physical address of our business or site headquarters.\n· Monitor third-party email marketing services for compliance, if one is used.\n· Honor opt-out/unsubscribe requests quickly.\n· Allow users to unsubscribe by using the link at the bottom of each email.`,
  },
  {
    id: "mobile-tos",
    title: "Mobile Terms of Service",
    content: `The Public Sentiment Institute mobile message service (the "Service") is operated by The Public Sentiment Institute ("PSI," "we," or "us"). Your use of the Service constitutes your agreement to these terms and conditions ("Mobile Terms"). We may modify or cancel the Service or any of its features without notice. To the extent permitted by applicable law, we may also modify these Mobile Terms at any time and your continued use of the Service following the effective date of any such changes shall constitute your acceptance of such changes.\n\nBy consenting to The Public Sentiment Institute's SMS/text messaging service, you agree to receive recurring SMS/text messages from and on behalf of The Public Sentiment Institute through your wireless provider to the mobile number you provided, even if your mobile number is registered on any state or federal Do Not Call list. Text messages may be sent using an automatic telephone dialing system or other technology. Messages may include polling surveys, research questionnaires, updates, and information related to our research programs.\n\nYou understand that you do not have to sign up for this program in order to participate in any research activity, and your consent is not a condition of any purchase or participation with The Public Sentiment Institute. Your participation in this program is completely voluntary.\n\nWe do not charge for the Service, but you are responsible for all charges and fees associated with text messaging imposed by your wireless provider. Message frequency varies. Message and data rates may apply. Check your mobile plan and contact your wireless provider for details. You are solely responsible for all charges related to SMS/text messages, including charges from your wireless provider.\n\nYou may opt-out of the Service at any time. Text the single keyword command STOP to our number or click the unsubscribe link (where available) in any text message to cancel. You'll receive a one-time opt-out confirmation text message. No further messages will be sent to your mobile device, unless initiated by you.\n\nFor Service support or assistance, text HELP to our number or email us at tpsinstitutecontact@gmail.com.\n\nWe may change any short code or telephone number we use to operate the Service at any time and will notify you of these changes. You acknowledge that any messages, including any STOP or HELP requests, you send to a short code or telephone number we have changed may not be received and we will not be responsible for honoring requests made in such messages.\n\nThe wireless carriers supported by the Service are not liable for delayed or undelivered messages. You agree to provide us with a valid mobile number. If you get a new mobile number, you will need to sign up for the program with your new number.\n\nTo the extent permitted by applicable law, you agree that we will not be liable for failed, delayed, or misdirected delivery of any information sent through the Service, any errors in such information, and/or any action you may or may not take in reliance on the information or Service.`,
  },
  {
    id: "unsubscribe",
    title: "Unsubscribing from Email",
    content: `If at any time you would like to unsubscribe from receiving future emails, follow the instructions at the bottom of each email and we will promptly remove you from all correspondence.`,
  },
  {
    id: "contact",
    title: "Contacting Us",
    content: `If there are any questions regarding this privacy policy, you may contact us using the information below:\n\nThe Public Sentiment Institute\nThe United States\ntpsinstitutecontact@gmail.com`,
  },
];

export default function TermsPage() {
  const [activeId, setActiveId] = useState<string | null>(null);

  function toggle(id: string) {
    setActiveId(prev => (prev === id ? null : id));
  }

  return (
    <div className="opp tc">
      <style>{`
        .tc .tc-sec { border-top: 1px solid var(--line); scroll-margin-top: 140px; }
        .tc .tc-sec:first-child { border-top: 0; }
        .tc .tc-trigger { width: 100%; display: grid; grid-template-columns: 34px 1fr auto; gap: 12px; align-items: center; padding: 14px 18px; background: none; border: 0; color: var(--ink); cursor: pointer; text-align: left; transition: background .15s; }
        .tc .tc-trigger:hover, .tc .tc-sec.open .tc-trigger { background: var(--glass2); }
        .tc .tc-trigger:focus-visible { outline: 2px solid var(--hi); outline-offset: -2px; }
        .tc .tc-num { font: 700 12px var(--font-m); color: var(--mute); }
        .tc .tc-title { font: 700 15px var(--font-b); }
        .tc .tc-tog { font: 700 10.5px var(--font-m); letter-spacing: .1em; text-transform: uppercase; color: var(--mute); }
        .tc .tc-body { padding: 4px 18px 18px 64px; font-size: 14px; line-height: 1.7; color: var(--ink2); white-space: pre-line; max-width: 80ch; }
        .tc .tc-toc { display: grid; padding: 6px 0; max-height: calc(100vh - 220px); overflow-y: auto; }
        .tc .tc-toc a { display: grid; grid-template-columns: 26px 1fr; gap: 6px; padding: 6px 18px; font-size: 12.5px; color: var(--ink2); transition: background .15s; }
        .tc .tc-toc a span:first-child { font-family: var(--font-m); color: var(--mute2); font-size: 11.5px; }
        .tc .tc-toc a:hover, .tc .tc-toc a.on { background: var(--glass2); color: var(--hi); }
        .tc .tc-sticky { position: sticky; top: 130px; display: grid; gap: 16px; }
        @media (max-width: 960px) { .tc .tc-sticky { position: static; } .tc .tc-toc { max-height: none; } }
        @media (max-width: 600px) { .tc .tc-body { padding-left: 18px; } }
      `}</style>

      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><span>Privacy policy and terms</span></nav>
      <header className="ph">
        <div className="eye g">Legal</div>
        <h1>Privacy policy and <em>terms</em></h1>
        <p className="lede">
          This policy has been compiled to better serve those who are concerned with how their
          Personally Identifiable Information (PII) is being used. Please read carefully to get
          a clear understanding of how we collect, use, protect, and handle your information.
        </p>
        <div className="pmeta">
          <span>Site <b>OnPoint Politics</b></span>
          <span>Operated with <b>The Public Sentiment Institute</b></span>
          <span>Last edited <b className="mono">2025</b></span>
          <span>Jurisdiction <b>United States</b></span>
          <span>Sections <b className="mono">{SECTIONS.length}</b></span>
        </div>
      </header>

      <div className="layout">
        <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
          <div className="card">
            <div className="card-h"><h3>Privacy Policy &amp; Terms and Conditions</h3><span className="eye" style={{ marginLeft: "auto" }}>Select a section</span></div>
            <div>
              {SECTIONS.map((s, i) => {
                const isOpen = activeId === s.id;
                return (
                  <div key={s.id} id={s.id} className={`tc-sec${isOpen ? " open" : ""}`}>
                    <button className="tc-trigger" onClick={() => toggle(s.id)} aria-expanded={isOpen} aria-controls={`${s.id}-body`}>
                      <span className="tc-num">{String(i + 1).padStart(2, "0")}</span>
                      <span className="tc-title">{s.title}</span>
                      <span className="tc-tog" aria-hidden="true">{isOpen ? "Hide" : "Read"}</span>
                    </button>
                    {isOpen && <div className="tc-body" id={`${s.id}-body`}>{s.content}</div>}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="grid3">
            {[
              { label: "Data policy", val: "No Sale", sub: "PII not sold or traded to third parties" },
              { label: "Breach notice", val: "1 Business Day", sub: "Email + on-site notification guaranteed" },
              { label: "Opt out", val: "Anytime", sub: "Reply STOP · Unsubscribe link in all emails" },
            ].map(item => (
              <div key={item.label} className="card tile">
                <span className="eye">{item.label}</span>
                <span className="v" style={{ fontSize: 22 }}>{item.val}</span>
                <span className="s">{item.sub}</span>
              </div>
            ))}
          </div>
        </div>

        <aside className="side">
          <div className="tc-sticky">
            <nav className="card" aria-label="Table of contents">
              <div className="card-h"><h3>Contents</h3></div>
              <div className="tc-toc">
                {SECTIONS.map((s, i) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className={activeId === s.id ? "on" : ""}
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveId(activeId === s.id ? null : s.id);
                      const el = document.getElementById(s.id);
                      if (el) el.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
                    }}
                  >
                    <span>{String(i + 1).padStart(2, "0")}</span><span>{s.title}</span>
                  </a>
                ))}
              </div>
            </nav>
            <div className="card"><div className="card-b">
              <div className="eye">Questions?</div>
              <h3 style={{ fontSize: 18, margin: "8px 0 6px" }}>Contact us</h3>
              <p style={{ fontSize: 13.5 }}>
                The Public Sentiment Institute · United States<br />
                <a href="mailto:tpsinstitutecontact@gmail.com" style={{ textDecoration: "underline" }}>tpsinstitutecontact@gmail.com</a>
              </p>
              <Link href="/tpsi/sms" className="btn" style={{ marginTop: 12 }}>SMS sign up</Link>
            </div></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
