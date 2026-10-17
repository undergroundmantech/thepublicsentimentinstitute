// Share cards for links on X, Facebook, LinkedIn, iMessage and Slack, and the image search engines
// show beside a result. One layout for every forecast page: what the page is, who leads, by how much.
import { ImageResponse } from "next/og";
import fs from "node:fs";
import path from "node:path";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_TYPE = "image/png";

const font = (f: string) => fs.readFileSync(path.join(process.cwd(), "assets", "og", f));
let fonts: { name: string; data: Buffer; weight: 500 | 700 | 900; style: "normal" }[] | null = null;
const loadFonts = () =>
  (fonts ??= [
    { name: "Geist", data: font("Geist-Medium.ttf"), weight: 500, style: "normal" },
    { name: "Geist", data: font("Geist-Bold.ttf"), weight: 700, style: "normal" },
    { name: "Geist", data: font("Geist-Black.ttf"), weight: 900, style: "normal" },
    { name: "GeistMono", data: font("GeistMono-Bold.ttf"), weight: 700, style: "normal" },
  ]);

// the brand mark, with its gradient set as an attribute so the image renderer needs no stylesheet
const MARK =
  "data:image/svg+xml;base64," +
  Buffer.from(
    fs.readFileSync(path.join(process.cwd(), "public", "icon.svg"), "utf8")
      .replace(/<style>[\s\S]*?<\/style>/, "")
      .replace(/class="cls-1"/g, 'fill="url(#linear-gradient)"'),
  ).toString("base64");

export const C = { dem: "#3d7bff", gop: "#ff3b5c", ind: "#b78cff", yes: "#2fbf9b", no: "#e8794a", gold: "#e7b341", ink: "#f3eff8", mute: "#9a90b0" };

export type Side = { label: string; value: string; color: string };
export type Card = {
  eyebrow: string;
  title: string;
  sub?: string;
  left?: Side;
  right?: Side;
  /** Share of the bar that belongs to the left side, 0 to 1. */
  split?: number;
  /** A marker on the bar, 0 to 1, such as the threshold a measure needs. */
  mark?: number;
  foot?: string;
};

const fit = (t: string) => (t.length > 46 ? 54 : t.length > 34 ? 64 : t.length > 22 ? 76 : 88);

export function ogCard(c: Card) {
  const split = Math.max(0.02, Math.min(0.98, c.split ?? 0.5));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "54px 64px 50px", backgroundColor: "#0a0711", backgroundImage: "linear-gradient(125deg, #0c1a4d 0%, #0a0711 42%, #0a0711 62%, #3a0a1f 100%)", fontFamily: "Geist", color: C.ink, position: "relative" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
            <img src={MARK} width={52} height={52} />
            <div style={{ display: "flex", fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>On Point Politics</div>
          </div>
          <div style={{ display: "flex", fontFamily: "GeistMono", fontSize: 19, letterSpacing: 2.5, color: C.mute, textTransform: "uppercase" }}>{c.eyebrow}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", fontSize: fit(c.title), fontWeight: 900, letterSpacing: -2.5, lineHeight: 1.02 }}>{c.title}</div>
          {c.sub ? <div style={{ display: "flex", fontSize: 32, fontWeight: 500, color: "#c9c0da", lineHeight: 1.25 }}>{c.sub}</div> : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {c.left && c.right ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: c.left.color }}>{c.left.label}</div>
                <div style={{ display: "flex", fontFamily: "GeistMono", fontSize: 76, fontWeight: 700, color: c.left.color, letterSpacing: -3 }}>{c.left.value}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end" }}>
                <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: c.right.color }}>{c.right.label}</div>
                <div style={{ display: "flex", fontFamily: "GeistMono", fontSize: 76, fontWeight: 700, color: c.right.color, letterSpacing: -3 }}>{c.right.value}</div>
              </div>
            </div>
          ) : null}
          {c.left && c.right ? (
            <div style={{ display: "flex", position: "relative", height: 18, borderRadius: 18, overflow: "hidden", background: c.right.color }}>
              <div style={{ display: "flex", width: `${split * 100}%`, height: "100%", background: c.left.color }} />
              {c.mark != null ? <div style={{ position: "absolute", left: `${c.mark * 100}%`, top: 0, width: 4, height: 18, background: "#ffffff", display: "flex" }} /> : null}
            </div>
          ) : null}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 21, color: C.mute }}>
            <div style={{ display: "flex" }}>{c.foot ?? "Forecasts, polling averages and live results"}</div>
            <div style={{ display: "flex", fontFamily: "GeistMono", fontWeight: 700 }}>onpointpolitics.com</div>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: loadFonts() },
  );
}

export const pctOg = (p: number) => (p > 0.99 ? ">99%" : p < 0.01 ? "<1%" : `${Math.round(p * 100)}%`);
export const dayOg = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
