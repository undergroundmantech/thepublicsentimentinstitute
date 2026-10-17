// Search engines and AI answer engines are welcome everywhere public. The client portal, the
// retired pages and a QA fixture stay out, and every crawler is pointed at the sitemap.
import type { MetadataRoute } from "next";
import { SITE } from "@/app/lib/seo";

const PRIVATE = ["/portal/", "/api/freshtake", "/api/flags", "/gone", "/results/timeline-qa", "/v2", "/polling/old/"];

// Named so each one is invited explicitly: search indexes and the crawlers behind AI answers and citations.
const AI_AND_SEARCH = [
  "Googlebot", "Google-Extended", "Bingbot", "Applebot", "Applebot-Extended", "DuckDuckBot", "DuckAssistBot",
  "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot", "anthropic-ai",
  "PerplexityBot", "Perplexity-User", "Amazonbot", "meta-externalagent", "MistralAI-User", "cohere-ai", "YouBot", "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: AI_AND_SEARCH, allow: "/", disallow: PRIVATE },
      { userAgent: "*", allow: "/", disallow: PRIVATE },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
