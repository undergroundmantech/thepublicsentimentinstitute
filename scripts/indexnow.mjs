// Tells Bing, Yandex and the engines that share IndexNow about every page in the live sitemap, so new and changed
// pages are crawled within hours instead of weeks. Bing's index feeds ChatGPT search, Copilot and DuckDuckGo.
// Run after a deploy is live: node scripts/indexnow.mjs   The key file public/1c2398cb7d70c5545012d3ab8fa7f012.txt proves the site is ours.
const KEY = "1c2398cb7d70c5545012d3ab8fa7f012", HOST = "onpointpolitics.us";
const xml = await (await fetch(`https://${HOST}/sitemap.xml`)).text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => u.includes(HOST));
console.log(`${urls.length} pages in the sitemap`);
for (let i = 0; i < urls.length; i += 10000) {
  const r = await fetch("https://api.indexnow.org/indexnow", { method: "POST", headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls.slice(i, i + 10000) }) });
  console.log(`IndexNow ${r.status} ${r.status === 200 || r.status === 202 ? "accepted" : await r.text()}`);
}
