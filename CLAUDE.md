# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Static personal homepage for **Yuer6327**, published via GitHub Pages from `yuer6327/yuer6327.github.io`. Live site: https://yuer6327.top (`CNAME`).

No build step, package manager, bundler, linter, or tests. The site is plain HTML + embedded CSS + inline JS.

## Preview and deploy

```bash
# Local preview (any static server; needed for RSS fetch CORS checks in some browsers)
npx --yes serve .
# or: python -m http.server 8000

# Production: push main → GitHub Pages serves index.html at the CNAME domain
git push origin main
```

Only `index.html` is the live entry. Design experiments live in sibling files and are not served unless renamed/copied over `index.html`.

## File roles

| File | Role |
|------|------|
| `index.html` | **Production** homepage. Currently “Version A — Editorial Quiet Luxury” with pure CSS animations (no GSAP). |
| `index A — Editorial.html` | Editorial variant workspace. May include GSAP experiments; keep in sync with design intent of A, not necessarily identical to live `index.html`. |
| `index B — Information Architecture.html` | Alternate “Swiss / IA” design (Vignelli × Tufte × terminal). Not production. |
| `CNAME` | Custom domain `yuer6327.top` for GitHub Pages. |

When changing the live look, edit `index.html` (or promote a finished variant into it). When iterating on a concept, prefer the `index A/B — …` files so production stays stable.

## Architecture (single-page)

Each homepage is one self-contained HTML file:

1. **Head** — meta (zh-CN), canonical `https://yuer6327.top`, favicon from `blog.yuer6327.top`, fonts from `jsdmirror.com` (fontsource packages).
2. **CSS in `<style>`** — design tokens on `:root`, section layout, row/link styles, reveal animations, responsive breakpoints, `prefers-reduced-motion`.
3. **Body** — narrow column (`.page`): Hero → Projects → Links → Latest Posts → Footer.
4. **Inline `<script>` IIFE** — Shanghai clock, scroll reveal (IntersectionObserver or GSAP depending on variant), RSS post list.

There is no shared CSS/JS module system. Copy patterns deliberately between variants; do not assume a shared asset pipeline.

### Design tokens (shared intent across variants)

- Accent: `#018574` (teal); dark background `#0E0D0B`; warm off-white text.
- Display type: Noto Serif SC / Syne; body: IBM Plex Mono / LXGW WenKai Mono.
- Motion: decelerate ease `cubic-bezier(0.16, 1, 0.3, 1)`; always honor `prefers-reduced-motion`.

Version comments at the top of each file’s `<style>` block document the design reference (e.g. Kenya Hara × NYT vs Swiss/IA).

### Dynamic data

- **Time**: `Asia/Shanghai` via `toLocaleTimeString` / `toLocaleString` with `zh-CN`.
- **Posts**: `fetch('https://blog.yuer6327.top/rss.xml')`, parse with `DOMParser`, skip items without `content:encoded`, show up to 8. Titles/tags/dates/descriptions go through an HTML-escape helper before `innerHTML`.
- **Projects / social links**: hard-coded in markup (Blog, RIES, oPan; X, GitHub, Outlook).

### External surfaces (do not invent URLs)

- Blog / RSS / favicon: `https://blog.yuer6327.top`
- RIES: `https://ries.yuer6327.top/`
- oPan: `https://opan.yuer6327.top/`
- GitHub user: `https://github.com/Yuer6327`
- Fonts CDN: `https://jsdmirror.com`

## Conventions for edits

- Keep Chinese UI copy and `lang="zh-CN"` unless the user asks otherwise.
- Prefer single-file changes; avoid introducing a build toolchain unless explicitly requested.
- Escape any RSS/user-derived strings before injecting HTML.
- New visual work: either extend the active production style in `index.html`, or develop in `index A/B` first and promote when ready.
- `.claude/` and `.obsidian/` are gitignored; do not commit them.
