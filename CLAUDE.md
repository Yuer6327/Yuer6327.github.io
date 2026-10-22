# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Personal homepage for **Yuer6327**, deployed on **Vercel** (region `sin1`, auto-deploy from `main`), custom domain `yuer6327.top` (apex 307 → `www.yuer6327.top`). Live site: https://www.yuer6327.top.

No build step, package manager, bundler, linter, or tests. The site is one self-contained HTML file (embedded CSS + inline JS, GSAP inlined verbatim). The repo is named `yuer6327/yuer6327.github.io` but is served by Vercel, not GitHub Pages.

## Preview and deploy

```bash
# Local preview (any static server)
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
| `.github/workflows/sync-posts.yml` | Scheduled (daily 19:07 UTC = 03:07 CST) rewrite of the Latest Posts list in `index.html`. Commits via `GITHUB_TOKEN` on change, then dispatches `cache-hit-check.yml` (a bot push does not re-trigger `push` workflows, so the edge cache would otherwise stay cold). |
| `scripts/sync-posts.mjs` | The sync script used by that workflow. Regenerates the 8 post rows from the blog's `latest-posts.json` (RSS is only a fallback). Tries `https://blog.yuer6327.top/…` first, then the Pages alias `https://blog-4em.pages.dev/…` (see Gotcha below). All validation happens before any write — on any failure (network, parse, structure) it exits non-zero and leaves `index.html` untouched. `--check` reports staleness via exit code (0 current, 1 stale). |
| `CNAME` | Leftover from GitHub Pages; unused by Vercel (served as a static file at `/CNAME`). Harmless. |

## Architecture (single-page)

One self-contained HTML file:

1. **Head** — meta (zh-CN), canonical `https://yuer6327.top`, favicon inlined as data URIs. **No `<script>` in head** — zero executable code and zero render-blocking requests; analytics are lazy-loaded at end of body.
2. **CSS in `<style>`** — design tokens on `:root` (overwritten at runtime by the seed/mood engine), section layout, GSAP-driven reveal + micro-interactions, responsive breakpoints, `prefers-reduced-motion`.
3. **Body** — narrow shell: Hero → Projects → Links → Latest Posts → Footer.
4. **End-of-body scripts, strict order** — ① liquidGL v2.0.1 (vendored WebGL liquid-glass, defines `window.liquidGL`); ② GSAP 3.13.0 inlined verbatim (kept out of `<head>` so the boot veil paints before ~72 KB of JS is parsed); ③ app IIFE — seed-driven generative engine (mood → layout/palette/chrome), Shanghai clock, GSAP entrance + micro-interactions; ④ Umami loader — injects the analytics `<script async>` on `load` + `requestIdleCallback` (tracking never competes with the document download or delays the seedbar).

There is no shared CSS/JS module system. Copy patterns deliberately between variants; do not assume a shared asset pipeline.

### Design notes

- The design is **seed-driven generative**: a seed/mood determines layout, palette, and chrome at runtime, overwriting the CSS variables. Base tokens: accent `#018574` (teal); dark background `#0E0D0B`; warm off-white text.
- **Fonts are system-only** — no external font/CDN. Display: `Georgia, "Noto Serif SC", serif`; body: `system-ui, "PingFang SC", "Microsoft YaHei", sans-serif`; mono: `ui-monospace, "Cascadia Code", ...`. No `@font-face`, no woff2, no fontsource CDN (jsdmirror is no longer used).
- Motion: GSAP tweens + decelerate ease `cubic-bezier(0.16, 1, 0.3, 1)`; always honor `prefers-reduced-motion`.

### Dynamic data

- **Time**: `Asia/Shanghai` via `toLocaleTimeString` / `toLocaleString` with `zh-CN`; footer shows `UTC+8`.
- **Posts**: **static markup**, not fetched at runtime. The 8 rows in `#posts-list` are written into `index.html` by `scripts/sync-posts.mjs`, which pulls the live RSS and mirrors the exact escape/parse/date formatting a client-side renderer would use. A scheduled workflow keeps them current (≤1 day stale), so a visitor's browser makes no cross-origin RSS request and the section paints with the first frame instead of after a fetch. Removing the runtime fetch also removed the `preconnect`, the `posts-notice` offline banner, and the localStorage cache that existed to paper over the fetch failing.
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

## Gotcha: blog.yuer6327.top 403s datacenter IPs
The blog is a Cloudflare Pages project (`blog`, alias `blog-4em.pages.dev`) served under the proxied custom domain `blog.yuer6327.top`. That zone (`yuer6327.top`, Cloudflare) has **Bot Fight Mode on** (`bot_management.fight_mode = true`) plus a custom WAF rule `cf.threat_score gt 10 → challenge`. GitHub Actions runner IPs score as suspicious, so **every** request from a runner — any path, any UA — gets `403` + `cf-mitigated: challenge` ("Just a moment..."). WAF Skip rules cannot exempt traffic from Bot Fight Mode, so this is not fixable from the repo side.

Consequence: the sync script must fetch via the Pages alias (`blog-4em.pages.dev`), which is not behind that zone's WAF. URLs inside the payload are absolute (`blog.yuer6327.top`), so the rows written into `index.html` still point at the public domain. A scoped WAF Skip rule (sync UA + `/rss.xml`) exists as insurance only — it covers the custom rule, not Bot Fight Mode.

### Posts data source

The primary source is `https://<blog>/latest-posts.json`, rendered by the blog repo at `src/pages/latest-posts.json.ts` (build-time, calls Fuwari's `getSortedPosts`: drop `draft`, pinned first, then newest first). Contract: `{ site, generatedAt, count, posts: [{ title, slug, url, published, pinned, tags }] }`, max 8.

Why not parse the blog repo's markdown directly: the blog repo is private (would need a long-lived read token in this public repo), and rebuilding its ordering rules here would silently drift. Why not RSS alone: every `<item>` carries the whole post body, so field extraction has to dodge `content:encoded`, and the feed carries no tags/categories. RSS is kept as a fallback path only.

## Conventions for edits

- Keep Chinese UI copy and `lang="zh-CN"` unless the user asks otherwise.
- Prefer single-file changes; avoid introducing a build toolchain unless explicitly requested.
- Escape any feed/user-derived strings before injecting them into markup (see the `esc()` helper in `scripts/sync-posts.mjs`).
- New visual work: either extend the active production style in `index.html`, or develop in a design experiment file and promote when ready.
- `.claude/` and `.obsidian/` are gitignored; do not commit them.
