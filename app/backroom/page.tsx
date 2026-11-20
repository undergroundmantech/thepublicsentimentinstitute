import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DESK_COOKIE, verifyDeskSession } from "@/app/lib/deskSession";
import DeskLogin from "./DeskLogin";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } } };
export const dynamic = "force-dynamic";

export default async function Backroom() {
  const jar = await cookies();
  if (await verifyDeskSession(jar.get(DESK_COOKIE)?.value)) redirect("/backroom/weighting");
  return <DeskLogin />;
}
