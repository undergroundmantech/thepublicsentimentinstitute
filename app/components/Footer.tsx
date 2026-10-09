import Link from "next/link";
import { Lockup } from "./opp/Logo";

const COLS = [
  { h: "Polls", links: [
    ["/polls/approval", "Trump approval"], ["/polls/generic-ballot", "Generic ballot"], ["/polls/senate", "Senate"],
    ["/polls/governor", "Governor"], ["/polls/2028", "2028 primary"], ["/polls", "All averages"],
  ] },
  { h: "Forecast", links: [
    ["/forecast?office=senate", "Senate"], ["/forecast?office=house", "House"], ["/forecast?office=governor", "Governor"],
    ["/forecast/methodology", "Methodology"], ["/forecast/changelog", "Changelog"],
  ] },
  { h: "Results", links: [
    ["/results/live", "Live desk"], ["/results/archive", "Archive"], ["/maps/electoral", "Electoral map"],
    ["/maps/party-registration", "Party registration"], ["/maps/early-vote", "Early vote"],
  ] },
  { h: "TPSI", links: [
    ["/tpsi", "About"], ["/tpsi/polls", "TPSI polls"], ["/tpsi/services", "Partner with us"],
    ["/tpsi/weighting-room", "The Weighting Room"], ["/portal/login", "Client portal"], ["/contact", "Contact"],
  ] },
] as const;

export default function Footer() {
  return (
    <footer className="opp">
      <div className="foot">
        <div className="wrap">
          <div className="cols">
            <div>
              <div className="fbrand"><Lockup height={40} /></div>
              <p style={{ margin: 0, maxWidth: "40ch", color: "var(--mute)" }}>
                Polling averages, election forecasts and live results. Fieldwork and modeling by The Public Sentiment Institute, Miami.
              </p>
            </div>
            {COLS.map((c) => (
              <div key={c.h}>
                <h4>{c.h}</h4>
                <ul>{c.links.map(([href, label]) => <li key={href + label}><Link href={href}>{label}</Link></li>)}</ul>
              </div>
            ))}
          </div>
          <div className="bottom">
            <span>© 2026 OnPoint Politics and The Public Sentiment Institute</span>
            <span><Link href="/terms">Terms</Link> · <Link href="/terms#privacy">Privacy</Link> · <Link href="/tpsi/sms">SMS opt in</Link></span>
          </div>
        </div>
      </div>
    </footer>
  );
}
