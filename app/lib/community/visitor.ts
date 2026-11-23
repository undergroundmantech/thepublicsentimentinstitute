// A reader's anonymous id for votes and predictions: a random cookie, stored only as a keyed hash, plus a hash of the
// network address so one machine can't stuff a poll by clearing cookies.
import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { hid } from "./store";

export async function visitor(): Promise<{ id: string; ip: string; fresh?: string }> {
  const jar = await cookies(); const h = await headers();
  let raw = jar.get("op_v")?.value; let fresh: string | undefined;
  if (!raw || !/^[a-f0-9]{32}$/.test(raw)) { raw = crypto.randomBytes(16).toString("hex"); fresh = raw; }
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "local";
  return { id: hid("v:" + raw), ip: hid("ip:" + ip), fresh };
}
export const visitorCookie = (raw: string) => ({ name: "op_v", value: raw, httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 400 });
