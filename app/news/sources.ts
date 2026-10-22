// Every outlet the news desk reads, with On Point Politics' own lean rating and the public feeds it publishes.
// Ratings are ours: see /news/sources for the method. The site shows three labels, Left, Center and Right; "lean"
// records how far from the center we judge an outlet to sit, so a Lean Left outlet is shown as Left.
// Not carried, by house rule: The New York Times, Politico, Decision Desk HQ, X and the Star Tribune.

export type Lean = "L" | "C" | "R";
export type Cat = "politics" | "us" | "world" | "business" | "tech" | "health" | "science" | "sports" | "culture";
export type Outlet = {
  id: string; name: string; domain: string; lean: Lean; degree: "lean" | "full"; why: string;
  feeds: { url: string; cat: Cat }[]; opinionHeavy?: boolean;
};

export const CATS: { k: Cat; l: string }[] = [
  { k: "politics", l: "Politics" }, { k: "us", l: "U.S." }, { k: "world", l: "World" }, { k: "business", l: "Business" },
  { k: "tech", l: "Tech" }, { k: "health", l: "Health" }, { k: "science", l: "Science" }, { k: "sports", l: "Sports" }, { k: "culture", l: "Culture" },
];
export const LEAN_LABEL: Record<Lean, string> = { L: "Left", C: "Center", R: "Right" };

const fox = (s: string) => `https://moxie.foxnews.com/google-publisher/${s}.xml`;
const npr = (n: number) => `https://feeds.npr.org/${n}/rss.xml`;
const cbs = (s: string) => `https://www.cbsnews.com/latest/rss/${s}`;
const nbc = (s: string) => `https://feeds.nbcnews.com/nbcnews/public/${s}`;
const abc = (s: string) => `https://abcnews.com/abcnews/${s}`;
const bbc = (s: string) => `https://feeds.bbci.co.uk/news/${s}rss.xml`;
const gdn = (s: string) => `https://www.theguardian.com/${s}/rss`;

export const OUTLETS: Outlet[] = [
  // ---- Left ----
  { id: "guardian", name: "The Guardian", domain: "theguardian.com", lean: "L", degree: "full", why: "Editorial line openly progressive; story selection and framing lean left on U.S. politics.",
    feeds: [{ url: gdn("us-news/us-politics"), cat: "politics" }, { url: gdn("us-news"), cat: "us" }, { url: gdn("world"), cat: "world" }, { url: gdn("business"), cat: "business" }, { url: gdn("technology"), cat: "tech" }, { url: gdn("science"), cat: "science" }, { url: gdn("sport"), cat: "sports" }] },
  { id: "huffpost", name: "HuffPost", domain: "huffpost.com", lean: "L", degree: "full", why: "Progressive voice in headlines and framing; heavy use of commentary in news pages.",
    feeds: [{ url: "https://www.huffpost.com/section/politics/feed", cat: "politics" }, { url: "https://www.huffpost.com/section/front-page/feed", cat: "us" }] },
  { id: "vox", name: "Vox", domain: "vox.com", lean: "L", degree: "full", why: "Explanatory journalism from a stated progressive viewpoint.", feeds: [{ url: "https://www.vox.com/rss/index.xml", cat: "politics" }] },
  { id: "msnow", name: "MS NOW", domain: "ms.now", lean: "L", degree: "full", why: "Formerly MSNBC; prime time and digital coverage built around progressive commentary.", feeds: [{ url: "https://www.ms.now/feeds/latest", cat: "politics" }] },
  { id: "atlantic", name: "The Atlantic", domain: "theatlantic.com", lean: "L", degree: "lean", why: "Magazine journalism and argument, center left on most political questions.", feeds: [{ url: "https://www.theatlantic.com/feed/all/", cat: "culture" }] },
  { id: "cnn", name: "CNN", domain: "cnn.com", lean: "L", degree: "lean", why: "Straight news desk with framing and story choice that tilt left of center.",
    feeds: [{ url: "http://rss.cnn.com/rss/cnn_allpolitics.rss", cat: "politics" }, { url: "http://rss.cnn.com/rss/cnn_topstories.rss", cat: "us" }, { url: "http://rss.cnn.com/rss/cnn_world.rss", cat: "world" }] },
  { id: "nbc", name: "NBC News", domain: "nbcnews.com", lean: "L", degree: "lean", why: "Network news with framing and source choice that tilt left of center.",
    feeds: [{ url: nbc("politics"), cat: "politics" }, { url: nbc("news"), cat: "us" }, { url: nbc("world"), cat: "world" }, { url: nbc("business"), cat: "business" }, { url: nbc("tech"), cat: "tech" }, { url: nbc("health"), cat: "health" }, { url: nbc("science"), cat: "science" }] },
  { id: "cbs", name: "CBS News", domain: "cbsnews.com", lean: "L", degree: "lean", why: "Network news, mostly straight, with story choice that tilts left of center.",
    feeds: [{ url: cbs("politics"), cat: "politics" }, { url: cbs("us"), cat: "us" }, { url: cbs("world"), cat: "world" }, { url: cbs("moneywatch"), cat: "business" }, { url: cbs("technology"), cat: "tech" }, { url: cbs("health"), cat: "health" }, { url: cbs("science"), cat: "science" }] },
  { id: "abc", name: "ABC News", domain: "abcnews.com", lean: "L", degree: "lean", why: "Network news with framing that tilts left of center. Wire stories it republishes are credited to the Associated Press.",
    feeds: [{ url: abc("politicsheadlines"), cat: "politics" }, { url: abc("usheadlines"), cat: "us" }, { url: abc("internationalheadlines"), cat: "world" }, { url: abc("moneyheadlines"), cat: "business" }, { url: abc("technologyheadlines"), cat: "tech" }, { url: abc("healthheadlines"), cat: "health" }] },
  { id: "npr", name: "NPR", domain: "npr.org", lean: "L", degree: "lean", why: "Public radio news, careful in tone, with story selection and framing left of center.",
    feeds: [{ url: npr(1014), cat: "politics" }, { url: npr(1001), cat: "us" }, { url: npr(1004), cat: "world" }, { url: npr(1006), cat: "business" }, { url: npr(1019), cat: "tech" }, { url: npr(1128), cat: "health" }, { url: npr(1007), cat: "science" }] },
  { id: "wapo", name: "The Washington Post", domain: "washingtonpost.com", lean: "L", degree: "lean", why: "Newsroom coverage left of center; the opinion section narrowed its focus to personal liberty and free markets in 2025.",
    feeds: [{ url: "https://feeds.washingtonpost.com/rss/politics", cat: "politics" }, { url: "https://feeds.washingtonpost.com/rss/national", cat: "us" }, { url: "https://feeds.washingtonpost.com/rss/world", cat: "world" }, { url: "https://feeds.washingtonpost.com/rss/business", cat: "business" }] },
  { id: "aljazeera", name: "Al Jazeera", domain: "aljazeera.com", lean: "L", degree: "lean", why: "International broadcaster; U.S. and Middle East framing left of center.", feeds: [{ url: "https://www.aljazeera.com/xml/rss/all.xml", cat: "world" }] },
  { id: "mpr", name: "MPR News", domain: "mprnews.org", lean: "L", degree: "lean", why: "Minnesota public radio; mostly straight news, story choice left of center.", feeds: [] },
  { id: "haaretz", name: "Haaretz", domain: "haaretz.com", lean: "L", degree: "lean", why: "Israeli daily with a left of center editorial line.", feeds: [] },
  // ---- Center ----
  { id: "ap", name: "Associated Press", domain: "apnews.com", lean: "C", degree: "full", why: "Wire service written for every kind of outlet; plain, attributed copy. Read through the AP stories other outlets republish.", feeds: [] },
  { id: "hill", name: "The Hill", domain: "thehill.com", lean: "C", degree: "full", why: "Capitol Hill trade paper; news pages balanced in choice and framing, opinion from both sides.",
    feeds: [{ url: "https://thehill.com/news/feed/", cat: "politics" }, { url: "https://thehill.com/homenews/campaign/feed/", cat: "politics" }, { url: "https://thehill.com/policy/international/feed/", cat: "world" }, { url: "https://thehill.com/business/feed/", cat: "business" }, { url: "https://thehill.com/policy/technology/feed/", cat: "tech" }, { url: "https://thehill.com/policy/healthcare/feed/", cat: "health" }] },
  { id: "bbc", name: "BBC News", domain: "bbc.com", lean: "C", degree: "full", why: "British public broadcaster held to impartiality rules; U.S. coverage straight and sourced.",
    feeds: [{ url: bbc("world/us_and_canada/"), cat: "us" }, { url: bbc("world/"), cat: "world" }, { url: bbc("business/"), cat: "business" }, { url: bbc("technology/"), cat: "tech" }, { url: bbc("health/"), cat: "health" }, { url: bbc("science_and_environment/"), cat: "science" }] },
  { id: "csm", name: "The Christian Science Monitor", domain: "csmonitor.com", lean: "C", degree: "full", why: "Deliberately even tone, explanatory and sourced across viewpoints.",
    feeds: [{ url: "https://rss.csmonitor.com/feeds/usa", cat: "us" }, { url: "https://rss.csmonitor.com/feeds/world", cat: "world" }] },
  { id: "newsweek", name: "Newsweek", domain: "newsweek.com", lean: "C", degree: "full", why: "High volume news with a mix of left and right sources and contributors.", feeds: [{ url: "https://www.newsweek.com/rss", cat: "us" }] },
  { id: "wsj", name: "The Wall Street Journal", domain: "wsj.com", lean: "C", degree: "full", why: "News pages straight and business focused; the right leaning editorial page is kept out of this feed.",
    feeds: [{ url: "https://feeds.a.dj.com/rss/RSSWorldNews.xml", cat: "world" }, { url: "https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml", cat: "business" }, { url: "https://feeds.a.dj.com/rss/RSSWSJD.xml", cat: "tech" }] },
  { id: "axios", name: "Axios", domain: "axios.com", lean: "C", degree: "full", why: "Short, sourced items with little framing.", feeds: [{ url: "https://api.axios.com/feed/", cat: "politics" }] },
  { id: "cnbc", name: "CNBC", domain: "cnbc.com", lean: "C", degree: "full", why: "Business news first, politics through markets and money.",
    feeds: [{ url: "https://www.cnbc.com/id/100003114/device/rss/rss.html", cat: "business" }, { url: "https://www.cnbc.com/id/10000113/device/rss/rss.html", cat: "politics" }, { url: "https://www.cnbc.com/id/19854910/device/rss/rss.html", cat: "tech" }] },
  { id: "newsnation", name: "NewsNation", domain: "newsnationnow.com", lean: "C", degree: "full", why: "Cable news built around a stated aim of balance.", feeds: [{ url: "https://www.newsnationnow.com/feed/", cat: "us" }] },
  { id: "usnews", name: "U.S. News", domain: "usnews.com", lean: "C", degree: "full", why: "Mostly wire copy from the Associated Press and Reuters.", feeds: [] },
  { id: "jewishinsider", name: "Jewish Insider", domain: "jewishinsider.com", lean: "C", degree: "full", why: "Political news on Israel and Jewish communities, reported across both parties.", feeds: [] },
  { id: "local", name: "Local TV and papers", domain: "", lean: "C", degree: "full", why: "Local television stations and papers, rated together as straight local news.", feeds: [] },
  // ---- Right ----
  { id: "fox", name: "Fox News", domain: "foxnews.com", lean: "R", degree: "full", why: "News desk framing and story choice right of center; prime time commentary conservative.",
    feeds: [{ url: fox("politics"), cat: "politics" }, { url: fox("us"), cat: "us" }, { url: fox("world"), cat: "world" }, { url: fox("tech"), cat: "tech" }, { url: fox("health"), cat: "health" }, { url: fox("science"), cat: "science" }, { url: fox("sports"), cat: "sports" }] },
  { id: "nypost", name: "New York Post", domain: "nypost.com", lean: "R", degree: "lean", why: "Tabloid news with a conservative editorial line and story choice.",
    feeds: [{ url: "https://nypost.com/politics/feed/", cat: "politics" }, { url: "https://nypost.com/news/feed/", cat: "us" }, { url: "https://nypost.com/business/feed/", cat: "business" }, { url: "https://nypost.com/tech/feed/", cat: "tech" }, { url: "https://nypost.com/sports/feed/", cat: "sports" }] },
  { id: "examiner", name: "Washington Examiner", domain: "washingtonexaminer.com", lean: "R", degree: "lean", why: "Conservative magazine and news site; reporting right of center, opinion openly conservative.", feeds: [{ url: "https://www.washingtonexaminer.com/feed/", cat: "politics" }] },
  { id: "wtimes", name: "The Washington Times", domain: "washingtontimes.com", lean: "R", degree: "lean", why: "Conservative daily; story choice and framing right of center.",
    feeds: [{ url: "https://www.washingtontimes.com/rss/headlines/news/politics/", cat: "politics" }, { url: "https://www.washingtontimes.com/rss/headlines/news/world/", cat: "world" }] },
  { id: "dailywire", name: "The Daily Wire", domain: "dailywire.com", lean: "R", degree: "full", why: "Conservative outlet mixing news and commentary.", feeds: [{ url: "https://www.dailywire.com/feeds/rss.xml", cat: "politics" }] },
  { id: "breitbart", name: "Breitbart", domain: "breitbart.com", lean: "R", degree: "full", why: "Populist right; framing and story choice openly conservative.", feeds: [{ url: "https://feeds.feedburner.com/breitbart", cat: "politics" }] },
  { id: "federalist", name: "The Federalist", domain: "thefederalist.com", lean: "R", degree: "full", why: "Conservative commentary and reporting.", feeds: [{ url: "https://thefederalist.com/feed/", cat: "politics" }], opinionHeavy: true },
  { id: "nr", name: "National Review", domain: "nationalreview.com", lean: "R", degree: "full", why: "The conservative movement's magazine of argument; mostly opinion.", feeds: [{ url: "https://www.nationalreview.com/feed/", cat: "politics" }], opinionHeavy: true },
  { id: "caller", name: "The Daily Caller", domain: "dailycaller.com", lean: "R", degree: "full", why: "Conservative news site; framing and choice right of center.", feeds: [{ url: "https://dailycaller.com/feed/", cat: "politics" }] },
  { id: "newsmax", name: "Newsmax", domain: "newsmax.com", lean: "R", degree: "full", why: "Conservative cable and web news.", feeds: [{ url: "https://www.newsmax.com/rss/Newsfront/16/", cat: "politics" }] },
  { id: "reason", name: "Reason", domain: "reason.com", lean: "R", degree: "lean", why: "Libertarian magazine; right of center on economics, often left of the right on social issues.", feeds: [{ url: "https://reason.com/feed/", cat: "politics" }], opinionHeavy: true },
  { id: "jns", name: "JNS", domain: "jns.org", lean: "R", degree: "lean", why: "Jewish News Syndicate; Israel coverage right of center.", feeds: [] },
];
export const OUTLET = Object.fromEntries(OUTLETS.map((o) => [o.id, o])) as Record<string, Outlet>;
