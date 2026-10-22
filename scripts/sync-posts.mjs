#!/usr/bin/env node
/**
 * 同步 index.html 中 Latest Posts 的硬编码兜底快照。
 *
 * 背景：index.html 里那 8 行 <a class="item item--post"> 是 RSS 拉取失败时的离线
 * 兜底；同时也是首屏直接渲染的内容。当它和线上 RSS 完全一致时，页面里的
 * postsMatchDom() 会命中「跳过重绘」的快路径（不重放 stagger 动画，利于 Speed
 * Index）。所以这份快照必须随博客更新而保持同步。
 *
 * 本脚本由 .github/workflows/sync-posts.yml 定时执行：抓 RSS → 重写这 8 行 →
 * 有变化才提交。任何异常（网络、解析、结构不符）都直接非 0 退出且不落盘，
 * 快照保持原样，绝不写出半个文件。
 *
 * 用法：
 *   node scripts/sync-posts.mjs            # 就地更新
 *   node scripts/sync-posts.mjs --check    # 只检查是否已是最新（过期则退出码 1）
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INDEX = path.join(ROOT, "index.html");

/* 抓取源按优先级尝试。
   首选公开域名，与被同步的线上内容同源；但 blog.yuer6327.top 挂在 Cloudflare
   自定义域后面，zone 里的 WAF 规则 `cf.threat_score gt 10 → challenge` 会把
   GitHub Actions 的 runner IP（Azure 数据中心段）判成可疑：实测 /rss.xml 与 / 均返回
   403 + `cf-mitigated: challenge`（"Just a moment..." 挑战页）。
   所以备用源用 Pages 部署别名（同一份构建产物、不走该 zone 的 WAF，实测 200 且
   字节数一致），公开域名被 challenge 时自动回退。RSS 内的 <link> 是绝对地址，
   回退不影响写进 index.html 的链接。 */
const FEEDS = [
  "https://blog.yuer6327.top/rss.xml",
  "https://blog-4em.pages.dev/rss.xml"
];
const UA = "yuer6327-homepage-sync/1.0 (+https://www.yuer6327.top/)";
const MAX_POSTS = 8;
const LIST_ANCHOR = 'id="posts-list"';

const CHECK_ONLY = process.argv.includes("--check");

/* 依次尝试 FEEDS，第一个拿到真 RSS 的源胜出；全部失败才抛错 */
async function fetchFeed() {
  const failures = [];
  for (const url of FEEDS) {
    console.log(`抓取 ${url} …`);
    try {
      const res = await fetch(url, {
        headers: {
          "user-agent": UA,
          accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8"
        },
        redirect: "follow",
        signal: AbortSignal.timeout(20000)
      });
      if (!res.ok) {
        failures.push(`${url} → HTTP ${res.status}`);
        continue;
      }
      const xml = await res.text();
      /* 挑战页/错误页也可能以 200 返回，用 RSS 骨架再确认一次 */
      if (!xml.includes("<rss") || !xml.includes("<item>")) {
        failures.push(`${url} → 返回内容不是 RSS`);
        continue;
      }
      if (url !== FEEDS[0]) console.log(`已回退到备用源（${failures.join("；")}）`);
      return xml;
    } catch (err) {
      failures.push(`${url} → ${err.message}`);
    }
  }
  throw new Error(`所有抓取源均失败：${failures.join("；")}`);
}

/* 与 index.html 里的 esc() 逐字符一致：& 必须最先替换 */
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* 标签内的原始文本：去掉 CDATA 包裹，再解一层实体（与 DOMParser 的 textContent 一致） */
function decode(s) {
  return String(s)
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/* 纯索引扫描，不用正则拼字符串：避免转义歧义，也让「找不到」是显式分支 */
function sliceBetween(text, open, close, from = 0) {
  const a = text.indexOf(open, from);
  if (a < 0) return null;
  const b = text.indexOf(close, a + open.length);
  if (b < 0) return null;
  return { text: text.slice(a + open.length, b), end: b + close.length };
}

function field(scope, tag) {
  const r = sliceBetween(scope, `<${tag}>`, `</${tag}>`);
  return r ? decode(r.text.trim()) : "";
}

function items(xml) {
  const out = [];
  let pos = 0;
  for (;;) {
    const r = sliceBetween(xml, "<item>", "</item>", pos);
    if (!r) break;
    out.push(r.text);
    pos = r.end;
  }
  return out;
}

/* 与页面 parseRssXml 一致：跳过没有 content:encoded 的条目，最多 8 条 */
function parseFeed(xml) {
  const posts = [];
  for (const item of items(xml)) {
    if (posts.length >= MAX_POSTS) break;
    if (!item.includes("<content:encoded>")) continue;

    /* 正文（content:encoded）是条目里最大的一块 HTML，也是唯一可能混进
       裸 <title>/<link> 字样的地方；字段只在它之前的部分里找。 */
    const bodyAt = item.indexOf("<content:encoded>");
    const head = bodyAt < 0 ? item : item.slice(0, bodyAt);

    const title = field(head, "title") || "Untitled";
    const link = field(head, "link");
    /* pubDate 理论上也在正文之前，但顺序无保证：head 里没有就退回全条目 */
    let raw = field(head, "pubDate");
    if (!raw) raw = field(item, "pubDate");

    let date = "";
    if (raw) {
      const d = new Date(raw);
      /* 与页面同一条本地化调用，保证两边输出逐字符一致 */
      date = Number.isNaN(d.getTime())
        ? raw.slice(0, 16)
        : d.toLocaleDateString("zh-CN", {
            timeZone: "Asia/Shanghai",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
          });
    }

    const cats = [];
    for (let p = 0; cats.length < 3; ) {
      const c = sliceBetween(head, "<category>", "</category>", p);
      if (!c) break;
      const v = decode(c.text.trim());
      if (v) cats.push(v);
      p = c.end;
    }

    posts.push({ title, link, date, cats });
  }
  return posts;
}

/* 与页面 renderPostItems 输出同样的结构；快照 = RSS 渲染结果，才谈得上「一致」 */
function renderRows(posts) {
  return posts.map((p) => {
    const tags = (p.cats || [])
      .map((c) => `<span class="tag">${esc(c)}</span>`)
      .join("");
    return (
      '      <a class="item item--post" href="' + esc(p.link) + '" target="_blank" rel="noopener">' +
      '<span class="item-main">' +
      '<span class="item-label">' + esc(p.title) + "</span>" +
      '<span class="item-meta">' + esc(p.date) + "</span>" +
      (tags ? '<span class="item-tags">' + tags + "</span>" : "") +
      "</span>" +
      '<span class="item-go">→</span></a>'
    );
  });
}

/* 落盘前的最后一道闸：形状不符就整行拒绝，绝不把畸形 HTML 写进线上文件 */
const ROW_RE = new RegExp(
  '^ {6}<a class="item item--post" href="[^"<>]+" target="_blank" rel="noopener">' +
    '<span class="item-main">' +
    '<span class="item-label">[^<>]+</span>' +
    '<span class="item-meta">[^<>]*</span>' +
    '(?:<span class="item-tags">(?:<span class="tag">[^<>]+</span>)*</span>)?' +
    "</span>" +
    '<span class="item-go">→</span></a>$'
);

function sync(html, rows) {
  const eol = html.includes("\r\n") ? "\r\n" : "\n";
  const lines = html.split(/\r?\n/);

  const openIdx = lines.findIndex((l) => l.includes(LIST_ANCHOR));
  if (openIdx < 0) throw new Error(`index.html 里找不到 ${LIST_ANCHOR}`);

  /* 列表由 #posts-list 自身的 <div> 收尾：文章行缩进 6 空格，容器闭合标签
     缩进 4 空格，所以第一个 4 空格缩进的 </div> 就是它的收尾。 */
  let closeIdx = -1;
  for (let i = openIdx + 1; i < lines.length; i++) {
    if (/^ {4}<\/div>$/.test(lines[i])) { closeIdx = i; break; }
  }
  if (closeIdx < 0) throw new Error("#posts-list 的收尾 </div> 找不到");

  /* 只认「整块都是文章行」的形态；出现别的东西说明结构变了，宁可不改 */
  const current = lines.slice(openIdx + 1, closeIdx);
  if (!current.length) throw new Error("#posts-list 内没有任何文章行，已中止");
  const looksLikeRows = current.every((l) => /^\s*<a class="item item--post"/.test(l));
  if (!looksLikeRows) {
    throw new Error(`#posts-list 内不是预期的文章行结构（${current.length} 行），已中止`);
  }

  const next = lines.slice(0, openIdx + 1).concat(rows, lines.slice(closeIdx));
  const out = next.join(eol);
  return { html: out, changed: out !== html, replaced: current.length, eol };
}

async function main() {
  const xml = await fetchFeed();

  const posts = parseFeed(xml);
  if (!posts.length) throw new Error("RSS 里没有解析出任何带 content:encoded 的条目");

  const rows = renderRows(posts);
  for (const r of rows) {
    if (!ROW_RE.test(r)) throw new Error(`生成的行结构异常，已中止：\n${r}`);
  }
  console.log(`解析出 ${posts.length} 条：${posts.map((p) => p.title).join(" / ")}`);

  const before = fs.readFileSync(INDEX, "utf8");
  const { html, changed, replaced, eol } = sync(before, rows);

  if (!changed) {
    console.log(`快照已是最新（${replaced} 行，EOL=${JSON.stringify(eol)}），无需改动。`);
    return 0;
  }

  console.log(`快照过期：${replaced} 行 → ${rows.length} 行，${CHECK_ONLY ? "仅检查" : "准备重写"}。`);
  for (const r of rows) console.log("  " + r.trim().slice(0, 120));

  if (CHECK_ONLY) return 1;

  fs.writeFileSync(INDEX, html, "utf8");
  console.log("已重写 index.html。");
  return 0;
}

/* 用 process.exitCode 而不是 process.exit()：fetch 还持有 undici 句柄时立刻
   process.exit() 会在 Windows 上撞到 libuv 断言（async.c:76），退出码变成 127，
   CI 就分不清「快照过期」和「脚本崩了」。设 exitCode 让事件循环自然收尾即可。 */
main()
  .then((code) => { process.exitCode = code; })
  .catch((err) => {
    console.error(`同步失败（index.html 未改动）：${err.message}`);
    process.exitCode = 2;
  });
