// A sitemap for the On Point Polling section, served at /on-point-polling/sitemap.xml, so every service page is listed
// the day it ships. Submit it in Search Console beside the main sitemap.
import type { MetadataRoute } from "next";
import { SITE } from "@/app/lib/seo";
import { SERVICES, svcHref } from "./home/services";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const u = (path: string, priority: number, changeFrequency: "weekly" | "monthly" = "monthly") => ({ url: `${SITE.url}${path}`, lastModified: now, changeFrequency, priority });
  return [
    u("/on-point-polling", 1, "weekly"),
    ...SERVICES.map((s) => u(svcHref(s), 0.8)),
    u("/on-point-polling/methodology", 0.7),
    u("/on-point-polling/polls", 0.7, "weekly"),
  ];
}
