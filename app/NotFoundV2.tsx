import Link from "next/link";
import DarkNav from "@/app/components/DarkNav";
import Dot404 from "@/app/components/Dot404";

// v2 404 — the numerals in the desk's dot-matrix, a caption, a way back.
export default function NotFoundV2() {
  return (
    <section className="nf2">
      <style>{`
        /* full-bleed takeover — the exact recipe every v2 page uses: dark
           body, no global chrome, neutralize the layout wrapper's gutters,
           break out of the container */
        body { background: var(--background) !important; }
        body header, body footer { display: none !important; }
        body main > div { max-width: none !important; padding-left: 0 !important; padding-right: 0 !important; }
        body main > div > div { padding-top: 0 !important; padding-bottom: 0 !important; }
        .nf2 {
          position: relative; z-index: 1;
          width: 100vw;
          margin-left: calc(50% - 50vw);
          min-height: 100svh;
          display: flex; flex-direction: column;
          overflow-x: clip;
          background: var(--background);
          font-family: ui-monospace, "SF Mono", Menlo, monospace;
        }
        /* same content shell as the other desk pages — the nav aligns to it */
        .nf2-shell {
          position: relative; z-index: 2;
          width: 100%; max-width: 1180px;
          margin: 0 auto;
          padding: 0 clamp(20px, 4vw, 44px);
        }
        .nf2-center {
          flex: 1 1 auto;
          display: grid; place-items: center;
          padding: 40px 24px 90px;
        }
        .nf2-wrap { width: min(720px, 100%); text-align: center; }
        .nf2-caption {
          margin: 34px 0 0;
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.42em; text-transform: uppercase;
          color: var(--muted2);
        }
        .nf2-back {
          display: inline-block; margin-top: 22px;
          font-size: 10.5px; font-weight: 700;
          letter-spacing: 0.22em; text-transform: uppercase;
          color: #6d3ee9; text-decoration: none;
          border-bottom: 1px solid rgba(109, 62, 233, 0.35);
          padding-bottom: 4px;
        }
        .nf2-back:hover { border-bottom-color: #6d3ee9; }
        .nf2-back:focus-visible { outline: 2px solid #6d3ee9; outline-offset: 4px; }
      `}</style>

      <div className="nf2-shell">
        <DarkNav />
      </div>
      <div className="nf2-center">
        <div className="nf2-wrap">
          <Dot404 fg="var(--foreground)" dim="var(--muted3)" />
          <p className="nf2-caption">Page not found</p>
          <Link className="nf2-back" href="/">
            Back to the desk →
          </Link>
        </div>
      </div>
    </section>
  );
}
