// Served at /2028-presidential-candidates/sitemap.xml: the candidates page and one page per name. Submit it in Search Console.
import type { MetadataRoute } from "next";
import { SITE } from "@/app/lib/seo";
import { CANDS, UPDATED } from "./data";
import { slugOf } from "./slug";
export default function sitemap(): MetadataRoute.Sitemap {
  const at = new Date(UPDATED + "T12:00:00-05:00");
  return [{ url: `${SITE.url}/2028-presidential-candidates`, lastModified: at, changeFrequency: "daily", priority: 1 },
    ...CANDS.map((c) => ({ url: `${SITE.url}/2028-presidential-candidates/${slugOf(c.name)}`, lastModified: at, changeFrequency: "weekly" as const, priority: c.status === "out" ? 0.5 : 0.8 }))];
}
