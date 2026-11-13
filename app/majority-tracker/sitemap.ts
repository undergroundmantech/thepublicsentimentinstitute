// The Majority Tracker's own sitemap, served at /majority-tracker/sitemap.xml. Submit it in Search Console
// beside the main sitemap. lastModified follows UPDATED in data.ts, so every update is announced to crawlers.
import type { MetadataRoute } from "next";
import { SITE } from "@/app/lib/seo";
import { UPDATED } from "./data";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${SITE.url}/majority-tracker`, lastModified: new Date(UPDATED + "T12:00:00-05:00"), changeFrequency: "daily", priority: 0.9 }];
}
