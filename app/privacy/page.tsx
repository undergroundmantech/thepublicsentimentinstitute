import Link from "@/app/components/Link";
import { seo } from "@/app/lib/seo";
import "../analysis/analysis.css";

export const metadata = seo({
  title: "Privacy policy",
  description: "How On Point Politics and On Point Polling collect, use and protect information, including cookies, analytics and third party advertising from Google, and how to opt out.",
  path: "/privacy",
});

const UPDATED = "November 10, 2026";
const EMAIL = "onpointpoliticscontact@gmail.com";

export default function Page() {
  return (
    <div className="opp an">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><span>Privacy policy</span></nav>
      <article className="an-art">
        <header className="ph">
          <div className="eye g">Legal</div>
          <h1>Privacy <em>policy</em></h1>
          <p className="lede">
            This policy explains what information On Point Politics collects when you use onpointpolitics.us, how we use it, who we share it with, and the choices you have.
            On Point Politics is published by The Public Sentiment Institute, doing business as On Point Polling.
          </p>
          <div className="pmeta"><span>Last updated <b>{UPDATED}</b></span><span>Applies to <b>onpointpolitics.us</b></span></div>
        </header>
        <div className="an-prose">
          <h2 id="collect">Information we collect</h2>
          <p><b>Information you give us.</b> When you contact us, request a quote, sign up for a newsletter or text messages, subscribe to The Weighting Room or take part in a survey, we collect what you provide, such as your name, email address, phone number, organization and message.</p>
          <p><b>Information collected automatically.</b> Like most websites, our servers and the services we use record standard technical information when you visit: your IP address, browser and device type, the pages you view, the page that referred you and the time of your visit. Some of this is collected with cookies and similar technologies, described below.</p>
          <p><b>Survey responses.</b> Responses to On Point Polling surveys are used for research and are reported only in aggregate. We never publish an individual respondent&apos;s answers in a way that identifies them.</p>

          <h2 id="use">How we use information</h2>
          <ul>
            <li>To run, secure and improve the site and understand which pages and tools are useful.</li>
            <li>To answer your messages, prepare quotes and deliver services you request.</li>
            <li>To send newsletters or text messages you have opted into. You can unsubscribe at any time.</li>
            <li>To show advertising that helps pay for the site, as described in the next section.</li>
            <li>To comply with the law and protect the rights and safety of our users and of On Point Polling.</li>
          </ul>

          <h2 id="advertising">Advertising and Google AdSense</h2>
          <p>
            This site uses Google AdSense to show advertising. Third party vendors, including Google, use cookies to serve ads based on your prior visits to this website and to other websites.
            Google&apos;s use of advertising cookies enables it and its partners to serve ads to you based on your visits to this site and other sites on the internet.
          </p>
          <ul>
            <li>You can opt out of personalized advertising from Google by visiting <a href="https://adssettings.google.com" rel="noopener" target="_blank">Google Ads Settings</a>.</li>
            <li>You can opt out of many third party vendors&apos; use of cookies for personalized advertising at <a href="https://www.aboutads.info/choices" rel="noopener" target="_blank">aboutads.info/choices</a> and, in the European Union, <a href="https://www.youronlinechoices.eu" rel="noopener" target="_blank">youronlinechoices.eu</a>.</li>
            <li>Google explains how it uses information from sites that use its services at <a href="https://policies.google.com/technologies/partner-sites" rel="noopener" target="_blank">policies.google.com/technologies/partner-sites</a>.</li>
          </ul>
          <p>If you opt out you will still see ads, but they will not be personalized based on your browsing. Where the law requires consent for advertising cookies, such as in the European Economic Area, the United Kingdom and Switzerland, we ask for it before personalized ads are shown.</p>

          <h2 id="cookies">Cookies and analytics</h2>
          <p>
            Cookies are small files a website stores in your browser. We use them to remember preferences, such as a saved game in Campaign 2028 or a chosen map view, to measure traffic,
            and to support advertising. We use Google Analytics to understand how visitors use the site. Google Analytics collects information such as the pages you visit and how long you stay,
            and reports it to us in aggregate. You can install the <a href="https://tools.google.com/dlpage/gaoptout" rel="noopener" target="_blank">Google Analytics opt out browser add on</a>,
            and you can block or delete cookies in your browser settings at any time. Some features, such as saved games, may not work without them.
          </p>

          <h2 id="sharing">How we share information</h2>
          <p>
            We do not sell your personal information. We share information only with service providers that help us run the site and our business, such as hosting, analytics,
            email, text messaging and advertising providers, under terms that limit how they can use it; when the law requires it; or to protect our rights and the safety of others.
            Phone numbers and text message consent collected for our text program are never shared with third parties for their own marketing.
          </p>

          <h2 id="rights">Your choices and rights</h2>
          <p>
            You can ask us to access, correct or delete the personal information we hold about you, and to stop sending you messages, by emailing <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
            Residents of California and other states with consumer privacy laws have the right to know what personal information is collected, to request deletion, to correct it,
            and to opt out of the sale or sharing of personal information for targeted advertising. We do not sell personal information. To opt out of personalized advertising,
            use the Google and industry links above. We will not discriminate against you for exercising these rights.
          </p>
          <p>Text STOP to any On Point Polling text message to stop receiving them, and use the unsubscribe link at the bottom of any email.</p>

          <h2 id="children">Children</h2>
          <p>The site is intended for adults. We do not knowingly collect personal information from children under 13. If you believe a child has given us information, contact us and we will delete it.</p>

          <h2 id="security">Security and retention</h2>
          <p>The site is served over an encrypted connection. We keep personal information only as long as we need it for the purposes above or as required by law, and we take reasonable steps to protect it.</p>

          <h2 id="changes">Changes to this policy</h2>
          <p>When we change this policy we update the date at the top of the page. Significant changes will be noted on the site.</p>

          <h2 id="contact">Contact</h2>
          <p>
            The Public Sentiment Institute, doing business as On Point Polling, Miami, Florida, United States. Email <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
            Our <Link href="/terms">terms and conditions and mobile terms</Link> are on a separate page.
          </p>
        </div>
      </article>
    </div>
  );
}
