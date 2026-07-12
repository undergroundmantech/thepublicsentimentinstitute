import Link from "next/link";
import { Manrope } from "next/font/google";
import DarkNav from "@/app/components/DarkNav";
import Dot404 from "@/app/components/Dot404";

// DarkNav resolves its type from --font-mp — every v2 page provides it
const manrope = Manrope({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-mp", display: "swap" });

// v2 404 — the numerals in the desk's dot-matrix, a caption, a way back.
export default function NotFoundV2() {
  return (
    <section className={`nf2 ${manrope.variable}`}>
      <style>{`
        /* full-bleed takeover — the exact recipe every v2 page uses: dark
           body, no global chrome, neutralize the layout wrapper's gutters,
           break out of the container */
        body { background: #050505 !important; }
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
          background: #050505;
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
          color: rgba(246, 244, 240, 0.42);
        }
        .nf2-back {
          display: inline-block; margin-top: 22px;
          font-size: 10.5px; font-weight: 700;
          letter-spacing: 0.22em; text-transform: uppercase;
          color: #c9f24f; text-decoration: none;
          border-bottom: 1px solid rgba(201, 242, 79, 0.35);
          padding-bottom: 4px;
        }
        .nf2-back:hover { border-bottom-color: #c9f24f; }
        .nf2-back:focus-visible { outline: 2px solid #c9f24f; outline-offset: 4px; }
      `}</style>

      <div className="nf2-shell">
        <DarkNav />
      </div>
      <div className="nf2-center">
        <div className="nf2-wrap">
          <Dot404 fg="#f6f4f0" dim="rgba(246, 244, 240, 0.17)" />
          <p className="nf2-caption">Page not found</p>
          <Link className="nf2-back" href="/">
            Back to the desk →
          </Link>
        </div>
      </div>
    </section>
  );
}
