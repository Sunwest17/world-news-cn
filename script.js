const state = {
  articles: [],
  categories: [],
  activeCategory: "all",
  query: "",
  cachedData: null
};

const liveFeeds = [
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

const elements = {
  updatedAt: document.querySelector("#updatedAt"),
  articleCount: document.querySelector("#articleCount"),
  sourceNote: document.querySelector("#sourceNote"),
  refreshButton: document.querySelector("#refreshButton"),
  searchInput: document.querySelector("#searchInput"),
  categoryList: document.querySelector("#categoryList"),
  leadCard: document.querySelector("#leadCard"),
  briefStack: document.querySelector("#briefStack"),
  newsGrid: document.querySelector("#newsGrid"),
  resultSummary: document.querySelector("#resultSummary"),
  stateCard: document.querySelector("#stateCard")
};

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
  hour12: false
});

const relativeFormatter = new Intl.RelativeTimeFormat("zh-CN", {
  numeric: "auto"
});

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未知";
  return dateTimeFormatter.format(date);
}

function formatRelativeTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未知";
  const minutes = Math.round((date.getTime() - Date.now()) / 60000);
  if (Math.abs(minutes) < 60) return relativeFormatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relativeFormatter.format(hours, "hour");
  return relativeFormatter.format(Math.round(hours / 24), "day");
}

function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function getFavicon(url) {
  const domain = getDomain(url);
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : "";
}

function cleanText(value, limit = 160) {
  return String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&#160;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function stripSource(title = "") {
  return title.replace(/\s+-\s+[^-]+$/, "").trim();
}

function getItemSource(item, rawTitle) {
  const source = item.querySelector("source")?.textContent?.trim();
  if (source) return source;
  const match = String(rawTitle || "").match(/\s+-\s+([^-]+)$/);
  return match?.[1]?.trim() || "新闻来源";
}

function parseJsonFeed(data, feed) {
  const items = Array.isArray(data.items) ? data.items.slice(0, 18) : [];
  return items
    .map((item) => {
      const rawTitle = item.title || "";
      const link = item.link || "";
      const publishedAt = item.pubDate || new Date().toISOString();
      return {
        id: btoa(unescape(encodeURIComponent(`${feed.key}:${link || rawTitle}`))).slice(0, 24),
        title: cleanText(stripSource(rawTitle), 110),
        source: item.author || getItemSource({ querySelector: () => null }, rawTitle),
        category: feed.label,
        categoryKey: feed.key,
        url: link,
        publishedAt: new Date(publishedAt).toISOString(),
        summary: cleanText(item.description || item.content || "", 160)
      };
    })
    .filter((article) => article.title && article.url);
}

async function fetchLiveFeed(feed) {
  const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`;
  const response = await fetch(proxyUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`${feed.label} 新闻读取失败`);
  const data = await response.json();
  if (data.status !== "ok") throw new Error(`${feed.label} 新闻解析失败`);
  return parseJsonFeed(data, feed);
}

async function fetchLiveNews() {
  const groups = await Promise.allSettled(liveFeeds.map(fetchLiveFeed));
  const articles = groups
    .flatMap((group) => (group.status === "fulfilled" ? group.value : []))
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  const uniqueArticles = [...new Map(articles.map((article) => [article.title, article])).values()];
  if (uniqueArticles.length < 8) throw new Error("实时新闻数量不足");
  return {
    siteName: "环球即刻",
    updatedAt: new Date().toISOString(),
    sourceNote: "实时中文新闻聚合",
    categories: liveFeeds.map(({ key, label }) => ({ key, label })),
    articles: uniqueArticles.slice(0, 72)
  };
}

function articleMeta(article) {
  const icon = getFavicon(article.url);
  return `
    <div class="article-meta">
      ${icon ? `<img class="source-icon" src="${icon}" alt="${article.source} 图标" loading="lazy">` : ""}
      <span class="category-tag">${article.category}</span>
      <span>${article.source}</span>
      <span>${formatRelativeTime(article.publishedAt)}</span>
    </div>
  `;
}

function renderCategories() {
  const categories = [{ key: "all", label: "全部" }, ...state.categories];
  elements.categoryList.innerHTML = categories
    .map(
      (category) => `
        <button class="category-button ${state.activeCategory === category.key ? "active" : ""}"
          type="button"
          data-category="${category.key}">
          ${category.label}
        </button>
      `
    )
    .join("");
}

function getFilteredArticles() {
  return state.articles.filter((article) => {
    const matchesCategory =
      state.activeCategory === "all" || article.categoryKey === state.activeCategory;
    const keyword = state.query.trim().toLowerCase();
    const matchesQuery =
      !keyword ||
      `${article.title} ${article.summary} ${article.source} ${article.category}`
        .toLowerCase()
        .includes(keyword);
    return matchesCategory && matchesQuery;
  });
}

function renderLead(articles) {
  const [lead, ...rest] = articles;
  if (!lead) {
    elements.leadCard.classList.remove("ready");
    elements.leadCard.innerHTML = "<h2>暂时没有匹配新闻</h2><p class=\"article-summary\">可以清空搜索词或切换到全部分类。</p>";
    elements.briefStack.innerHTML = "";
    return;
  }

  elements.leadCard.classList.add("ready");
  elements.leadCard.innerHTML = `
    ${articleMeta(lead)}
    <h2>${lead.title}</h2>
    <p class="article-summary">${lead.summary || "点击进入原始报道阅读完整内容。"}</p>
    <a class="article-link" href="${lead.url}" target="_blank" rel="noopener noreferrer">阅读原文</a>
  `;

  elements.briefStack.innerHTML = rest
    .slice(0, 3)
    .map(
      (article) => `
        <article class="brief-card">
          ${articleMeta(article)}
          <h3>${article.title}</h3>
        </article>
      `
    )
    .join("");
}

function renderNews() {
  const articles = getFilteredArticles();
  renderLead(articles);

  elements.resultSummary.textContent = `当前显示 ${articles.length} 条新闻`;
  elements.newsGrid.innerHTML = articles
    .slice(4)
    .map(
      (article) => `
        <article class="news-card">
          ${articleMeta(article)}
          <h3>${article.title}</h3>
          <p class="article-summary">${article.summary || "点击进入原始报道阅读完整内容。"}</p>
          <a class="article-link" href="${article.url}" target="_blank" rel="noopener noreferrer">阅读原文</a>
        </article>
      `
    )
    .join("");

  elements.stateCard.classList.toggle("hidden", articles.length > 0);
  if (articles.length === 0) {
    elements.stateCard.textContent = "没有找到符合条件的新闻。";
  }
}

function renderPage(data) {
  state.articles = data.articles || [];
  state.categories = data.categories || [];
  elements.updatedAt.textContent = formatDateTime(data.updatedAt);
  elements.articleCount.textContent = String(state.articles.length);
  elements.sourceNote.textContent = data.sourceNote || "中文新闻聚合";
  renderCategories();
  renderNews();
}

async function loadNews() {
  elements.resultSummary.textContent = "正在加载新闻";
  elements.stateCard.classList.add("hidden");

  try {
    const response = await fetch(`data/news.json?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`新闻数据读取失败：${response.status}`);
    const data = await response.json();
    state.cachedData = data;
    renderPage(data);
    const liveData = await fetchLiveNews();
    renderPage(liveData);
  } catch (error) {
    if (state.cachedData) {
      renderPage(state.cachedData);
      elements.resultSummary.textContent = `实时读取暂时不可用，正在显示备用缓存，共 ${state.articles.length} 条新闻`;
      return;
    }
    elements.leadCard.classList.remove("ready");
    elements.leadCard.innerHTML = "<h2>新闻数据暂时无法读取</h2><p class=\"article-summary\">请稍后刷新页面，或检查备用新闻缓存是否存在。</p>";
    elements.briefStack.innerHTML = "";
    elements.newsGrid.innerHTML = "";
    elements.resultSummary.textContent = "读取失败";
    elements.stateCard.classList.remove("hidden");
    elements.stateCard.textContent = error.message;
  }
}

elements.categoryList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  state.activeCategory = button.dataset.category;
  renderCategories();
  renderNews();
});

elements.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderNews();
});

elements.refreshButton.addEventListener("click", loadNews);

loadNews();
