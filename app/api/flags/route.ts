import { NextResponse } from "next/server";

// Rollout configuration, evaluated from the deploy's environment. Clients
// bootstrap from this on load; stages flip per-environment in Vercel.
export async function GET() {
  const v2 = process.env.NEXT_PUBLIC_SITE_V2 === "on";
  return NextResponse.json(
    {
      flags: {
        "site-v2": {
          enabled: v2,
          stage: v2 ? "ga" : "dark",
        },
        "site-v2-announcement": {
          enabled: v2 || process.env.NEXT_PUBLIC_ANNOUNCE === "on",
          stage: v2 ? "ga" : "dark",
        },
        "forecast-desk": {
          enabled: v2 && process.env.NEXT_PUBLIC_FORECAST === "on",
          stage: "internal",
        },
        "situation-room": {
          enabled: process.env.NEXT_PUBLIC_SITUATION_ROOM === "on",
          stage: "internal",
        },
      },
      evaluated: "environment",
    },
    { headers: { "cache-control": "no-store" } },
  );
}
