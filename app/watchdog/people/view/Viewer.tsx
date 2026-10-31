"use client";
// Opens any file in the Watchdog database by its id, from public/watchdog/people/p/<id>.json, so the 1,200 roster files
// do not each need a page built ahead.
import React, { useEffect, useState } from "react";
import Link from "@/app/components/Link";
import { useSearchParams } from "next/navigation";
import PersonFile, { type PFileX } from "../PersonFile";

export default function Viewer() {
  const id = useSearchParams().get("id") ?? "";
  const [p, setP] = useState<PFileX | null | "none">(null);
  useEffect(() => {
    if (!/^[A-Z]{2}-[a-z0-9-]+$/.test(id)) { setP("none"); return; }
    setP(null);
    fetch(`/watchdog/people/p/${id}.json`).then((r) => (r.ok ? r.json() : "none")).then(setP).catch(() => setP("none"));
  }, [id]);
  useEffect(() => { if (p && p !== "none") document.title = `${p.name}: Watchdog file | On Point Politics`; }, [p]);
  if (p === "none") return <div className="wd-empty">No file with that name. <Link href="/watchdog/people">Back to every file</Link></div>;
  if (!p) return <div className="wd-empty">Opening the file</div>;
  return <PersonFile p={p} />;
}
