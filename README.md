# 环球即刻

一个全中文的实时世界新闻浏览网站。

## 数据来源

页面打开时会主动读取中文 Google News RSS，并使用 `data/news.json` 作为备用缓存。这样不需要服务器，也适合部署到 GitHub Pages。

## 本地运行

```powershell
npm install
npm run fetch:news
npm run serve
```

## 发布

仓库使用 GitHub Pages 从 `main` 分支根目录发布。推送到 `main` 后，GitHub Pages 会直接托管 `index.html`。
