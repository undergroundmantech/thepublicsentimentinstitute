// Served at /2028/sitemap.xml: the 2028 home, its tools and every state's 2028 page. Submit it in Search Console.
import type { MetadataRoute } from "next";
import { SITE } from "@/app/lib/seo";
import { stateCodes } from "./data28";
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE.url}/2028`, lastModified: now, changeFrequency: "daily", priority: 1 },
    ...["primaries", "general"].map((p) => ({ url: `${SITE.url}/2028/${p}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.8 })),
    ...stateCodes().map((s) => ({ url: `${SITE.url}/2028/${s.toLowerCase()}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.7 })),
  ];
}
