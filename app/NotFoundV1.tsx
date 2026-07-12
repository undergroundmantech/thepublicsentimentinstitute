import Link from "next/link";
import Dot404 from "@/app/components/Dot404";

// v1 404 — the same dot-matrix numerals in the site's own ink, inside the
// global chrome. Works in both themes via the token system.
export default function NotFoundV1() {
  return (
    <main className="nf1">
      <style>{`
        .nf1 {
          min-height: 62vh;
          display: grid; place-items: center;
          padding: 96px 24px;
          font-family: var(--font-body), ui-monospace, monospace;
        }
        .nf1-wrap { width: min(720px, 100%); text-align: center; }
        .nf1-caption {
          margin: 32px 0 0;
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.42em; text-transform: uppercase;
          color: var(--muted);
        }
        .nf1-back {
          display: inline-block; margin-top: 20px;
          font-size: 10.5px; font-weight: 700;
          letter-spacing: 0.22em; text-transform: uppercase;
          color: var(--purple); text-decoration: none;
          border-bottom: 1px solid var(--purple-glow);
          padding-bottom: 4px;
        }
        .nf1-back:hover { border-bottom-color: var(--purple); }
        .nf1-back:focus-visible { outline: 2px solid var(--purple); outline-offset: 4px; }
      `}</style>

      <div className="nf1-wrap">
        <Dot404 fg="var(--foreground)" dim="var(--border3)" />
        <p className="nf1-caption">Page not found</p>
        <Link className="nf1-back" href="/">
          Back to the homepage
        </Link>
      </div>
    </main>
  );
}
