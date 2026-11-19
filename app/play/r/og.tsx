// The share card for Campaign 2028: a tile map of the result or of the game, the score and the call to play.
import { ImageResponse } from "next/og";
import fs from "node:fs";
import path from "node:path";
import { TILES } from "../share28";

export const SIZE = { width: 1200, height: 630 };
const font = (f: string) => fs.readFileSync(path.join(process.cwd(), "assets", "og", f));
let fonts: { name: string; data: Buffer; weight: 500 | 700 | 900; style: "normal" }[] | null = null;
const F = () => (fonts ??= [
  { name: "Geist", data: font("Geist-Bold.ttf"), weight: 700, style: "normal" },
  { name: "Geist", data: font("Geist-Black.ttf"), weight: 900, style: "normal" },
  { name: "GeistMono", data: font("GeistMono-Bold.ttf"), weight: 700, style: "normal" },
]);
const D = "#2a5ee8", R = "#e0284b";

export function playCard(o: { eyebrow: string; title: string; sub: string; dWon: Record<string, boolean>; left?: [string, number]; right?: [string, number] }) {
  const cell = 46, gap = 5;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", padding: "44px 52px", color: "#f3eff8", fontFamily: "Geist", backgroundColor: "#0b0716", backgroundImage: "linear-gradient(125deg, #0c1a4d 0%, #0b0716 45%, #0b0716 60%, #3a0a1f 100%)" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 520 }}>
          <div style={{ display: "flex", fontFamily: "GeistMono", fontSize: 20, letterSpacing: 3, color: "#ffcc4d", textTransform: "uppercase" }}>{o.eyebrow}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", fontSize: o.title.length > 34 ? 52 : 64, fontWeight: 900, lineHeight: 1.02, letterSpacing: -2 }}>{o.title}</div>
            <div style={{ display: "flex", fontSize: 26, color: "#c9c0da", lineHeight: 1.3, maxWidth: 460 }}>{o.sub}</div>
          </div>
          {o.left && o.right ? (
            <div style={{ display: "flex", gap: 28, alignItems: "flex-end" }}>
              <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: 22, fontWeight: 700, color: "#7fa4ff" }}>{o.left[0]}</div><div style={{ display: "flex", fontFamily: "GeistMono", fontSize: 72, color: "#5b8cff" }}>{String(o.left[1])}</div></div>
              <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: 22, fontWeight: 700, color: "#ff8da1" }}>{o.right[0]}</div><div style={{ display: "flex", fontFamily: "GeistMono", fontSize: 72, color: "#ff3b5c" }}>{String(o.right[1])}</div></div>
            </div>
          ) : null}
          <div style={{ display: "flex", fontFamily: "GeistMono", fontSize: 22, color: "#9a90b0" }}>onpointpolitics.us/play</div>
        </div>
        <div style={{ display: "flex", position: "relative", width: 12 * (cell + gap), height: 8 * (cell + gap), marginLeft: "auto", alignSelf: "center" }}>
          {Object.entries(TILES).map(([st, [c, r]]) => (
            <div key={st} style={{ position: "absolute", left: c * (cell + gap), top: r * (cell + gap), width: cell, height: cell, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
              background: o.dWon[st] ? D : R, fontFamily: "GeistMono", fontSize: 15, color: "#ffffff" }}>{st}</div>
          ))}
        </div>
      </div>
    ),
    { ...SIZE, fonts: F() },
  );
}
