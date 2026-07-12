import Link from "next/link";
import DarkNav from "@/app/components/DarkNav";
import Dot404 from "@/app/components/Dot404";

// v2 404 — the numerals in the desk's dot-matrix, a caption, a way back.
export default function NotFoundV2() {
  return (
    <section className="nf2">
      <style>{`
        body header, body footer { display: none !important; }
        .nf2 {
          position: relative; z-index: 1;
          background: #050505;
          font-family: ui-monospace, "SF Mono", Menlo, monospace;
        }
        .nf2-center {
          min-height: 100vh;
          display: grid; place-items: center;
          padding: 120px 24px 90px;
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

      <DarkNav />
      <div className="nf2-center">
        <div className="nf2-wrap">
          <Dot404 fg="#f6f4f0" dim="rgba(246, 244, 240, 0.09)" />
          <p className="nf2-caption">Page not found</p>
          <Link className="nf2-back" href="/">
            Back to the desk →
          </Link>
        </div>
      </div>
    </section>
  );
}
