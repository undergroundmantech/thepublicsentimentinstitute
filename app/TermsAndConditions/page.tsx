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
    <>
      <style>{`
        body { background: #070709 !important; margin: 0; }

        .tc-wrap {
          max-width: 1280px;
          margin: 0 auto;
          padding: 32px 32px 80px;
        }
        @media(max-width: 768px) { .tc-wrap { padding: 20px 16px 60px; } }

        /* ── Breadcrumb ── */
        .tc-breadcrumb {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: var(--font-body), monospace;
          font-size: 9px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.25);
          margin-bottom: 32px;
        }
        .tc-breadcrumb a {
          color: rgba(255,255,255,0.25);
          text-decoration: none;
          transition: color 100ms;
        }
        .tc-breadcrumb a:hover { color: #9d5cf0; }
        .tc-breadcrumb-sep { color: rgba(255,255,255,0.1); }

        /* ── Hero ── */
        .tc-hero {
          border: 1px solid rgba(255,255,255,0.08);
          background: #0f0f15;
          padding: 48px 52px 40px;
          margin-bottom: 20px;
          position: relative;
          overflow: hidden;
        }
        @media(max-width: 768px) { .tc-hero { padding: 28px 20px; } }

        .tc-hero::before {
          content: '';
          position: absolute;
          top: -60px; right: -60px;
          width: 260px; height: 260px;
          background: radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%);
          pointer-events: none;
        }

        .tc-hero-inner {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 40px;
          align-items: end;
        }
        @media(max-width: 768px) { .tc-hero-inner { grid-template-columns: 1fr; gap: 20px; } }

        .tc-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: var(--font-body), monospace;
          font-size: 9px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.3);
          margin-bottom: 16px;
        }
        .tc-eyebrow-sep { color: rgba(255,255,255,0.12); }

        .tc-headline {
          font-family: var(--font-display), sans-serif;
          font-size: clamp(40px, 5.5vw, 72px);
          letter-spacing: 0.03em;
          line-height: 0.95;
          color: #fff;
          margin-bottom: 16px;
          position: relative;
          z-index: 1;
          text-transform: uppercase;
        }

        .tc-desc {
          font-family: var(--font-body), monospace;
          font-size: 10px;
          color: rgba(255,255,255,0.28);
          line-height: 1.8;
          max-width: 560px;
          letter-spacing: 0.04em;
          position: relative;
          z-index: 1;
        }

        .tc-hero-meta {
          display: flex;
          flex-direction: column;
          gap: 10px;
          align-items: flex-end;
        }
        @media(max-width: 768px) { .tc-hero-meta { align-items: flex-start; } }

        .tc-meta-item {
          text-align: right;
        }
        @media(max-width: 768px) { .tc-meta-item { text-align: left; } }

        .tc-meta-label {
          font-family: var(--font-body), monospace;
          font-size: 8px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.15);
          margin-bottom: 2px;
        }

        .tc-meta-val {
          font-family: var(--font-body), monospace;
          font-size: 10px;
          font-weight: 500;
          color: rgba(255,255,255,0.4);
          letter-spacing: 0.06em;
        }

        /* ── Layout ── */
        .tc-layout {
          display: grid;
          grid-template-columns: 220px 1fr;
          gap: 20px;
          align-items: start;
        }
        @media(max-width: 900px) { .tc-layout { grid-template-columns: 1fr; } }

        /* ── Sticky TOC ── */
        .tc-toc {
          position: sticky;
          top: 24px;
          border: 1px solid rgba(255,255,255,0.06);
          background: #0f0f15;
          overflow: hidden;
        }
        @media(max-width: 900px) { .tc-toc { display: none; } }

        .tc-toc-header {
          padding: 12px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: #0b0b0f;
          font-family: var(--font-body), monospace;
          font-size: 8px;
          font-weight: 500;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.2);
        }

        .tc-toc-item {
          display: block;
          padding: 9px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          font-family: var(--font-body), monospace;
          font-size: 9px;
          letter-spacing: 0.06em;
          color: rgba(255,255,255,0.25);
          text-decoration: none;
          transition: color 100ms, background 100ms;
          line-height: 1.4;
        }
        .tc-toc-item:last-child { border-bottom: none; }
        .tc-toc-item:hover { color: #9d5cf0; background: rgba(124,58,237,0.04); text-decoration: none; }
        .tc-toc-item.active { color: #9d5cf0; border-left: 2px solid #9d5cf0; padding-left: 14px; background: rgba(124,58,237,0.04); }

        /* ── Accordion sections ── */
        .tc-sections {
          display: flex;
          flex-direction: column;
          gap: 1px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.06);
        }

        .tc-section {
          background: #0f0f15;
        }

        .tc-section-trigger {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 24px;
          cursor: pointer;
          background: none;
          border: none;
          text-align: left;
          gap: 16px;
          transition: background 80ms;
        }
        .tc-section-trigger:hover { background: rgba(255,255,255,0.02); }

        .tc-section-num {
          font-family: var(--font-body), monospace;
          font-size: 9px;
          letter-spacing: 0.16em;
          color: rgba(255,255,255,0.18);
          flex-shrink: 0;
          width: 28px;
        }

        .tc-section-title {
          font-family: var(--font-body), monospace;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.06em;
          color: rgba(255,255,255,0.7);
          flex: 1;
          line-height: 1.4;
        }

        .tc-section-arrow {
          font-size: 10px;
          color: rgba(255,255,255,0.2);
          flex-shrink: 0;
          transition: transform 200ms, color 100ms;
        }
        .tc-section-arrow.open {
          transform: rotate(90deg);
          color: #9d5cf0;
        }

        .tc-section-body {
          overflow: hidden;
          max-height: 0;
          transition: max-height 300ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        .tc-section-body.open { max-height: 2000px; }

        .tc-section-content {
          padding: 0 24px 24px 52px;
          font-family: var(--font-body), monospace;
          font-size: 10px;
          color: rgba(255,255,255,0.35);
          line-height: 1.9;
          letter-spacing: 0.04em;
          white-space: pre-wrap;
          border-top: 1px solid rgba(255,255,255,0.04);
          margin-left: 0;
        }
        .tc-section-content p { margin: 0 0 10px; }

        /* ── Contact card ── */
        .tc-contact {
          margin-top: 20px;
          border: 1px solid rgba(255,255,255,0.06);
          background: #0f0f15;
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          padding: 20px 28px;
          gap: 24px;
        }
        @media(max-width: 768px) { .tc-contact { grid-template-columns: 1fr; } }

        .tc-contact-left {}

        .tc-contact-eyebrow {
          font-family: var(--font-body), monospace;
          font-size: 8px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.2);
          margin-bottom: 6px;
        }

        .tc-contact-title {
          font-family: var(--font-display), sans-serif;
          font-size: 24px;
          letter-spacing: 0.04em;
          color: rgba(255,255,255,0.7);
          line-height: 1;
          margin-bottom: 4px;
          text-transform: uppercase;
        }

        .tc-contact-text {
          font-family: var(--font-body), monospace;
          font-size: 9px;
          color: rgba(255,255,255,0.2);
          letter-spacing: 0.06em;
          line-height: 1.65;
        }

        .tc-contact-text a {
          color: #9d5cf0;
          text-decoration: none;
        }
        .tc-contact-text a:hover { text-decoration: underline; }

        .tc-btn-outline {
          display: inline-flex;
          align-items: center;
          padding: 10px 20px;
          background: transparent;
          color: rgba(255,255,255,0.35);
          font-family: var(--font-body), monospace;
          font-size: 9px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          text-decoration: none;
          border: 1px solid rgba(255,255,255,0.1);
          transition: border-color 120ms, color 120ms;
          white-space: nowrap;
        }
        .tc-btn-outline:hover { border-color: rgba(255,255,255,0.35); color: rgba(255,255,255,0.65); text-decoration: none; }

        /* ── Strip ── */
        .tc-strip {
          margin-top: 20px;
          display: grid;
          grid-template-columns: repeat(3,1fr);
          gap: 1px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.06);
        }
        @media(max-width: 768px) { .tc-strip { grid-template-columns: 1fr; } }

        .tc-strip-item {
          background: #0f0f15;
          padding: 18px 22px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .tc-strip-label {
          font-family: var(--font-body), monospace;
          font-size: 8px;
          font-weight: 500;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.18);
        }

        .tc-strip-val {
          font-family: var(--font-display), sans-serif;
          font-size: 20px;
          letter-spacing: 0.04em;
          color: rgba(255,255,255,0.5);
          line-height: 1;
          text-transform: uppercase;
        }

        .tc-strip-sub {
          font-family: var(--font-body), monospace;
          font-size: 9px;
          color: rgba(255,255,255,0.18);
          letter-spacing: 0.04em;
        }
      `}</style>

      <div className="tc-wrap">

        {/* Breadcrumb */}
        <div className="tc-breadcrumb">
          <Link href="/">PSI</Link>
          <span className="tc-breadcrumb-sep">—</span>
          <span>Privacy Policy &amp; Terms</span>
        </div>

        {/* Hero */}
        <div className="tc-hero">
          <div className="tc-hero-inner">
            <div>
              <div className="tc-eyebrow">
                <span className="tc-eyebrow-sep">—</span>
                <span>Legal</span>
                <span className="tc-eyebrow-sep">·</span>
                <span>The Public Sentiment Institute</span>
              </div>
              <h1 className="tc-headline">
                Privacy Policy<br />&amp; Terms and<br />Conditions
              </h1>
              <p className="tc-desc">
                This policy has been compiled to better serve those who are concerned with how their
                Personally Identifiable Information (PII) is being used. Please read carefully to get
                a clear understanding of how we collect, use, protect, and handle your information.
              </p>
            </div>
            <div className="tc-hero-meta">
              <div className="tc-meta-item">
                <div className="tc-meta-label">Last Edited</div>
                <div className="tc-meta-val">2025</div>
              </div>
              <div className="tc-meta-item">
                <div className="tc-meta-label">Jurisdiction</div>
                <div className="tc-meta-val">United States</div>
              </div>
              <div className="tc-meta-item">
                <div className="tc-meta-label">Sections</div>
                <div className="tc-meta-val">{SECTIONS.length}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Layout */}
        <div className="tc-layout">

          {/* Sticky TOC */}
          <nav className="tc-toc">
            <div className="tc-toc-header">Table of Contents</div>
            {SECTIONS.map((s, i) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={`tc-toc-item${activeId === s.id ? " active" : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveId(activeId === s.id ? null : s.id);
                  const el = document.getElementById(s.id);
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                {String(i + 1).padStart(2, "0")} · {s.title.length > 34 ? s.title.slice(0, 34) + "…" : s.title}
              </a>
            ))}
          </nav>

          {/* Accordion */}
          <div className="tc-sections">
            {SECTIONS.map((s, i) => {
              const isOpen = activeId === s.id;
              return (
                <div key={s.id} id={s.id} className="tc-section">
                  <button
                    className="tc-section-trigger"
                    onClick={() => toggle(s.id)}
                    aria-expanded={isOpen}
                  >
                    <span className="tc-section-num">{String(i + 1).padStart(2, "0")}</span>
                    <span className="tc-section-title">{s.title}</span>
                    <span className={`tc-section-arrow${isOpen ? " open" : ""}`}>▶</span>
                  </button>
                  <div className={`tc-section-body${isOpen ? " open" : ""}`}>
                    <div className="tc-section-content">{s.content}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Contact */}
        <div className="tc-contact">
          <div className="tc-contact-left">
            <div className="tc-contact-eyebrow">Questions?</div>
            <div className="tc-contact-title">Contact Us</div>
            <div className="tc-contact-text">
              The Public Sentiment Institute · United States<br />
              <a href="mailto:tpsinstitutecontact@gmail.com">tpsinstitutecontact@gmail.com</a>
            </div>
          </div>
          <Link href="/sms-optin" className="tc-btn-outline">
            SMS Sign-Up →
          </Link>
        </div>

        {/* Strip */}
        <div className="tc-strip">
          {[
            { label: "Data Policy", val: "No Sale", sub: "PII not sold or traded to third parties" },
            { label: "Breach Notice", val: "1 Business Day", sub: "Email + on-site notification guaranteed" },
            { label: "Opt-Out", val: "Anytime", sub: "Reply STOP · Unsubscribe link in all emails" },
          ].map(item => (
            <div key={item.label} className="tc-strip-item">
              <div className="tc-strip-label">{item.label}</div>
              <div className="tc-strip-val">{item.val}</div>
              <div className="tc-strip-sub">{item.sub}</div>
            </div>
          ))}
        </div>

      </div>
    </>
  );
}