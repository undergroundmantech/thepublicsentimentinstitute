"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Manrope } from "next/font/google";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
});

type GalleryItem = {
  title: string;
  href: string;
  src: string;
  alt: string;
  kind: "polling" | "ratings" | "results" | "map";
};

type TrackItem = {
  title: string;
  body: string;
  mark: "bars" | "leaf" | "target" | "square";
};

type ProcessItem = {
  title: string;
  body: string;
  mark: "dots" | "weight" | "model" | "publish" | "target";
};

const gallery: GalleryItem[] = [
  {
    title: "Polling Averages",
    href: "/polling/donaldtrumpapproval",
    src: "/landing-thumbnails/polling-averages.png",
    alt: "Polling averages thumbnail with approval chart artwork",
    kind: "polling",
  },
  {
    title: "Forecast",
    href: "/forecastratings",
    src: "/landing-thumbnails/forecast.png",
    alt: "Forecast thumbnail with diverging election model particles",
    kind: "ratings",
  },
  {
    title: "Live Results",
    href: "/results",
    src: "/landing-thumbnails/live-results.png",
    alt: "Live results thumbnail with election map data points",
    kind: "results",
  },
];

const proofText =
  "A polling product should show its work, not hide it behind a dashboard skin.";

const narrativeStatement =
  "We believe that every voice carries a signal. Most research misses those voices. The Public Sentiment Institute is built to find it — in the data beneath the data, in the areas others overlook, asking the tough questions other researchers won’t.";

const proofTargets = {
  approval: 585,
  generic: 221,
  states: 50,
};

const tracks: TrackItem[] = [
  {
    title: "Polling averages",
    body: "Weighted daily trendlines for approval, generic ballot, and direction of country.",
    mark: "bars",
  },
  {
    title: "Forecast ratings",
    body: "Race ratings, modeled margins, and state-level electoral movement.",
    mark: "leaf",
  },
  {
    title: "Live results",
    body: "Candidate rows, county maps, reporting progress, and projection context.",
    mark: "square",
  },
  {
    title: "Research fielding",
    body: "Issue polling, survey recruitment, and partner intake for custom tracks.",
    mark: "target",
  },
];

const services = [
  { label: "Polling Averages", href: "/polling/donaldtrumpapproval" },
  { label: "Forecast Ratings", href: "/forecastratings" },
  { label: "Live Results", href: "/results" },
  { label: "Electoral Map", href: "/electoralmap" },
  { label: "Generic Ballot", href: "/polling/genericballot" },
  { label: "Gold Standard Pollsters", href: "/goldstandard" },
  { label: "Partner Research", href: "/contact" },
];

const coverage = [
  { label: "National", href: "/polling" },
  { label: "Senate", href: "/forecastratings" },
  { label: "Governor", href: "/forecastratings" },
  { label: "House", href: "/forecastratings" },
  { label: "Primaries", href: "/polling" },
  { label: "Issue polls", href: "/tpsipoll" },
  { label: "Custom research", href: "/contact" },
];

const process: ProcessItem[] = [
  {
    title: "Collect",
    body: "Polls and live race data are normalized into consistent candidate, sample, and date fields.",
    mark: "dots",
  },
  {
    title: "Weight",
    body: "Gold-standard pollsters, recency, sample size, and voter universe shape the daily average.",
    mark: "weight",
  },
  {
    title: "Model",
    body: "Forecast inputs blend polling priors, reporting progress, and expected turnout.",
    mark: "model",
  },
  {
    title: "Publish",
    body: "Charts, race ratings, maps, and result pages stay readable for real voters and campaigns.",
    mark: "publish",
  },
  {
    title: "Explain",
    body: "Every public surface keeps the assumptions, data lineage, and election-night context close to the result.",
    mark: "target",
  },
];

const faqs = [
  {
    question: "Do you run your own polls?",
    answer: "Yes. PSI publishes its own fielded research and also aggregates public polling where methodology is clear.",
  },
  {
    question: "How are averages weighted?",
    answer: "The public trackers combine recency, sample size, voter universe, pollster quality, and candidate fields into a daily weighted series.",
  },
  {
    question: "Can campaigns request a custom poll?",
    answer: "Yes. Campaigns, media groups, and organizations can start through the partner intake page for custom fielding or recurring tracks.",
  },
  {
    question: "Where do live results come from?",
    answer: "Live result pages use civic race data, candidate rows, reporting progress, and local model inputs to keep election-night context readable.",
  },
  {
    question: "Can I participate in a survey?",
    answer: "Yes. PSI maintains survey recruitment flows for public opinion research and issue polling.",
  },
];

function AbstractMark({ type, className = "" }: { type: TrackItem["mark"] | ProcessItem["mark"]; className?: string }) {
  return <span className={`lp-mark lp-mark-${type} ${className}`} aria-hidden="true" />;
}

function TrackIcon({ mark }: { mark: TrackItem["mark"] }) {
  const common = {
    className: "lp-track-icon",
    viewBox: "0 0 40 40",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (mark === "bars") {
    // Polling averages — weighted trendline
    return (
      <svg {...common}>
        <polyline points="4 28 13 18 21 23 36 7" />
        <circle cx="36" cy="7" r="2.6" fill="currentColor" stroke="none" />
        <line x1="4" y1="34" x2="36" y2="34" opacity="0.4" />
      </svg>
    );
  }

  if (mark === "leaf") {
    // Forecast ratings — diverging probability fan
    return (
      <svg {...common}>
        <path d="M7 20 L33 8" />
        <path d="M7 20 L34 20" />
        <path d="M7 20 L33 32" />
        <circle cx="7" cy="20" r="2.8" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (mark === "square") {
    // Live results — candidate rows
    return (
      <svg {...common}>
        <line x1="6" y1="12" x2="28" y2="12" />
        <line x1="6" y1="20" x2="36" y2="20" />
        <line x1="6" y1="28" x2="20" y2="28" />
      </svg>
    );
  }

  // target → Research fielding — survey form
  return (
    <svg {...common}>
      <rect x="9" y="6" width="22" height="28" rx="3" />
      <line x1="14" y1="15" x2="26" y2="15" />
      <line x1="14" y1="21" x2="26" y2="21" />
      <line x1="14" y1="27" x2="21" y2="27" />
    </svg>
  );
}

function ThumbnailPreview({ item }: { item: GalleryItem }) {
  return (
    <div className="lp-art lp-art-thumbnail">
      <Image src={item.src} alt={item.alt} width={1672} height={941} sizes="(max-width: 680px) 86vw, 770px" priority={item.kind === "polling"} />
    </div>
  );
}

function GalleryCard({ item }: { item: GalleryItem }) {
  return (
    <Link href={item.href} className={`lp-gallery-card lp-gallery-${item.kind}`} aria-label={item.title}>
      <ThumbnailPreview item={item} />
    </Link>
  );
}

function TrackColumn({ item }: { item: TrackItem }) {
  return (
    <article className="lp-track">
      <TrackIcon mark={item.mark} />
      <h3>{item.title}</h3>
      <p>{item.body}</p>
    </article>
  );
}

function ProcessCard({ item }: { item: ProcessItem }) {
  return (
    <article className="lp-process-card">
      <AbstractMark type={item.mark} />
      <h3>{item.title}</h3>
      <p>{item.body}</p>
    </article>
  );
}

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const proofRef = useRef<HTMLDivElement | null>(null);
  const countStartedRef = useRef(false);
  const [proofProgress, setProofProgress] = useState(0);
  const [proofArmed, setProofArmed] = useState(false);
  const [proofCounts, setProofCounts] = useState({ approval: 0, generic: 0, states: 0 });
  const [narrativeProgress, setNarrativeProgress] = useState(0);
  const [navOnLight, setNavOnLight] = useState(false);
  const [processInView, setProcessInView] = useState(false);
  const narrativeRef = useRef<HTMLDivElement | null>(null);
  const processRef = useRef<HTMLDivElement | null>(null);
  const galleryLoop = [...gallery, ...gallery];
  const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
  const proofLetterProgress = clamp01(proofProgress / 0.72);
  const proofSettle = clamp01((proofProgress - 0.72) / 0.2);
  const proofFade = clamp01((proofProgress - 0.88) / 0.12);
  const proofStyle = {
    "--proof-lift": `${Math.round(proofSettle * -132)}px`,
    "--proof-scale": String(1 - proofSettle * 0.08),
    "--proof-grid-y": `${Math.round(46 - proofSettle * 46)}px`,
    opacity: 1 - proofFade,
  } as React.CSSProperties;

  // Cinematic narrative beats — all driven by scroll position so scroll-up rewinds.
  const np = narrativeProgress;
  const narr2In = clamp01((np - 0.03) / 0.07);
  const narr2Out = clamp01((np - 0.46) / 0.08);
  const narr2Opacity = Math.max(0, narr2In - narr2Out);
  const narr2Y = (1 - narr2In) * 22 + narr2Out * -22;
  const narr2Highlight = clamp01((np - 0.1) / 0.3);
  const narr3In = clamp01((np - 0.56) / 0.1);
  const narr3Opacity = narr3In;
  const narr3Y = (1 - narr3In) * 24;
  const whiteT = clamp01((np - 0.7) / 0.16);
  const mixChannel = (from: number, to: number) => Math.round(from + (to - from) * whiteT);
  const narrativeBg = `rgb(${mixChannel(5, 244)}, ${mixChannel(5, 244)}, ${mixChannel(5, 239)})`;
  const narr3Color = `rgb(${mixChannel(244, 10)}, ${mixChannel(244, 10)}, ${mixChannel(239, 10)})`;

  useEffect(() => {
    const updateProofProgress = () => {
      const node = proofRef.current;
      if (!node) return;

      const rect = node.getBoundingClientRect();
      const viewportHeight = Math.max(window.innerHeight, 1);
      const scrollableDistance = Math.max(node.offsetHeight - viewportHeight, 1);
      const nextProgress = Math.max(0, Math.min(1, -rect.top / scrollableDistance));

      setProofProgress((current) =>
        Math.abs(current - nextProgress) > 0.006 ? nextProgress : current,
      );

      if (nextProgress > 0.78) {
        setProofArmed(true);
      }

      const narrativeNode = narrativeRef.current;
      if (narrativeNode) {
        const narrativeRect = narrativeNode.getBoundingClientRect();
        const narrativeScrollable = Math.max(narrativeNode.offsetHeight - viewportHeight, 1);
        const narrativeNext = Math.max(0, Math.min(1, -narrativeRect.top / narrativeScrollable));
        setNarrativeProgress((current) =>
          Math.abs(current - narrativeNext) > 0.004 ? narrativeNext : current,
        );

        // Flip the transparent desktop nav dark only while the white finale
        // actually covers the top of the viewport (not after we scroll past it).
        const whiteAmount = Math.max(0, Math.min(1, (narrativeNext - 0.72) / 0.18));
        const coversTop = narrativeRect.bottom > viewportHeight * 0.5;
        const nextNavLight = whiteAmount > 0.5 && coversTop;
        setNavOnLight((current) => (current !== nextNavLight ? nextNavLight : current));
      }
    };

    updateProofProgress();
    window.addEventListener("scroll", updateProofProgress, { passive: true });
    window.addEventListener("resize", updateProofProgress);

    return () => {
      window.removeEventListener("scroll", updateProofProgress);
      window.removeEventListener("resize", updateProofProgress);
    };
  }, []);

  useEffect(() => {
    if (!proofArmed || countStartedRef.current) return;

    countStartedRef.current = true;
    let frame = 0;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      frame = requestAnimationFrame(() => setProofCounts(proofTargets));
      return () => cancelAnimationFrame(frame);
    }

    const duration = 950;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const elapsed = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - elapsed, 3);

      setProofCounts({
        approval: Math.round(proofTargets.approval * eased),
        generic: Math.round(proofTargets.generic * eased),
        states: Math.round(proofTargets.states * eased),
      });

      if (elapsed < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [proofArmed]);

  useEffect(() => {
    const node = processRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setProcessInView(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setProcessInView(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.16 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    const onResize = () => {
      setMenuOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [menuOpen]);

  return (
    <>
      <style>{`
        body {
          background: #050505 !important;
          color: #f4f4ef;
          overflow-x: clip;
        }

        body header,
        body footer {
          display: none !important;
        }

        body main > div {
          max-width: none !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
        }

        body main > div > div {
          padding-top: 0 !important;
          padding-bottom: 0 !important;
          animation: none !important;
        }

        .lp-root {
          min-height: 100vh;
          overflow-x: clip;
          background: #050505;
          color: #f4f4ef;
          font-family: var(--font-manrope), "Manrope", "Helvetica Neue", Arial, sans-serif;
          letter-spacing: -0.01em;
        }

        .lp-root h1,
        .lp-root h2,
        .lp-root h3,
        .lp-root h4,
        .lp-root p,
        .lp-root a,
        .lp-root button {
          font-family: var(--font-manrope), "Manrope", "Helvetica Neue", Arial, sans-serif;
          text-transform: none;
        }

        .lp-root h1,
        .lp-root h2,
        .lp-root h3,
        .lp-root h4 {
          color: #f4f4ef;
        }

        .lp-root ul,
        .lp-root li {
          color: inherit;
        }

        .lp-shell {
          width: min(1100px, calc(100vw - 160px));
          margin: 0 auto;
        }

        .lp-hero {
          min-height: auto;
          padding: 104px 0 24px;
          position: relative;
        }

        .lp-hero:before {
          content: none;
        }

        .lp-nav {
          display: none;
        }

        .lp-topbar {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 70;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          height: 56px;
          padding: 0 16px 0 18px;
          background: rgba(5, 5, 5, 0.66);
          backdrop-filter: blur(20px) saturate(1.4);
          -webkit-backdrop-filter: blur(20px) saturate(1.4);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .lp-topbar-brand {
          display: inline-flex;
          align-items: center;
          text-decoration: none;
        }

        .lp-topbar-brand .lp-brand-logo {
          width: 112px;
          height: 24px;
        }

        .lp-burger {
          position: relative;
          width: 42px;
          height: 42px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.05);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          transition: background 180ms ease, border-color 180ms ease;
        }

        .lp-burger:active {
          background: rgba(255, 255, 255, 0.12);
        }

        .lp-burger span {
          position: relative;
          display: block;
          width: 17px;
          height: 1.6px;
          border-radius: 999px;
          background: #f4f4ef;
          transition: background 160ms ease;
        }

        .lp-burger span:before,
        .lp-burger span:after {
          content: "";
          position: absolute;
          left: 0;
          width: 17px;
          height: 1.6px;
          border-radius: 999px;
          background: #f4f4ef;
          transition: transform 280ms cubic-bezier(.2,.8,.2,1);
        }

        .lp-burger span:before { top: -5.5px; }
        .lp-burger span:after { top: 5.5px; }

        .lp-burger.is-open span {
          background: transparent;
        }

        .lp-burger.is-open span:before {
          transform: translateY(5.5px) rotate(45deg);
        }

        .lp-burger.is-open span:after {
          transform: translateY(-5.5px) rotate(-45deg);
        }

        .lp-menu-scrim {
          position: fixed;
          inset: 0;
          z-index: 58;
          background: rgba(5, 5, 5, 0.5);
          opacity: 0;
          pointer-events: none;
          transition: opacity 240ms ease;
        }

        .lp-menu-scrim.is-open {
          opacity: 1;
          pointer-events: auto;
        }

        .lp-mobile-menu {
          display: none;
          position: fixed;
          top: 64px;
          left: 10px;
          right: 10px;
          z-index: 65;
          flex-direction: column;
          max-height: calc(100svh - 82px);
          overflow-y: auto;
          padding: 7px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(13, 13, 13, 0.96);
          backdrop-filter: blur(26px) saturate(1.3);
          -webkit-backdrop-filter: blur(26px) saturate(1.3);
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6);
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          transform: translateY(-10px) scale(0.97);
          transform-origin: top center;
          transition: opacity 220ms ease, transform 300ms cubic-bezier(.2,.8,.2,1), visibility 0ms linear 240ms;
        }

        .lp-mobile-menu.is-open {
          opacity: 1;
          visibility: visible;
          pointer-events: auto;
          transform: translateY(0) scale(1);
          transition: opacity 220ms ease, transform 320ms cubic-bezier(.2,.8,.2,1), visibility 0ms;
        }

        .lp-mobile-menu-list {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .lp-mobile-menu-list a {
          display: grid;
          grid-template-columns: 24px minmax(0, 1fr) auto;
          align-items: center;
          gap: 12px;
          padding: 12px 13px;
          border-radius: 12px;
          color: #f4f4ef;
          text-decoration: none;
          font-size: 16px;
          font-weight: 600;
          letter-spacing: -0.1px;
          opacity: 0;
          transform: translateY(8px);
          transition: background 160ms ease, color 160ms ease;
        }

        .lp-mobile-menu.is-open .lp-mobile-menu-list a {
          animation: lp-menu-item 340ms cubic-bezier(.2,.8,.2,1) forwards;
        }

        .lp-mobile-menu-list a:hover,
        .lp-mobile-menu-list a:active,
        .lp-mobile-menu-list a:focus-visible {
          background: rgba(255, 255, 255, 0.07);
        }

        .lp-mobile-menu-list a:active .arw {
          transform: translateX(3px);
        }

        .lp-mobile-menu-list .idx {
          font-size: 11px;
          font-weight: 700;
          color: rgba(244, 244, 239, 0.32);
          letter-spacing: 0;
          font-variant-numeric: tabular-nums;
        }

        .lp-mobile-menu-list .arw {
          color: #b7ff00;
          font-size: 15px;
          font-weight: 700;
          transition: transform 200ms cubic-bezier(.2,.8,.2,1);
        }

        .lp-mobile-menu-foot {
          margin-top: 5px;
          padding: 13px 13px 6px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .lp-mobile-menu-foot a {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: rgba(244, 244, 239, 0.64);
          text-decoration: none;
          font-size: 13px;
          font-weight: 650;
          letter-spacing: 0.2px;
        }

        @keyframes lp-menu-item {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ---- Desktop floating nav + glossy dropdown ---- */
        .lp-desktop-nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 70;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px clamp(28px, 4vw, 64px);
          pointer-events: none;
        }

        .lp-desktop-nav > * {
          pointer-events: auto;
        }

        .lp-desktop-brand {
          display: inline-flex;
          align-items: center;
          text-decoration: none;
        }

        .lp-brand-logo {
          display: block;
          width: 142px;
          height: 30px;
          background: #f4f4ef;
          -webkit-mask: url(/full_logo_clean.png) left center / contain no-repeat;
          mask: url(/full_logo_clean.png) left center / contain no-repeat;
          transition: opacity 200ms ease, transform 200ms ease, background 260ms ease;
        }

        .lp-desktop-brand:hover .lp-brand-logo {
          opacity: 0.85;
        }

        .lp-desktop-links {
          display: flex;
          align-items: center;
          gap: clamp(22px, 2.4vw, 40px);
        }

        .lp-desknav-item {
          position: relative;
          display: inline-flex;
          align-items: center;
          padding: 6px 1px;
          background: none;
          border: 0;
          font: inherit;
          font-size: 16px;
          font-weight: 560;
          letter-spacing: -0.01em;
          color: #f4f4ef;
          text-decoration: none;
          cursor: pointer;
          text-shadow: 0 1px 14px rgba(0, 0, 0, 0.4);
          transition: color 180ms ease;
        }

        .lp-desknav-item:after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: -2px;
          height: 1.5px;
          background: #b7ff00;
          transform: scaleX(0);
          transform-origin: left center;
          transition: transform 280ms cubic-bezier(.2,.8,.2,1);
        }

        .lp-desknav-item:hover,
        .lp-desknav-item.is-open {
          color: #b7ff00;
        }

        .lp-desknav-item:hover:after,
        .lp-desknav-item.is-open:after {
          transform: scaleX(1);
        }

        .lp-desktop-menu {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 60;
          max-height: 100vh;
          overflow-y: auto;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0) 26%),
            rgba(8, 8, 10, 0.95);
          -webkit-backdrop-filter: blur(30px) saturate(1.4);
          backdrop-filter: blur(30px) saturate(1.4);
          box-shadow: 0 50px 110px rgba(0, 0, 0, 0.6);
          transform: translateY(-101%);
          visibility: hidden;
          pointer-events: none;
          transition: transform 520ms cubic-bezier(.16, 1, .3, 1), visibility 0ms linear 520ms;
        }

        .lp-desktop-menu.is-open {
          transform: translateY(0);
          visibility: visible;
          pointer-events: auto;
          transition: transform 600ms cubic-bezier(.16, 1, .3, 1), visibility 0ms;
        }

        .lp-desktop-menu-inner {
          width: min(1100px, calc(100vw - 160px));
          margin: 0 auto;
          padding: 118px 0 64px;
          display: grid;
          grid-template-columns: 1.15fr 1fr 1fr;
          gap: clamp(40px, 5vw, 88px);
          align-items: start;
          opacity: 0;
          transform: translateY(14px);
          transition: opacity 360ms ease, transform 440ms cubic-bezier(.2, .8, .2, 1);
        }

        .lp-desktop-menu.is-open .lp-desktop-menu-inner {
          opacity: 1;
          transform: translateY(0);
          transition-delay: 150ms;
        }

        .lp-panel-lead {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }

        .lp-panel-eyebrow {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.8px;
          text-transform: uppercase;
          color: rgba(244, 244, 239, 0.42);
          margin-bottom: 24px;
        }

        .lp-panel-statement {
          margin: 0 0 34px;
          font-size: clamp(23px, 2vw, 32px);
          line-height: 1.12;
          letter-spacing: -0.03em;
          font-weight: 500;
          color: #f4f4ef;
          max-width: 340px;
        }

        .lp-panel-cta {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          padding: 13px 24px;
          border-radius: 999px;
          background: #b7ff00;
          color: #050505;
          text-decoration: none;
          font-size: 15px;
          font-weight: 650;
          letter-spacing: -0.01em;
          transition: transform 200ms cubic-bezier(.2, .8, .2, 1), box-shadow 200ms ease;
        }

        .lp-panel-cta:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 40px rgba(183, 255, 0, 0.22);
        }

        .lp-menu-col {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .lp-menu-col-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.8px;
          text-transform: uppercase;
          color: rgba(244, 244, 239, 0.42);
          padding-bottom: 16px;
          margin-bottom: 2px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
        }

        .lp-menu-col a {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 15px 0;
          color: #f4f4ef;
          text-decoration: none;
          font-size: 19px;
          font-weight: 540;
          letter-spacing: -0.015em;
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
          transition: color 180ms ease, padding-left 240ms cubic-bezier(.2, .8, .2, 1);
        }

        .lp-menu-col a .a {
          color: #b7ff00;
          font-size: 16px;
          font-weight: 700;
          opacity: 0;
          transform: translateX(-6px);
          transition: opacity 180ms ease, transform 220ms cubic-bezier(.2, .8, .2, 1);
        }

        .lp-menu-col a:hover {
          color: #b7ff00;
          padding-left: 10px;
        }

        .lp-menu-col a:hover .a {
          opacity: 1;
          transform: translateX(0);
        }

        .lp-wordmark {
          display: inline-flex;
          align-items: center;
          gap: 13px;
          color: inherit;
          text-decoration: none;
          font-size: 34px;
          font-weight: 780;
          letter-spacing: 0;
          line-height: 1;
        }

        .lp-wordmark:hover {
          text-decoration: none;
        }

        .lp-wordmark span {
          font-size: 13px;
          font-weight: 720;
          letter-spacing: 0;
          line-height: 1.04;
          max-width: 96px;
        }

        .lp-nav-links {
          display: flex;
          align-items: center;
          gap: 22px;
          font-size: 14px;
          color: rgba(244, 244, 239, 0.58);
        }

        .lp-nav-links a {
          color: inherit;
          text-decoration: none;
          transition: color 180ms ease, transform 180ms ease;
        }

        .lp-nav-links a:hover {
          color: #f4f4ef;
          transform: translateY(-1px);
          text-decoration: none;
        }

        .lp-hero-copy {
          position: relative;
          max-width: 1220px;
          animation: lp-rise 720ms cubic-bezier(.2,.8,.2,1) both;
        }

        .lp-hero-mark {
          display: block;
          position: relative;
          width: 44px;
          height: 42px;
          margin: 0 0 106px 7px;
        }

        .lp-hero-mark:before,
        .lp-hero-mark:after {
          content: "";
          position: absolute;
          background: #f4f4ef;
        }

        .lp-hero-mark:before {
          width: 33px;
          height: 12px;
          border-radius: 999px;
          left: 1px;
          top: 7px;
          transform: rotate(7deg);
        }

        .lp-hero-mark:after {
          width: 24px;
          height: 12px;
          border-radius: 999px;
          left: 10px;
          top: 23px;
          transform: rotate(7deg);
        }

        .lp-hero h1 {
          margin: 0;
          max-width: 1190px;
          font-size: 86px;
          line-height: 0.99;
          letter-spacing: 0;
          font-weight: 430;
          color: #f4f4ef;
        }

        .lp-hero p {
          margin: 24px 0 0;
          max-width: 760px;
          font-size: 26px;
          line-height: 1.2;
          letter-spacing: 0;
          color: rgba(244, 244, 239, 0.58);
          font-weight: 420;
        }

        .lp-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 30px;
        }

        .lp-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 50px;
          padding: 0 30px;
          border-radius: 999px;
          border: 1px solid transparent;
          background: #f4f4ef;
          color: #0a0a0a;
          text-decoration: none;
          font-size: 16px;
          font-weight: 600;
          letter-spacing: -0.01em;
          box-shadow: 0 12px 34px rgba(0, 0, 0, 0.42);
          transition: transform 240ms cubic-bezier(.2,.8,.2,1), background 220ms ease, border-color 220ms ease, box-shadow 240ms ease;
        }

        .lp-pill:after {
          content: none;
        }

        .lp-pill:hover {
          transform: translateY(-2px);
          background: #ffffff;
          box-shadow: 0 20px 46px rgba(0, 0, 0, 0.5);
          text-decoration: none;
        }

        .lp-pill:hover:after {
          content: none;
        }

        .lp-pill-dark {
          background: rgba(255, 255, 255, 0.04);
          color: #f4f4ef;
          border-color: rgba(255, 255, 255, 0.22);
          -webkit-backdrop-filter: blur(16px) saturate(1.3);
          backdrop-filter: blur(16px) saturate(1.3);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
        }

        .lp-pill-dark:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.36);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 18px 44px rgba(0, 0, 0, 0.34);
        }

        .lp-dot {
          position: relative;
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: #f4f4ef;
          margin-left: 18px;
          animation: lp-dot-pulse 2.8s ease-in-out infinite;
        }

        .lp-dot:before {
          content: none;
        }

        .lp-dot:after {
          content: none;
        }

        .lp-gallery-band {
          border-top: 1px solid rgba(255, 255, 255, 0.09);
          border-bottom: 1px solid rgba(255, 255, 255, 0.09);
          padding: 30px 0 38px;
          background: #050505;
        }

        .lp-gallery-window {
          width: 100%;
          overflow: hidden;
          position: relative;
        }

        .lp-gallery-window:before,
        .lp-gallery-window:after {
          content: "";
          position: absolute;
          z-index: 4;
          top: 0;
          bottom: 0;
          width: min(17vw, 230px);
          pointer-events: none;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .lp-gallery-window:before {
          left: 0;
          background: linear-gradient(90deg, #050505 0%, #050505 24%, rgba(5, 5, 5, 0.6) 58%, transparent 100%);
          -webkit-mask-image: linear-gradient(90deg, #000 0%, #000 46%, transparent 100%);
          mask-image: linear-gradient(90deg, #000 0%, #000 46%, transparent 100%);
        }

        .lp-gallery-window:after {
          right: 0;
          background: linear-gradient(270deg, #050505 0%, #050505 24%, rgba(5, 5, 5, 0.6) 58%, transparent 100%);
          -webkit-mask-image: linear-gradient(270deg, #000 0%, #000 46%, transparent 100%);
          mask-image: linear-gradient(270deg, #000 0%, #000 46%, transparent 100%);
        }

        .lp-gallery-track {
          display: flex;
          gap: 16px;
          margin-left: 24px;
          width: max-content;
          animation: lp-gallery-slide 72s linear infinite;
          will-change: transform;
        }

        .lp-gallery-window:hover .lp-gallery-track {
          animation-play-state: paused;
        }

        .lp-gallery-card {
          width: min(720px, 90vw);
          min-height: 0;
          display: flex;
          flex-direction: column;
          gap: 0;
          flex: 0 0 auto;
          padding: 0;
          border-radius: 10px;
          background: transparent;
          color: #f4f4ef;
          text-decoration: none;
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.48);
          border: 0;
          isolation: isolate;
          overflow: hidden;
          position: relative;
          transform: translateZ(0);
          transition: transform 360ms cubic-bezier(.2,.8,.2,1), box-shadow 360ms cubic-bezier(.2,.8,.2,1), border-color 360ms ease;
        }

        .lp-gallery-card:before {
          content: none;
          position: absolute;
          inset: 0;
          z-index: 2;
          pointer-events: none;
          border-radius: inherit;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.42);
        }

        .lp-gallery-card:after {
          content: "";
          position: absolute;
          z-index: 3;
          inset: -45% -25%;
          pointer-events: none;
          background: linear-gradient(110deg, transparent 35%, rgba(255,255,255,0.26) 48%, transparent 60%);
          transform: translateX(-70%) rotate(7deg);
          opacity: 0;
          transition: transform 700ms cubic-bezier(.2,.8,.2,1), opacity 260ms ease;
        }

        .lp-gallery-ratings,
        .lp-gallery-results,
        .lp-gallery-map {
          background: transparent;
          color: #f4f4ef;
        }

        .lp-gallery-card:hover {
          transform: translateY(-12px) rotate(-0.35deg) scale(1.014);
          box-shadow: 0 34px 100px rgba(0, 0, 0, 0.72), 0 0 42px rgba(255, 255, 255, 0.08);
          border-color: transparent;
          text-decoration: none;
        }

        .lp-gallery-ratings:hover {
          transform: translateY(-12px) rotate(0.35deg) scale(1.012);
        }

        .lp-gallery-results:hover {
          transform: translateY(-12px) rotate(-0.2deg) scale(1.012);
          box-shadow: 0 36px 90px rgba(0, 0, 0, 0.32);
        }

        .lp-gallery-card:hover:after {
          opacity: 1;
          transform: translateX(70%) rotate(7deg);
        }

        .lp-card-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 13px 16px 7px;
          min-height: 44px;
        }

        .lp-card-head h3 {
          margin: 0;
          font-size: 22px;
          letter-spacing: 0;
          font-weight: 660;
        }

        .lp-card-head span {
          color: #7c3aed;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0;
          white-space: nowrap;
        }

        .lp-gallery-ratings .lp-card-head h3,
        .lp-gallery-ratings .lp-card-head span,
        .lp-gallery-results .lp-card-head h3 {
          color: #ffffff;
        }

        .lp-gallery-results .lp-card-head span {
          color: #b7ff00;
        }

        .lp-gallery-map .lp-card-head span {
          color: #050505;
        }

        .lp-art {
          flex: 1;
          min-height: 376px;
          border-radius: 6px;
          padding: 26px;
          position: relative;
          overflow: hidden;
          transition: transform 360ms cubic-bezier(.2,.8,.2,1), filter 360ms ease;
        }

        .lp-gallery-card:hover .lp-art {
          transform: translateY(-3px) scale(1.006);
        }

        .lp-art-thumbnail {
          aspect-ratio: 1672 / 941;
          flex: 0 0 auto;
          min-height: 0;
          padding: 0;
          border-radius: 10px;
          background: #050505;
          box-shadow: none;
        }

        .lp-art-thumbnail img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          transform: scale(1.002);
          transition: transform 520ms cubic-bezier(.2,.8,.2,1), filter 520ms ease;
        }

        .lp-gallery-card:hover .lp-art-thumbnail img {
          transform: scale(1.035);
          filter: contrast(1.06) saturate(1.04);
        }

        .lp-art-polling {
          background: #dededb;
          color: #0a0a0a;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .lp-art-polling:before {
          content: "PSI POLLING / NATIONAL TRACKER / MAY 30";
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          height: 30px;
          display: flex;
          align-items: center;
          padding-left: 18px;
          background: #050505;
          color: rgba(255, 255, 255, 0.72);
          font-size: 9px;
          font-weight: 760;
          letter-spacing: 0;
        }

        .lp-art-polling:after {
          content: "";
          position: absolute;
          width: 220px;
          height: 220px;
          right: -74px;
          top: 74px;
          border: 1px solid rgba(10, 10, 10, 0.13);
          border-radius: 999px;
          box-shadow: -92px 92px 0 -91px rgba(10, 10, 10, 0.38);
        }

        .lp-poll-chrome,
        .lp-poll-hero,
        .lp-map-title,
        .lp-rating-title {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .lp-poll-chrome {
          margin-top: 20px;
          color: #666;
          font-size: 11px;
          font-weight: 650;
        }

        .lp-poll-hero strong,
        .lp-rating-title strong,
        .lp-map-title strong {
          display: block;
          font-size: 42px;
          line-height: 0.92;
          font-weight: 560;
        }

        .lp-poll-hero span,
        .lp-rating-title span,
        .lp-map-title span {
          display: block;
          margin-bottom: 6px;
          font-size: 12px;
          font-weight: 700;
        }

        .lp-poll-hero b {
          font-size: 68px;
          line-height: 0.85;
          font-weight: 520;
          transition: transform 360ms cubic-bezier(.2,.8,.2,1);
        }

        .lp-gallery-card:hover .lp-poll-hero b {
          transform: translateX(-8px);
        }

        .lp-poll-grid {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 148px;
          gap: 14px;
          align-items: stretch;
        }

        .lp-poll-chart-card {
          border-radius: 12px;
          background: #f8f8f5;
          padding: 16px;
          border: 1px solid rgba(10, 10, 10, 0.07);
          box-shadow: 0 14px 28px rgba(10, 10, 10, 0.045);
          transition: transform 360ms cubic-bezier(.2,.8,.2,1), box-shadow 360ms ease;
        }

        .lp-gallery-card:hover .lp-poll-chart-card {
          transform: translateY(-4px);
          box-shadow: 0 22px 40px rgba(10, 10, 10, 0.08);
        }

        .lp-poll-source-stack {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 10px;
        }

        .lp-poll-source-stack span {
          width: 130px;
          border-radius: 999px;
          background: #f8f8f5;
          border: 1px solid rgba(10, 10, 10, 0.08);
          padding: 9px 12px;
          color: #555;
          font-size: 11px;
          font-weight: 650;
          transform: translateX(var(--source-offset));
          transition: transform 360ms cubic-bezier(.2,.8,.2,1), background 360ms ease;
        }

        .lp-gallery-card:hover .lp-poll-source-stack span {
          transform: translateX(calc(var(--source-offset) + 10px));
          background: #ffffff;
        }

        .lp-tabs {
          display: flex;
          gap: 6px;
          margin-bottom: 18px;
        }

        .lp-tabs span {
          padding: 8px 12px;
          border-radius: 7px;
          background: #e9e9e6;
          color: #6b6b6b;
          font-size: 10px;
          font-weight: 650;
        }

        .lp-tabs .is-active {
          background: #0a0a0a;
          color: #ffffff;
        }

        .lp-line-chart {
          width: 100%;
          height: 112px;
          overflow: visible;
        }

        .lp-line-chart .grid {
          fill: none;
          stroke: rgba(10, 10, 10, 0.09);
          stroke-width: 0.7;
        }

        .lp-line-chart .red,
        .lp-line-chart .blue {
          fill: none;
          stroke-width: 2.8;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 132;
          transition: stroke-dashoffset 620ms cubic-bezier(.2,.8,.2,1), stroke-width 260ms ease;
        }

        .lp-line-chart .red { stroke: #e63946; stroke-dashoffset: 16; }
        .lp-line-chart .blue { stroke: #2563eb; stroke-dashoffset: 8; }

        .lp-gallery-card:hover .lp-line-chart .red,
        .lp-gallery-card:hover .lp-line-chart .blue {
          stroke-dashoffset: 0;
          stroke-width: 3.4;
        }

        .lp-mini-stats {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          overflow: hidden;
          border-radius: 12px;
          background: rgba(10, 10, 10, 0.07);
          box-shadow: 0 12px 24px rgba(10, 10, 10, 0.04);
        }

        .lp-mini-stats span {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 13px 14px;
          background: #fbfbfa;
          color: #777;
          font-size: 11px;
        }

        .lp-art-ratings {
          background: #ff7a00;
          color: #ffffff;
          display: grid;
          grid-template-columns: 1fr 150px;
          grid-template-rows: auto auto 1fr;
          gap: 18px 20px;
          align-items: start;
        }

        .lp-art-ratings:before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px),
            linear-gradient(0deg, rgba(255,255,255,0.08) 1px, transparent 1px);
          background-size: 64px 64px;
          mask-image: linear-gradient(to bottom, transparent, black 18%, black 72%, transparent);
          opacity: 0.32;
        }

        .lp-art-ratings:after {
          content: "RATINGS";
          position: absolute;
          left: -8px;
          bottom: -28px;
          color: rgba(255, 255, 255, 0.14);
          font-size: 112px;
          line-height: 1;
          font-weight: 720;
        }

        .lp-rating-title {
          grid-column: 1 / 2;
          color: #ffffff;
          align-self: start;
          flex-direction: column;
          gap: 14px;
        }

        .lp-rating-title strong {
          color: #ffffff;
          max-width: 360px;
          font-size: 44px;
        }

        .lp-rating-side {
          position: relative;
          z-index: 1;
          grid-column: 2;
          display: grid;
          gap: 8px;
          align-self: start;
          justify-items: end;
          color: rgba(255,255,255,0.86);
          font-size: 13px;
          font-weight: 680;
        }

        .lp-rating-tabs {
          position: relative;
          z-index: 1;
          display: grid;
          gap: 9px;
          align-self: stretch;
          align-content: start;
          justify-items: end;
          grid-column: 2;
          grid-row: 2;
        }

        .lp-rating-tabs span {
          width: fit-content;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.24);
          padding: 9px 14px;
          color: #ffffff;
          font-size: 12px;
          font-weight: 700;
        }

        .lp-rating-tabs .is-active {
          background: #050505;
        }

        .lp-mini-stats b {
          color: #0a0a0a;
          font-size: 22px;
          line-height: 1;
          letter-spacing: 0;
        }

        .red { color: #e63946 !important; }
        .blue { color: #2563eb !important; }

        .lp-state-grid {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 8px;
          grid-column: 1 / 2;
          grid-row: 2;
          align-self: start;
          transition: transform 420ms cubic-bezier(.2,.8,.2,1);
        }

        .lp-gallery-ratings:hover .lp-state-grid {
          transform: translateY(-8px);
        }

        .lp-state {
          height: 34px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 760;
          color: #ffffff;
          box-shadow: 0 12px 24px rgba(10, 10, 10, 0.14);
          transition: transform 260ms ease, box-shadow 260ms ease;
        }

        .lp-gallery-ratings:hover .lp-state:nth-child(3n) {
          transform: translateY(-3px);
          box-shadow: 0 16px 30px rgba(10, 10, 10, 0.2);
        }

        .lp-state-r { background: #e63946; }
        .lp-state-d { background: #2563eb; }
        .lp-state-t { background: #7c3aed; }

        .lp-rating-key,
        .lp-ev-row {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 20px;
          color: rgba(10, 10, 10, 0.58);
          font-size: 11px;
        }

        .lp-art-ratings .lp-rating-key {
          grid-column: 1 / -1;
          grid-row: 3;
          align-self: end;
          color: rgba(255, 255, 255, 0.78);
          margin-top: 0;
        }

        .lp-rating-key i {
          display: inline-block;
          width: 10px;
          height: 10px;
          border-radius: 999px;
          margin-right: 5px;
        }

        .lp-rating-key .r { background: #e63946; }
        .lp-rating-key .d { background: #2563eb; }
        .lp-rating-key .t { background: #7c3aed; }

        .lp-result-head {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          color: rgba(255, 255, 255, 0.62);
          font-size: 12px;
          margin-bottom: 14px;
        }

        .lp-result-toolbar {
          display: flex;
          gap: 6px;
          margin-bottom: 18px;
        }

        .lp-result-toolbar span {
          width: 9px;
          height: 9px;
          border-radius: 999px;
          background: rgba(255,255,255,0.24);
        }

        .lp-result-head span {
          color: #ffffff;
          font-weight: 690;
        }

        .lp-art-results {
          background:
            linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(0deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            #090909;
          background-size: 42px 42px;
          color: #ffffff;
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 18px;
          align-items: end;
        }

        .lp-results-grid-bg {
          position: absolute;
          top: 0;
          right: -84px;
          width: 260px;
          height: 100%;
          background: #b7ff00;
          opacity: 0.1;
          transform: skewX(-15deg);
          pointer-events: none;
        }

        .lp-result-console {
          position: relative;
          z-index: 1;
          align-self: stretch;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.11);
          background: rgba(255, 255, 255, 0.05);
          padding: 20px;
          transition: border-color 360ms ease, background 360ms ease, transform 360ms cubic-bezier(.2,.8,.2,1);
        }

        .lp-gallery-results:hover .lp-result-console {
          border-color: rgba(183,255,0,0.28);
          background: rgba(255,255,255,0.075);
          transform: translateX(4px);
        }

        .lp-result-console h4 {
          margin: 18px 0 10px;
          color: #ffffff;
          font-size: 44px;
          line-height: 0.94;
          font-weight: 520;
        }

        .lp-result-console p {
          color: rgba(255, 255, 255, 0.62);
          font-size: 15px;
          line-height: 1.24;
        }

        .lp-result-county-strip {
          display: grid;
          grid-template-columns: repeat(12, 1fr);
          gap: 5px;
          margin-top: 20px;
        }

        .lp-result-county-strip span {
          height: 34px;
          border-radius: 6px;
          opacity: 0.9;
          transition: transform 300ms ease, opacity 300ms ease;
        }

        .lp-gallery-results:hover .lp-result-county-strip span:nth-child(odd) {
          transform: translateY(-5px);
          opacity: 1;
        }

        .lp-result-county-strip .red { background: #e63946; }
        .lp-result-county-strip .purple { background: #7c3aed; }

        .lp-result-row {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 100px 1fr 58px;
          gap: 14px;
          align-items: center;
          padding: 18px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.95);
          transition: transform 320ms cubic-bezier(.2,.8,.2,1), background 320ms ease;
        }

        .lp-gallery-results:hover .lp-result-row {
          transform: translateX(-5px);
          background: #ffffff;
        }

        .lp-result-row div:first-child {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }

        .lp-result-row strong {
          font-size: 14px;
          letter-spacing: 0;
        }

        .lp-result-row small {
          color: #888;
          font-size: 11px;
        }

        .lp-result-row b {
          font-size: 20px;
          letter-spacing: 0;
          text-align: right;
        }

        .lp-result-bar {
          height: 5px;
          border-radius: 999px;
          background: rgba(10, 10, 10, 0.09);
          overflow: hidden;
        }

        .lp-result-bar span {
          display: block;
          height: 100%;
          border-radius: inherit;
        }

        .lp-result-row.red .lp-result-bar span { background: #e63946; }
        .lp-result-row.purple .lp-result-bar span { background: #7c3aed; }
        .lp-result-row.gray .lp-result-bar span { background: #909090; }
        .lp-result-row.red b { color: #e63946; }
        .lp-result-row.purple b { color: #7c3aed; }

        .lp-us-map {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(9, 1fr);
          gap: 6px;
          min-height: 164px;
          align-content: center;
          transition: transform 420ms cubic-bezier(.2,.8,.2,1);
        }

        .lp-gallery-map:hover .lp-us-map {
          transform: translateY(-7px) scale(1.015);
        }

        .lp-us-map span {
          height: 22px;
          border-radius: 3px;
          transform: skew(-9deg);
          box-shadow: 0 9px 18px rgba(10, 10, 10, 0.12);
          transition: transform 280ms ease, filter 280ms ease;
        }

        .lp-gallery-map:hover .lp-us-map span:nth-child(4n) {
          transform: skew(-9deg) translateY(-4px);
          filter: saturate(1.15);
        }

        .lp-us-map .r { background: #e63946; }
        .lp-us-map .d { background: #2563eb; }
        .lp-us-map .t { background: #d7d7d3; }

        .lp-ev-row b {
          display: block;
          font-size: 29px;
          line-height: 1;
          letter-spacing: 0;
        }

        .lp-ev-bar {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 42% 2px 58%;
          height: 13px;
          border-radius: 999px;
          overflow: hidden;
          margin-top: 13px;
          background: #e5e5e2;
        }

        .lp-art-map {
          background: #b7ff00;
          color: #050505;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .lp-art-map:before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(10,10,10,0.06) 1px, transparent 1px),
            linear-gradient(0deg, rgba(10,10,10,0.05) 1px, transparent 1px);
          background-size: 58px 58px;
          opacity: 0.36;
        }

        .lp-art-map:after {
          content: "*";
          position: absolute;
          right: 26px;
          top: 18px;
          color: rgba(10, 10, 10, 0.9);
          font-size: 68px;
          line-height: 1;
          font-weight: 300;
        }

        .lp-map-title strong {
          max-width: 260px;
        }

        .lp-map-title span {
          margin-top: 8px;
          margin-right: 58px;
        }

        .lp-map-controls {
          position: relative;
          z-index: 1;
          display: flex;
          gap: 8px;
          margin: 12px 0 4px;
        }

        .lp-map-controls span {
          border-radius: 999px;
          border: 1px solid rgba(10, 10, 10, 0.18);
          padding: 7px 10px;
          color: #050505;
          font-size: 11px;
          font-weight: 740;
          background: rgba(255,255,255,0.18);
        }

        .lp-map-controls .is-active {
          background: #050505;
          color: #b7ff00;
        }

        .lp-ev-bar .blue { background: #2563eb; }
        .lp-ev-bar .red { background: #e63946; }
        .lp-ev-bar i { background: #0a0a0a; }

        .lp-section {
          padding: clamp(96px, 10vw, 150px) 0;
          position: relative;
        }

        .lp-section-title {
          display: flex;
          align-items: flex-start;
          gap: 32px;
          margin-bottom: 64px;
        }

        .lp-section-title h2,
        .lp-work h2,
        .lp-faq h2 {
          margin: 0;
          font-size: 68px;
          line-height: 1;
          letter-spacing: 0;
          font-weight: 540;
        }

        .lp-section-dot,
        .lp-floating-dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: #f4f4ef;
          flex: 0 0 auto;
        }

        .lp-track-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: clamp(22px, 3vw, 44px);
          padding-bottom: 70px;
          border-bottom: 0;
        }

        .lp-track {
          position: relative;
          padding-top: 26px;
          border-top: 1px solid rgba(244, 244, 239, 0.16);
          transition: border-color 260ms ease, transform 280ms cubic-bezier(.2,.8,.2,1);
        }

        .lp-track:hover {
          transform: translateY(-4px);
          border-color: rgba(183, 255, 0, 0.55);
        }

        .lp-track-icon {
          display: block;
          width: 38px;
          height: 38px;
          color: #f4f4ef;
          margin-bottom: 58px;
          transition: color 260ms ease, transform 320ms cubic-bezier(.2,.8,.2,1);
        }

        .lp-track:hover .lp-track-icon {
          color: #b7ff00;
          transform: translateY(-3px) rotate(-4deg);
        }

        .lp-track h3,
        .lp-process-card h3 {
          margin: 24px 0 15px;
          font-size: 23px;
          line-height: 1.02;
          letter-spacing: 0;
          font-weight: 650;
        }

        .lp-track p,
        .lp-process-card p {
          margin: 0;
          color: rgba(244, 244, 239, 0.58);
          font-size: 17px;
          line-height: 1.26;
          letter-spacing: 0;
        }

        .lp-track h3 {
          margin: 0 0 13px;
          font-size: clamp(20px, 1.5vw, 24px);
          line-height: 1.06;
          letter-spacing: -0.02em;
          font-weight: 600;
        }

        .lp-track p {
          font-size: 16px;
          line-height: 1.5;
          letter-spacing: -0.005em;
          color: rgba(244, 244, 239, 0.56);
          max-width: 300px;
        }

        .lp-mark {
          display: inline-block;
          position: relative;
          width: 34px;
          height: 34px;
          transition: transform 260ms cubic-bezier(.2,.8,.2,1);
        }

        .lp-track:hover .lp-mark,
        .lp-process-card:hover .lp-mark {
          transform: rotate(-8deg) scale(1.08);
        }

        .lp-mark-bars:before,
        .lp-mark-bars:after,
        .lp-mark-leaf:before,
        .lp-mark-target:before,
        .lp-mark-target:after,
        .lp-mark-square:before,
        .lp-mark-dots:before,
        .lp-mark-weight:before,
        .lp-mark-model:before,
        .lp-mark-publish:before {
          content: "";
          position: absolute;
          background: #f4f4ef;
        }

        .lp-mark-bars:before,
        .lp-mark-bars:after {
          width: 28px;
          height: 11px;
          border-radius: 99px;
          left: 2px;
          transform: rotate(8deg);
        }

        .lp-mark-bars:before { top: 5px; }
        .lp-mark-bars:after { top: 18px; width: 23px; }

        .lp-mark-leaf:before {
          width: 22px;
          height: 22px;
          border-radius: 0 100% 100% 100%;
          left: 8px;
          top: 8px;
          transform: rotate(42deg);
        }

        .lp-mark-leaf:after,
        .lp-mark-model:after {
          content: "";
          position: absolute;
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #f4f4ef;
          left: 0;
          top: 0;
        }

        .lp-mark-target:before {
          width: 30px;
          height: 30px;
          border-radius: 999px;
          left: 2px;
          top: 2px;
        }

        .lp-mark-target:after {
          width: 12px;
          height: 12px;
          border-radius: 4px;
          background: #050505;
          left: 11px;
          top: 11px;
        }

        .lp-mark-square:before {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          left: 3px;
          top: 3px;
        }

        .lp-mark-square:after {
          content: "";
          position: absolute;
          width: 10px;
          height: 10px;
          border-radius: 4px;
          background: #050505;
          left: 12px;
          top: 12px;
        }

        .lp-mark-dots:before {
          width: 12px;
          height: 12px;
          border-radius: 999px;
          top: 5px;
          left: 2px;
          box-shadow: 16px 13px 0 #f4f4ef;
        }

        .lp-mark-weight:before {
          width: 26px;
          height: 18px;
          top: 8px;
          left: 3px;
          clip-path: polygon(0 0, 100% 0, 100% 70%, 56% 70%, 56% 100%, 0 100%);
        }

        .lp-mark-model:before {
          width: 13px;
          height: 13px;
          transform: rotate(-18deg);
          top: 12px;
          left: 4px;
          box-shadow: 16px -8px 0 #f4f4ef;
        }

        .lp-mark-publish:before {
          width: 27px;
          height: 27px;
          top: 4px;
          left: 4px;
          clip-path: polygon(0 0, 45% 0, 45% 100%, 0 100%, 0 0, 100% 0, 100% 100%, 58% 100%, 58% 0);
        }

        .lp-proof {
          --proof-lift: 0px;
          --proof-scale: 1;
          --proof-grid-y: 46px;
          width: 100vw;
          min-height: 210vh;
          margin: 0 calc(50% - 50vw) 28px;
          padding: 0;
          position: relative;
          z-index: 3;
          background: #050505;
        }

        .lp-proof-stage {
          position: sticky;
          top: 0;
          z-index: 4;
          width: 100vw;
          min-height: 100vh;
          min-height: 100svh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 68px 0;
          overflow: hidden;
          background: #050505;
        }

        .lp-proof h2 {
          max-width: 1020px;
          margin: 0;
          font-size: 76px;
          line-height: 0.98;
          letter-spacing: 0;
          font-weight: 520;
          text-align: center;
          opacity: 0;
          transform: translateY(var(--proof-lift)) scale(var(--proof-scale));
          transform-origin: center center;
          transition: opacity 180ms ease;
          will-change: transform;
        }

        .lp-proof.is-visible h2 {
          opacity: 1;
        }

        .lp-proof h2 span {
          color: rgba(244, 244, 239, 0.16);
          transition: color 90ms linear;
        }

        .lp-proof h2 span.is-lit {
          color: #f4f4ef;
        }

        .lp-proof-grid {
          position: absolute;
          left: 50%;
          top: calc(50% + 104px);
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          width: min(940px, calc(100vw - 160px));
          opacity: 0;
          pointer-events: none;
          transform: translate(-50%, var(--proof-grid-y));
          transition: opacity 420ms ease;
          will-change: transform, opacity;
        }

        .lp-proof.is-counting .lp-proof-grid {
          opacity: 1;
          pointer-events: auto;
        }

        .lp-proof-stat {
          padding-right: 54px;
          margin-right: 54px;
          border-right: 1px solid rgba(255, 255, 255, 0.14);
        }

        .lp-proof-stat:last-child {
          border-right: 0;
          margin-right: 0;
          padding-right: 0;
        }

        .lp-proof-stat b {
          display: block;
          font-size: 108px;
          line-height: 0.88;
          letter-spacing: 0;
          font-weight: 510;
          font-variant-numeric: tabular-nums;
        }

        .lp-proof-stat span {
          display: block;
          margin-top: 14px;
          color: rgba(244, 244, 239, 0.58);
          font-size: 17px;
          letter-spacing: 0;
        }

        /* ---- Cinematic narrative beats ---- */
        .lp-narrative {
          width: 100vw;
          min-height: 320vh;
          margin: 0 calc(50% - 50vw) 0;
          position: relative;
          z-index: 3;
          background: #050505;
        }

        .lp-narrative-stage {
          position: sticky;
          top: 0;
          z-index: 4;
          width: 100vw;
          min-height: 100vh;
          min-height: 100svh;
          display: grid;
          place-items: center;
          padding: 72px clamp(28px, 6vw, 90px);
          overflow: hidden;
        }

        .lp-narr-line {
          grid-area: 1 / 1;
          width: min(1040px, 100%);
          margin: 0;
          text-align: center;
          will-change: opacity, transform;
        }

        .lp-narr-2 {
          font-size: clamp(25px, 3.2vw, 47px);
          line-height: 1.2;
          letter-spacing: -0.02em;
          font-weight: 500;
          color: #f4f4ef;
        }

        .lp-narr-2 span {
          color: rgba(244, 244, 239, 0.18);
          transition: color 130ms linear;
        }

        .lp-narr-2 span.is-lit {
          color: #f4f4ef;
        }

        .lp-narr-3 {
          font-size: clamp(50px, 7.4vw, 116px);
          line-height: 0.96;
          letter-spacing: -0.035em;
          font-weight: 600;
          color: #f4f4ef;
        }

        .lp-section--lead {
          padding-bottom: 0;
        }

        /* Post-narrative content rides up over the pinned finale */
        .lp-aftermath {
          position: relative;
          z-index: 10;
          background: #050505;
          border-radius: 36px 36px 0 0;
          box-shadow: 0 -36px 80px rgba(0, 0, 0, 0.62);
          margin-top: -22vh;
        }

        .lp-aftermath .lp-section--after {
          padding-top: clamp(64px, 7vw, 112px);
        }

        .lp-aftermath .lp-services {
          padding-top: 30px;
        }

        /* Desktop nav flips dark while over the white finale */
        .lp-desktop-nav.is-light .lp-brand-logo {
          background: #0a0a0a;
        }

        .lp-desktop-nav.is-light .lp-desknav-item {
          color: #0a0a0a;
          text-shadow: none;
        }

        .lp-desktop-nav.is-light .lp-desknav-item:hover,
        .lp-desktop-nav.is-light .lp-desknav-item.is-open {
          color: #1c6b00;
        }

        .lp-services {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(320px, 384px);
          gap: clamp(52px, 6vw, 100px);
          align-items: start;
          padding-top: 96px;
          position: relative;
        }

        .lp-services:before {
          content: none;
        }

        .lp-services-main {
          display: flex;
          flex-direction: column;
        }

        .lp-services-eyebrow {
          display: flex;
          align-items: center;
          gap: 13px;
          margin-bottom: 24px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1.9px;
          text-transform: uppercase;
          color: rgba(244, 244, 239, 0.46);
        }

        .lp-services-eyebrow:before {
          content: "";
          width: 28px;
          height: 1px;
          background: rgba(244, 244, 239, 0.32);
        }

        .lp-service-list {
          display: flex;
          flex-direction: column;
          font-size: clamp(24px, 2.4vw, 34px);
          line-height: 1.05;
          letter-spacing: -0.025em;
          font-weight: 500;
        }

        .lp-service-list a {
          display: grid;
          grid-template-columns: 50px minmax(0, 1fr) auto;
          align-items: center;
          gap: 20px;
          width: 100%;
          padding: clamp(16px, 1.5vw, 23px) 2px;
          color: #f4f4ef;
          text-decoration: none;
          border-top: 1px solid rgba(244, 244, 239, 0.14);
          transition: color 200ms ease, padding-left 320ms cubic-bezier(.2, .8, .2, 1);
        }

        .lp-service-list a:last-child {
          border-bottom: 1px solid rgba(244, 244, 239, 0.14);
        }

        .lp-service-list a:before {
          content: attr(data-index);
          font-size: 14px;
          line-height: 1;
          font-weight: 600;
          letter-spacing: 0;
          color: rgba(244, 244, 239, 0.36);
          font-variant-numeric: tabular-nums;
          transition: color 200ms ease;
        }

        .lp-service-label {
          min-width: 0;
        }

        .lp-service-arrow {
          color: #b7ff00;
          font-size: 0.46em;
          font-weight: 700;
          opacity: 0;
          transform: translateX(-12px);
          transition: opacity 200ms ease, transform 260ms cubic-bezier(.2, .8, .2, 1);
        }

        .lp-service-list a:hover {
          color: #b7ff00;
          padding-left: 14px;
        }

        .lp-service-list a:hover:before,
        .lp-service-list a:focus-visible:before {
          color: #b7ff00;
        }

        .lp-service-list a:hover .lp-service-arrow,
        .lp-service-list a:focus-visible .lp-service-arrow {
          opacity: 1;
          transform: translateX(0);
        }

        .lp-coverage {
          min-height: 0;
          border-radius: 20px;
          background: #b7ff00;
          padding: 32px 32px 36px;
          color: #050505;
          position: relative;
          top: auto;
          overflow: hidden;
          box-shadow: 0 24px 60px rgba(117, 180, 0, 0.14);
          transition: transform 260ms cubic-bezier(.2,.8,.2,1), box-shadow 260ms ease;
        }

        .lp-coverage:hover {
          transform: translateY(-5px);
          box-shadow: 0 34px 84px rgba(183, 255, 0, 0.16);
        }

        .lp-coverage:after {
          content: "*";
          position: absolute;
          right: 26px;
          top: 22px;
          font-size: 56px;
          line-height: 1;
          font-weight: 260;
          transform-origin: center;
          transition: transform 320ms cubic-bezier(.2,.8,.2,1);
        }

        .lp-coverage:hover:after {
          transform: rotate(28deg) scale(1.06);
        }

        .lp-coverage h2 {
          margin: 0 0 26px;
          font-size: clamp(32px, 2.6vw, 40px);
          line-height: 0.98;
          letter-spacing: -0.03em;
          font-weight: 600;
          color: #050505;
        }

        .lp-coverage ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: clamp(11px, 1.1vw, 15px);
          font-size: clamp(18px, 1.4vw, 21px);
          color: #050505;
          letter-spacing: -0.015em;
          font-weight: 500;
        }

        .lp-coverage li {
          color: #050505;
        }

        .lp-coverage a {
          color: #050505;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          width: fit-content;
          transition: transform 180ms ease, opacity 180ms ease;
        }

        .lp-coverage a:before {
          content: "";
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: #050505;
          opacity: 0;
          transform: scale(0.4);
          transition: opacity 180ms ease, transform 180ms ease;
        }

        .lp-coverage a:hover {
          transform: translateX(8px);
          opacity: 0.72;
          text-decoration: none;
        }

        .lp-coverage a:hover:before,
        .lp-coverage a:focus-visible:before {
          opacity: 1;
          transform: scale(1);
        }

        .lp-work {
          padding: clamp(108px, 12vw, 178px) 0;
        }

        .lp-process-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 7px;
          padding: 0;
          margin-top: 58px;
          border-radius: 8px;
          background: #050505;
          box-shadow: none;
        }

        .lp-process-card {
          min-height: 236px;
          padding: 36px 34px;
          border-radius: 6px;
          background: #151515;
          border: 1px solid rgba(255, 255, 255, 0.08);
          opacity: 0;
          transition: background 200ms ease, box-shadow 200ms ease, border-color 200ms ease;
        }

        .lp-process-grid.is-in .lp-process-card {
          animation: lp-card-rise 700ms cubic-bezier(.2, .8, .2, 1) both;
        }

        .lp-process-grid.is-in .lp-process-card:nth-child(1) { animation-delay: 50ms; }
        .lp-process-grid.is-in .lp-process-card:nth-child(2) { animation-delay: 125ms; }
        .lp-process-grid.is-in .lp-process-card:nth-child(3) { animation-delay: 200ms; }
        .lp-process-grid.is-in .lp-process-card:nth-child(4) { animation-delay: 275ms; }
        .lp-process-grid.is-in .lp-process-card:nth-child(5) { animation-delay: 350ms; }

        @keyframes lp-card-rise {
          from { opacity: 0; transform: translateY(32px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .lp-process-card:hover {
          background: #1d1d1b;
          border-color: rgba(183, 255, 0, 0.25);
          box-shadow: 0 28px 80px rgba(0, 0, 0, 0.38);
        }

        .lp-process-card:nth-child(5) {
          grid-column: span 2;
        }

        .lp-process-card h3 {
          margin-top: 30px;
          font-size: 25px;
        }

        .lp-process-card p {
          max-width: 620px;
          font-size: 18px;
          line-height: 1.3;
        }

        .lp-faq {
          padding: 48px 0 clamp(102px, 10vw, 152px);
        }

        .lp-faq-inner {
          width: min(1180px, calc(100vw - 160px));
          margin: 0 auto;
          display: grid;
          grid-template-columns: 260px minmax(0, 900px);
          gap: 64px;
          align-items: start;
          justify-content: center;
        }

        .lp-faq p {
          margin: 14px 0 0;
          color: rgba(244, 244, 239, 0.58);
          font-size: 19px;
          letter-spacing: 0;
        }

        .lp-faq-list {
          display: grid;
          gap: 8px;
          width: 100%;
          max-width: 900px;
          margin: 0 auto;
        }

        .lp-faq-row {
          position: relative;
          border: 1px solid rgba(124, 58, 237, 0.26);
          border-radius: 16px;
          background:
            linear-gradient(180deg, rgba(124, 58, 237, 0.16), rgba(124, 58, 237, 0.05)),
            #130b22;
          box-shadow: 0 18px 44px rgba(0, 0, 0, 0.32);
          overflow: hidden;
          transition: transform 220ms ease, background 220ms ease, box-shadow 220ms ease, border-color 220ms ease;
        }

        .lp-faq-row:before {
          content: "";
          position: absolute;
          left: 0;
          top: 14px;
          bottom: 14px;
          width: 3px;
          border-radius: 0 999px 999px 0;
          background: #7c3aed;
          opacity: 0;
          transform: scaleY(0.4);
          transform-origin: center;
          transition: opacity 240ms ease, transform 340ms cubic-bezier(.2, .8, .2, 1);
        }

        .lp-faq-row:hover {
          transform: translateY(-2px);
          border-color: rgba(124, 58, 237, 0.44);
          background:
            linear-gradient(180deg, rgba(124, 58, 237, 0.22), rgba(124, 58, 237, 0.07)),
            #160c28;
          box-shadow: 0 26px 64px rgba(58, 20, 118, 0.4);
        }

        .lp-faq-row.is-open {
          border-color: rgba(124, 58, 237, 0.5);
          background:
            linear-gradient(180deg, rgba(124, 58, 237, 0.26), rgba(124, 58, 237, 0.08)),
            #170d2a;
        }

        .lp-faq-row.is-open:before {
          opacity: 1;
          transform: scaleY(1);
        }

        .lp-faq-button {
          width: 100%;
          border: 0;
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 22px 26px;
          cursor: pointer;
          text-align: left;
          color: #f4f4ef;
          font: inherit;
          font-size: 21px;
          letter-spacing: -0.01em;
          font-weight: 600;
        }

        .lp-faq-button span:last-child {
          font-size: 28px;
          line-height: 0.8;
          font-weight: 400;
          color: #b794f6;
        }

        .lp-faq-answer {
          display: grid;
          grid-template-rows: 0fr;
          transition: grid-template-rows 240ms ease, opacity 240ms ease;
          opacity: 0;
        }

        .lp-faq-row.is-open .lp-faq-answer {
          grid-template-rows: 1fr;
          opacity: 1;
        }

        .lp-faq-answer-inner {
          overflow: hidden;
        }

        .lp-faq-answer p {
          margin: 0;
          padding: 0 26px 28px;
          color: rgba(244, 244, 239, 0.62);
          font-size: 19px;
          line-height: 1.34;
          letter-spacing: -0.005em;
          max-width: 760px;
        }

        .lp-footer {
          background: #050505;
          color: #f4f4ef;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          min-height: 420px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 48px;
          padding: 72px 0 52px;
          overflow: hidden;
        }

        .lp-footer-mark {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 48px;
          line-height: 1;
          font-weight: 820;
          letter-spacing: 0;
          color: #b7ff00;
        }

        .lp-footer-mark span {
          font-size: 16px;
          letter-spacing: 0;
          line-height: 0.96;
          font-weight: 760;
        }

        .lp-marquee {
          width: 100%;
          display: flex;
          white-space: nowrap;
          font-size: 118px;
          line-height: 0.9;
          letter-spacing: 0;
          font-weight: 430;
          color: #b7ff00;
        }

        .lp-marquee span {
          display: inline-block;
          padding-right: 38px;
          animation: lp-marquee 18s linear infinite;
        }

        .lp-footer-email {
          color: #f4f4ef;
          font-size: 58px;
          font-weight: 760;
          letter-spacing: 0;
          text-decoration: underline;
          text-underline-offset: 6px;
          text-decoration-thickness: 4px;
        }

        .lp-footer-links {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 34px;
          flex-wrap: wrap;
          font-size: 15px;
          font-weight: 560;
          color: rgba(244, 244, 239, 0.68);
        }

        .lp-footer-links a {
          color: inherit;
          text-decoration: none;
        }

        .lp-footer-links a:hover,
        .lp-footer-email:hover {
          color: #b7ff00;
          text-decoration: underline;
        }

        @keyframes lp-rise {
          from { opacity: 0; transform: translateY(26px); filter: blur(8px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }

        @keyframes lp-dot-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(0.62); opacity: 0.55; }
        }

        @keyframes lp-gallery-slide {
          from { transform: translateX(0); }
          to { transform: translateX(calc(-50% - 11px)); }
        }

        @keyframes lp-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-100%); }
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *:before,
          *:after {
            animation-duration: 1ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
            transition-duration: 1ms !important;
          }
        }

        @media (max-width: 980px) {
          .lp-shell {
            width: min(100% - 96px, 1280px);
          }

          .lp-hero {
            min-height: auto;
            padding: 58px 0 34px;
          }

          .lp-hero:before {
            right: 44px;
            top: 152px;
            width: 190px;
            height: 310px;
          }

          .lp-nav {
            align-items: flex-start;
            gap: 24px;
            margin-bottom: 46px;
          }

          .lp-nav-links {
            display: none;
          }

          .lp-process-grid,
          .lp-services,
          .lp-faq-inner {
            grid-template-columns: 1fr;
          }

          .lp-track-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 30px 26px;
          }

          .lp-track-icon {
            margin-bottom: 38px;
          }

          .lp-services {
            gap: 52px;
          }

          .lp-services:before {
            display: none;
          }

          .lp-process-card:nth-child(5) {
            grid-column: auto;
          }

          .lp-hero h1 {
            font-size: 66px;
          }

          .lp-hero p {
            font-size: 25px;
          }

          .lp-section-title h2,
          .lp-work h2,
          .lp-faq h2 {
            font-size: 58px;
          }

          .lp-proof h2 {
            font-size: 64px;
            max-width: min(780px, calc(100vw - 96px));
          }

          .lp-proof-stat b {
            font-size: 92px;
          }

          .lp-service-list,
          .lp-coverage h2 {
            font-size: 44px;
          }

          .lp-marquee {
            font-size: 88px;
          }

          .lp-footer-email {
            font-size: 44px;
          }

          .lp-proof-grid {
            grid-template-columns: 1fr;
            gap: 26px;
            top: calc(50% + 96px);
            width: min(620px, calc(100vw - 96px));
          }

          .lp-proof-stat {
            border-right: 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.12);
            margin-right: 0;
            padding: 0 0 26px;
          }

          .lp-proof-stat:last-child {
            border-bottom: 0;
          }

          .lp-coverage {
            position: relative;
            top: auto;
          }

          .lp-topbar {
            display: flex;
          }

          .lp-mobile-menu {
            display: flex;
          }

          .lp-desktop-nav,
          .lp-desktop-menu {
            display: none;
          }

          .lp-hero .lp-nav {
            display: none;
          }

          .lp-hero {
            padding-top: 76px;
          }
        }

        @media (max-width: 680px) {
          .lp-shell {
            width: min(100% - 28px, 1240px);
          }

          .lp-faq-inner {
            width: min(100% - 28px, 1240px);
            gap: 32px;
          }

          .lp-hero {
            min-height: auto;
            padding-top: 70px;
          }

          .lp-hero:before {
            display: none;
          }

          .lp-nav {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            margin: 0 0 42px;
            padding: 7px 7px 7px 13px;
            min-height: 42px;
            border-radius: 999px;
            border: 1px solid rgba(255, 255, 255, 0.11);
            background: rgba(255, 255, 255, 0.055);
            box-shadow: 0 18px 46px rgba(0, 0, 0, 0.28);
            backdrop-filter: blur(18px);
          }

          .lp-wordmark {
            font-size: 18px;
            color: #f4f4ef;
            gap: 0;
          }

          .lp-wordmark span {
            display: none;
          }

          .lp-nav-links {
            display: flex;
            align-items: center;
            gap: 2px;
            color: rgba(244, 244, 239, 0.72);
            font-size: 12px;
            overflow-x: auto;
            scrollbar-width: none;
          }

          .lp-nav-links::-webkit-scrollbar {
            display: none;
          }

          .lp-nav-links a {
            flex: 0 0 auto;
            padding: 8px 10px;
            border-radius: 999px;
            color: inherit;
            line-height: 1;
          }

          .lp-nav-links a:hover,
          .lp-nav-links a:focus-visible {
            color: #050505;
            background: #b7ff00;
            transform: none;
          }

          .lp-nav-links a:nth-child(4) {
            display: none;
          }

          .lp-hero-mark {
            width: 32px;
            height: 28px;
            margin-bottom: 34px;
          }

          .lp-hero-mark:before {
            width: 25px;
            height: 10px;
          }

          .lp-hero-mark:after {
            width: 18px;
            height: 10px;
            top: 17px;
          }

          .lp-hero h1 {
            font-size: 43px;
            line-height: 0.99;
          }

          .lp-hero p {
            font-size: 20px;
          }

          .lp-actions {
            flex-wrap: wrap;
          }

          .lp-dot {
            margin-left: 10px;
          }

          .lp-dot:after {
            width: 22px;
          }

          .lp-gallery-band {
            padding: 24px 0 28px;
          }

          .lp-gallery-card {
            width: min(400px, 90vw);
            min-height: 0;
            padding: 0;
          }

          .lp-gallery-track {
            margin-left: 54px;
            animation-duration: 96s;
            animation-delay: 1.2s;
          }

          .lp-gallery-window:before,
          .lp-gallery-window:after {
            width: 64px;
            backdrop-filter: blur(7px);
            -webkit-backdrop-filter: blur(7px);
          }

          .lp-gallery-window:before {
            background: linear-gradient(90deg, #050505 0%, #050505 26%, rgba(5, 5, 5, 0.55) 60%, transparent 100%);
          }

          .lp-gallery-window:after {
            background: linear-gradient(270deg, #050505 0%, #050505 26%, rgba(5, 5, 5, 0.55) 60%, transparent 100%);
          }

          .lp-art {
            min-height: 286px;
            padding: 18px;
          }

          .lp-art-thumbnail {
            min-height: 0;
            padding: 0;
          }

          .lp-poll-grid,
          .lp-art-ratings,
          .lp-art-results {
            grid-template-columns: 1fr;
          }

          .lp-poll-hero strong,
          .lp-rating-title strong,
          .lp-map-title strong {
            font-size: 30px;
          }

          .lp-poll-hero b {
            font-size: 48px;
          }

          .lp-poll-source-stack {
            display: none;
          }

          .lp-result-console h4 {
            font-size: 32px;
          }

          .lp-result-row {
            grid-template-columns: 104px 1fr 46px;
          }

          .lp-card-head {
            align-items: flex-start;
            flex-direction: column;
          }

          .lp-section-title {
            gap: 18px;
          }

          .lp-services {
            padding-top: 54px;
            gap: 18px;
          }

          .lp-service-list {
            display: flex;
            flex-direction: column;
            gap: 0;
            font-size: clamp(23px, 6.6vw, 30px);
            line-height: 1.1;
            font-weight: 520;
          }

          .lp-service-list a {
            width: 100%;
            display: grid;
            grid-template-columns: auto minmax(0, 1fr) auto;
            align-items: center;
            gap: 16px;
            padding: 17px 2px;
            border: 0;
            border-radius: 0;
            background: none;
            box-shadow: none;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            transform: none;
          }

          .lp-service-list a:first-child {
            padding-top: 2px;
          }

          .lp-service-list a:before {
            position: static;
            opacity: 1;
            transform: none;
            color: rgba(244, 244, 239, 0.4);
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.5px;
            font-variant-numeric: tabular-nums;
          }

          .lp-service-label {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .lp-service-arrow {
            margin-left: 0;
            opacity: 0.9;
            transform: none;
            color: #b7ff00;
            font-size: 19px;
            font-weight: 700;
            vertical-align: 0;
            transition: transform 220ms cubic-bezier(.2,.8,.2,1);
          }

          .lp-service-list a:hover,
          .lp-service-list a:focus-visible,
          .lp-service-list a:active {
            color: #b7ff00;
            transform: none;
            background: none;
            border-color: rgba(183, 255, 0, 0.4);
          }

          .lp-service-list a:active .lp-service-arrow {
            transform: translateX(5px);
          }

          .lp-coverage {
            min-height: 0;
            padding: 28px 24px;
            border-radius: 18px;
            box-shadow: 0 26px 70px rgba(183, 255, 0, 0.14);
          }

          .lp-coverage h2 {
            font-size: 38px;
            margin-bottom: 22px;
          }

          .lp-coverage ul {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 13px 18px;
            font-size: 16px;
            font-weight: 560;
          }

          .lp-coverage a {
            width: fit-content;
            justify-content: flex-start;
            min-height: 0;
            padding: 0;
            border: 0;
            border-radius: 0;
            background: none;
            text-align: left;
            gap: 9px;
          }

          .lp-coverage a:before {
            display: inline-block;
            opacity: 0.5;
            transform: scale(1);
          }

          .lp-coverage a:hover,
          .lp-coverage a:focus-visible,
          .lp-coverage a:active {
            opacity: 1;
            transform: translateX(4px);
            background: none;
            color: #050505;
          }

          .lp-coverage a:active:before {
            opacity: 1;
          }

          .lp-process-card {
            min-height: 184px;
            padding: 28px;
          }

          .lp-process-card h3 {
            font-size: 20px;
            margin-top: 20px;
          }

          .lp-process-card p {
            font-size: 14px;
            line-height: 1.32;
          }

          .lp-faq-button {
            font-size: 19px;
          }

          .lp-footer-email {
            max-width: calc(100vw - 28px);
            font-size: 24px;
            text-align: center;
            overflow-wrap: anywhere;
            text-decoration-thickness: 2px;
            text-underline-offset: 4px;
          }

          .lp-section-title h2,
          .lp-work h2,
          .lp-faq h2 {
            font-size: 44px;
          }

          .lp-proof h2 {
            font-size: 46px;
            max-width: min(360px, calc(100vw - 28px));
            line-height: 1;
          }

          .lp-proof-stat b {
            font-size: 58px;
          }

          .lp-proof {
            min-height: 190vh;
            margin: 0 calc(50% - 50vw) 18px;
          }

          .lp-narrative {
            min-height: 280vh;
          }

          .lp-narrative-stage {
            padding: 42px 22px;
          }

          .lp-proof-stage {
            padding: 42px 0;
            min-height: 100vh;
            min-height: 100svh;
          }

          .lp-proof-grid {
            top: calc(50% + 76px);
            width: min(360px, calc(100vw - 28px));
            gap: 15px;
          }

          .lp-proof-stat {
            padding-bottom: 15px;
            text-align: center;
          }

          .lp-proof-stat span {
            margin-top: 7px;
            font-size: 13px;
          }

          .lp-marquee {
            font-size: 58px;
          }
        }
      `}</style>

      <div className={`lp-root ${manrope.variable}`}>
        <div className="lp-topbar">
          <Link
            href="/"
            className="lp-topbar-brand"
            aria-label="Public Sentiment Institute home"
            onClick={() => setMenuOpen(false)}
          >
            <span className="lp-brand-logo" aria-hidden="true" />
          </Link>
          <button
            type="button"
            className={`lp-burger${menuOpen ? " is-open" : ""}`}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="lp-mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
          </button>
        </div>

        <div
          className={`lp-menu-scrim${menuOpen ? " is-open" : ""}`}
          aria-hidden="true"
          onClick={() => setMenuOpen(false)}
        />

        <div
          id="lp-mobile-menu"
          className={`lp-mobile-menu${menuOpen ? " is-open" : ""}`}
          aria-hidden={!menuOpen}
        >
          <nav className="lp-mobile-menu-list" aria-label="Mobile navigation">
            {services.map((service, index) => (
              <Link
                href={service.href}
                key={service.label}
                onClick={() => setMenuOpen(false)}
                style={{ animationDelay: `${index * 45 + 60}ms` } as React.CSSProperties}
              >
                <span className="idx">{String(index + 1).padStart(2, "0")}</span>
                <span>{service.label}</span>
                <span className="arw" aria-hidden="true">&rarr;</span>
              </Link>
            ))}
          </nav>
          <div className="lp-mobile-menu-foot">
            <Link href="/contact" onClick={() => setMenuOpen(false)}>
              Contact the desk &rarr;
            </Link>
          </div>
        </div>

        <div className={`lp-desktop-nav${navOnLight ? " is-light" : ""}`}>
          <Link
            href="/"
            className="lp-desktop-brand"
            aria-label="Public Sentiment Institute home"
            onClick={() => setMenuOpen(false)}
          >
            <span className="lp-brand-logo" aria-hidden="true" />
          </Link>
          <nav className="lp-desktop-links" aria-label="Primary">
            <button
              type="button"
              className={`lp-desknav-item${menuOpen ? " is-open" : ""}`}
              aria-expanded={menuOpen}
              aria-controls="lp-desktop-menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              Trackers
            </button>
            <button
              type="button"
              className={`lp-desknav-item${menuOpen ? " is-open" : ""}`}
              aria-expanded={menuOpen}
              aria-controls="lp-desktop-menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              Coverage
            </button>
            <Link href="/contact" className="lp-desknav-item" onClick={() => setMenuOpen(false)}>
              Contact
            </Link>
          </nav>
        </div>

        <div
          id="lp-desktop-menu"
          className={`lp-desktop-menu${menuOpen ? " is-open" : ""}`}
          aria-hidden={!menuOpen}
        >
          <div className="lp-desktop-menu-inner">
            <div className="lp-panel-lead">
              <span className="lp-panel-eyebrow">Navigate</span>
              <p className="lp-panel-statement">
                Polling, forecasts, and live election results &mdash; from one transparent data desk.
              </p>
              <Link href="/contact" className="lp-panel-cta" onClick={() => setMenuOpen(false)}>
                Work with PSI &rarr;
              </Link>
            </div>
            <div className="lp-menu-col">
              <span className="lp-menu-col-label">Trackers</span>
              {services.map((service) => (
                <Link href={service.href} key={service.label} onClick={() => setMenuOpen(false)}>
                  {service.label}
                  <span className="a" aria-hidden="true">&rarr;</span>
                </Link>
              ))}
            </div>
            <div className="lp-menu-col">
              <span className="lp-menu-col-label">Coverage</span>
              {coverage.map((item) => (
                <Link href={item.href} key={item.label} onClick={() => setMenuOpen(false)}>
                  {item.label}
                  <span className="a" aria-hidden="true">&rarr;</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <section className="lp-hero">
          <div className="lp-shell">
            <nav className="lp-nav" aria-label="Landing page">
              <Link href="/" className="lp-wordmark" aria-label="Public Sentiment Institute home">
                PSI
                <span>Public Sentiment Institute</span>
              </Link>
              <div className="lp-nav-links">
                <Link href="/polling">Polling</Link>
                <Link href="/forecastratings">Forecasts</Link>
                <Link href="/results">Results</Link>
                <Link href="/contact">Contact</Link>
              </div>
            </nav>

            <div className="lp-hero-copy">
              <span className="lp-hero-mark" aria-hidden="true" />
              <h1>
                Polling averages and forecasts{" "}
                <br />
                for live election results.
              </h1>
              <p>Track voter sentiment, race ratings, and election-night returns from one transparent data desk.</p>
              <div className="lp-actions">
                <Link href="/polling" className="lp-pill">Polling</Link>
                <Link href="/forecastratings" className="lp-pill lp-pill-dark">Forecasts</Link>
                <span className="lp-dot" aria-hidden="true" />
              </div>
            </div>
          </div>
        </section>

        <section className="lp-gallery-band" aria-label="TPSI product gallery">
          <div className="lp-gallery-window">
            <div className="lp-gallery-track">
              {galleryLoop.map((item, index) => (
                <GalleryCard key={`${item.title}-${index}`} item={item} />
              ))}
            </div>
          </div>
        </section>

        <section className="lp-section lp-section--lead">
          <div className="lp-shell">
            <div className="lp-section-title">
              <span className="lp-section-dot" aria-hidden="true" />
              <h2>What the institute tracks</h2>
            </div>

            <div className="lp-track-grid">
              {tracks.map((item) => (
                <TrackColumn key={item.title} item={item} />
              ))}
            </div>

            <div
              ref={proofRef}
              style={proofStyle}
              className={`lp-proof${proofProgress > 0.02 ? " is-visible" : ""}${
                proofProgress > 0.72 ? " is-settling" : ""
              }${
                proofArmed || proofProgress > 0.78 ? " is-counting" : ""
              }`}
            >
              <div className="lp-proof-stage">
                <h2 aria-label={proofText}>
                  {proofText.split("").map((char, index) => {
                    const ratio = index / Math.max(proofText.length - 1, 1);
                    return (
                      <span
                        key={`${char}-${index}`}
                        aria-hidden="true"
                        className={ratio <= proofLetterProgress ? "is-lit" : undefined}
                      >
                        {char}
                      </span>
                    );
                  })}
                </h2>
                <div className="lp-proof-grid">
                  <div className="lp-proof-stat"><b>{proofCounts.approval}</b><span>approval polls in model</span></div>
                  <div className="lp-proof-stat"><b>{proofCounts.generic}</b><span>generic ballot polls</span></div>
                  <div className="lp-proof-stat"><b>{proofCounts.states}</b><span>states in forecast map</span></div>
                </div>
              </div>
            </div>

            <div ref={narrativeRef} className="lp-narrative" style={{ background: narrativeBg }}>
              <div className="lp-narrative-stage">
                <p
                  className="lp-narr-line lp-narr-2"
                  style={{ opacity: narr2Opacity, transform: `translateY(${narr2Y}px)` }}
                  aria-label={narrativeStatement}
                >
                  {narrativeStatement.split(" ").map((word, index, words) => {
                    const ratio = index / Math.max(words.length - 1, 1);
                    return (
                      <span
                        key={`${word}-${index}`}
                        aria-hidden="true"
                        className={ratio <= narr2Highlight ? "is-lit" : undefined}
                      >
                        {index < words.length - 1 ? `${word} ` : word}
                      </span>
                    );
                  })}
                </p>
                <p
                  className="lp-narr-line lp-narr-3"
                  style={{ opacity: narr3Opacity, transform: `translateY(${narr3Y}px)`, color: narr3Color }}
                  aria-hidden={narr3Opacity < 0.5}
                >
                  That&apos;s why we are here.
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="lp-aftermath">
          <section className="lp-section lp-section--after">
            <div className="lp-shell">
            <div className="lp-services">
              <div className="lp-services-main">
                <span className="lp-services-eyebrow">What we publish</span>
                <div className="lp-service-list" aria-label="TPSI feature list">
                  {services.map((service, index) => (
                    <Link href={service.href} key={service.label} data-index={String(index + 1).padStart(2, "0")}>
                      <span className="lp-service-label">{service.label}</span>
                      <span className="lp-service-arrow" aria-hidden="true">&rarr;</span>
                    </Link>
                  ))}
                </div>
              </div>

              <aside className="lp-coverage" aria-label="Coverage areas">
                <h2>Coverage</h2>
                <ul>
                  {coverage.map((item) => (
                    <li key={item.label}>
                      <Link href={item.href}>{item.label}</Link>
                    </li>
                  ))}
                </ul>
              </aside>
            </div>
          </div>
        </section>

        <section className="lp-work">
          <div className="lp-shell">
            <h2>Approach</h2>
            <div
              ref={processRef}
              className={`lp-process-grid${processInView ? " is-in" : ""}`}
            >
              {process.map((item) => (
                <ProcessCard key={item.title} item={item} />
              ))}
            </div>
          </div>
        </section>

        <section className="lp-faq">
          <div className="lp-faq-inner">
            <div>
              <h2>FAQ</h2>
              <p>Common questions about PSI data</p>
            </div>
            <div className="lp-faq-list">
              {faqs.map((faq, index) => {
                const open = index === openFaq;
                return (
                  <div key={faq.question} className={`lp-faq-row${open ? " is-open" : ""}`}>
                    <button
                      type="button"
                      className="lp-faq-button"
                      aria-expanded={open}
                      onClick={() => setOpenFaq(open ? -1 : index)}
                    >
                      <span>{faq.question}</span>
                      <span aria-hidden="true">{open ? "-" : "+"}</span>
                    </button>
                    <div className="lp-faq-answer">
                      <div className="lp-faq-answer-inner">
                        <p>{faq.answer}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="lp-footer" aria-label="Work with PSI">
          <div className="lp-footer-mark">
            PSI
            <span>Public<br />Sentiment<br />Institute</span>
          </div>
          <div className="lp-marquee" aria-hidden="true">
            <span>Work with public sentiment * Work with public sentiment *</span>
            <span>Work with public sentiment * Work with public sentiment *</span>
          </div>
          <Link href="mailto:tpsinstitutecontact@gmail.com" className="lp-footer-email">tpsinstitutecontact@gmail.com</Link>
          <div className="lp-footer-links">
            <span>Public Sentiment Institute</span>
            <Link href="/polling">Polling</Link>
            <Link href="/forecastratings">Forecasts</Link>
            <Link href="/results">Results</Link>
            <Link href="/contact">Contact</Link>
          </div>
        </section>
        </div>
      </div>
    </>
  );
}
