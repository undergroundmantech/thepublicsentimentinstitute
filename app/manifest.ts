import type { MetadataRoute } from "next";
import { SITE } from "@/app/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: SITE.short,
    description: SITE.description,
    start_url: "/",
    display: "standalone",
    background_color: "#0a0711",
    theme_color: "#110019",
    categories: ["news", "politics"],
    icons: [
      { src: "/icon.png", sizes: "900x900", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
