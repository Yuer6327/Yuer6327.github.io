# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Personal homepage for **Yuer6327**, deployed on **Vercel** (region `sin1`, auto-deploy from `main`), custom domain `yuer6327.top` (apex 307 → `www.yuer6327.top`). Live site: https://www.yuer6327.top.

No build step, package manager, bundler, linter, or tests. The site is one self-contained HTML file (embedded CSS + inline JS, GSAP inlined verbatim). The repo is named `yuer6327/yuer6327.github.io` but is served by Vercel, not GitHub Pages.

## Preview and deploy

```bash
# Local preview (any static server; needed for RSS fetch CORS checks in some browsers)
npx --yes serve .
# or: python -m http.server 8000

# Production: push main → Vercel deploys it to the CNAME domain
git push origin main
```

After `push main`, a GitHub Actions workflow (`cache-hit-check.yml`) waits for the Vercel deploy, preheats the edge cache, and reports `X-Vercel-Cache` HIT/MISS as a `hit-report` artifact on the run.

Only `index.html` is the live entry. Design experiments live in sibling files and are not served unless renamed/copied over `index.html`.

## File roles

| File | Role |
|------|------|
| `index.html` | **Production** homepage. Seed-driven generative design + GSAP (3.13.0, inlined verbatim at end of body). Single self-contained file. |
| `vercel.json` | Vercel cache headers. Applies `Cache-Control: public, max-age=0, s-maxage=315360000, must-revalidate` to everything. |
| `.github/workflows/cache-hit-check.yml` | Cache preheat on push to `main`: waits for deploy, curls the pages, counts HIT/MISS, uploads report. |
| `CNAME` | Leftover from GitHub Pages; unused by Vercel (served as a static file at `/CNAME`). Harmless. |

## Architecture (single-page)

One self-contained HTML file:

1. **Head** — meta (zh-CN), canonical `https://yuer6327.top`, `preconnect` to `blog.yuer6327.top` (RSS), favicon inlined as data URIs. **No `<script>` in head** — zero executable code and zero render-blocking requests; analytics are lazy-loaded at end of body.
2. **CSS in `<style>`** — design tokens on `:root` (overwritten at runtime by the seed/mood engine), section layout, GSAP-driven reveal + micro-interactions, responsive breakpoints, `prefers-reduced-motion`.
3. **Body** — narrow shell: Hero → Projects → Links → Latest Posts → Footer.
4. **End-of-body scripts, strict order** — ① liquidGL v2.0.1 (vendored WebGL liquid-glass, defines `window.liquidGL`); ② GSAP 3.13.0 inlined verbatim (kept out of `<head>` so the boot veil paints before ~72 KB of JS is parsed); ③ app IIFE — seed-driven generative engine (mood → layout/palette/chrome), Shanghai clock, GSAP entrance + micro-interactions, RSS post list; ④ Umami loader — injects the analytics `<script async>` on `load` + `requestIdleCallback` (tracking never competes with the document download or delays the seedbar).

There is no shared CSS/JS module system. Copy patterns deliberately between variants; do not assume a shared asset pipeline.

### Design notes

- The design is **seed-driven generative**: a seed/mood determines layout, palette, and chrome at runtime, overwriting the CSS variables. Base tokens: accent `#018574` (teal); dark background `#0E0D0B`; warm off-white text.
- **Fonts are system-only** — no external font/CDN. Display: `Georgia, "Noto Serif SC", serif`; body: `system-ui, "PingFang SC", "Microsoft YaHei", sans-serif`; mono: `ui-monospace, "Cascadia Code", ...`. No `@font-face`, no woff2, no fontsource CDN (jsdmirror is no longer used).
- Motion: GSAP tweens + decelerate ease `cubic-bezier(0.16, 1, 0.3, 1)`; always honor `prefers-reduced-motion`.

### Dynamic data

- **Time**: `Asia/Shanghai` via `toLocaleTimeString` / `toLocaleString` with `zh-CN`; footer shows `UTC+8`.
- **Posts**: `fetch('https://blog.yuer6327.top/rss.xml')`, parse with `DOMParser`, skip items without `content:encoded`, show up to 8. Titles/tags/dates/descriptions go through an HTML-escape helper before `innerHTML`.
- **Projects / social links**: hard-coded in markup (Blog, Mathle, English, RIES; X, GitHub, bilibili, Outlook).

### Caching (Vercel)

Cache strategy follows https://upxuu.com/posts/vercel-youxuan-cache (「缓存配置」+「缓存预热」):

- `vercel.json` sets `Cache-Control: public, max-age=0, s-maxage=315360000, must-revalidate` on everything: the browser doesn't cache (updates propagate immediately), the Vercel edge caches 10 years (invalidated automatically on redeploy).
- After each deploy the edge cache starts empty; the GitHub Actions workflow preheats all pages so the first visitor hits `X-Vercel-Cache: HIT` too.
- The apex `yuer6327.top` → `www` redirect is edge-generated and carries no `X-Vercel-Cache`, so the preheat warms only `www` URLs.

## External surfaces (do not invent URLs)

- Blog / RSS / favicon: `https://blog.yuer6327.top`
- Mathle: `https://wordle.yuer6327.top/`
- English: `https://english.yuer6327.top/`
- RIES: `https://ries.yuer6327.top/`
- GitHub user: `https://github.com/Yuer6327`
- bilibili: `https://space.bilibili.com/1280938461`

## Conventions for edits

- Keep Chinese UI copy and `lang="zh-CN"` unless the user asks otherwise.
- Prefer single-file changes; avoid introducing a build toolchain unless explicitly requested.
- Escape any RSS/user-derived strings before injecting HTML.
- New visual work: either extend the active production style in `index.html`, or develop in a design experiment file and promote when ready.
- `.claude/` and `.obsidian/` are gitignored; do not commit them.
