import { XMLParser } from "fast-xml-parser";
import { writeFile, mkdir } from "node:fs/promises";

const feeds = [
  {
    key: "world",
    label: "全球",
    url: "https://news.google.com/rss/headlines/section/topic/WORLD?hl=zh-CN&gl=CN&ceid=CN:zh-Hans"
  },
  {
    key: "politics",
    label: "政治",
    url: "https://news.google.com/rss/search?q=%E5%9B%BD%E9%99%85%20%E6%94%BF%E6%B2%BB&hl=zh-CN&gl=CN&ceid=CN:zh-Hans"
  },
  {
    key: "economy",
    label: "经济",
    url: "https://news.google.com/rss/search?q=%E5%85%A8%E7%90%83%20%E7%BB%8F%E6%B5%8E&hl=zh-CN&gl=CN&ceid=CN:zh-Hans"
  },
  {
    key: "tech",
    label: "科技",
    url: "https://news.google.com/rss/search?q=%E5%9B%BD%E9%99%85%20%E7%A7%91%E6%8A%80&hl=zh-CN&gl=CN&ceid=CN:zh-Hans"
  },
  {
    key: "conflict",
    label: "冲突",
    url: "https://news.google.com/rss/search?q=%E5%9B%BD%E9%99%85%20%E5%86%B2%E7%AA%81%20OR%20%E6%88%98%E4%BA%89&hl=zh-CN&gl=CN&ceid=CN:zh-Hans"
  },
  {
    key: "climate",
    label: "气候",
    url: "https://news.google.com/rss/search?q=%E5%85%A8%E7%90%83%20%E6%B0%94%E5%80%99&hl=zh-CN&gl=CN&ceid=CN:zh-Hans"
  }
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  htmlEntities: true
});

const stripSource = (title = "") => title.replace(/\s+-\s+[^-]+$/, "").trim();

const cleanText = (value = "", limit = 160) =>
  String(value)
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&#160;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);

const getSource = (item, rawTitle) => {
  if (item.source?.["#text"]) return item.source["#text"];
  const match = String(rawTitle || "").match(/\s+-\s+([^-]+)$/);
  return match?.[1]?.trim() || "新闻来源";
};

const getItems = (channel) => {
  const raw = channel?.item || [];
  return Array.isArray(raw) ? raw : [raw];
};

async function fetchFeed(feed) {
  const response = await fetch(feed.url, {
    headers: {
      "user-agent": "world-news-cn/1.0 (+https://github.com/Sunwest17/world-news-cn)"
    }
  });

  if (!response.ok) {
    throw new Error(`${feed.label} 抓取失败：${response.status}`);
  }

  const xml = await response.text();
  const parsed = parser.parse(xml);
  return getItems(parsed.rss?.channel)
    .slice(0, 18)
    .map((item) => {
      const title = String(item.title || "").trim();
      return {
        id: Buffer.from(`${feed.key}:${item.link || title}`).toString("base64url").slice(0, 24),
        title: cleanText(stripSource(title), 110),
        source: getSource(item, title),
        category: feed.label,
        categoryKey: feed.key,
        url: item.link || "",
        publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        summary: cleanText(item.description || "", 160)
      };
    })
    .filter((item) => item.title && item.url);
}

const groups = await Promise.allSettled(feeds.map(fetchFeed));
const articles = groups
  .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
  .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

const uniqueArticles = Array.from(
  new Map(articles.map((article) => [article.title, article])).values()
).slice(0, 72);

const payload = {
  siteName: "环球即刻",
  updatedAt: new Date().toISOString(),
  sourceNote: "中文 Google News RSS 聚合",
  categories: feeds.map(({ key, label }) => ({ key, label })),
  articles: uniqueArticles
};

await mkdir("data", { recursive: true });
await writeFile("data/news.json", `${JSON.stringify(payload, null, 2)}\n`, "utf8");

console.log(`已写入 ${uniqueArticles.length} 条新闻`);
