# Docs Site (`@sideline/docs`)

End-user product documentation site built with Astro 5 and Starlight.

## Overview

`@sideline/docs` is a static site served at `/docs` on the main domain. It contains **product-user documentation** (players, captains, admins, API integrators). It is not developer or operator documentation — that stays in the repo's root-level `docs/` directory. See the root `AGENTS.md` "Documentation Conventions" section for the three-surface split.

## Commands

```bash
pnpm --filter @sideline/docs dev       # local dev server on http://localhost:3100/docs/
pnpm --filter @sideline/docs build     # static build to dist/
pnpm --filter @sideline/docs preview   # preview the built static output
pnpm --filter @sideline/docs check     # astro check (type + content collection check)
pnpm --filter @sideline/docs codegen   # astro sync — regenerate content collection types
```

## Architecture

- **Framework:** Astro 5 with the `@astrojs/starlight` integration
- **Output:** pure static HTML/CSS/JS in `dist/`
- **Production server:** `nginx:alpine` (see `Dockerfile`). No Node.js at runtime.
- **Base path:** `/docs` — configured in `astro.config.mjs` via `base: '/docs'`. Internal links are written site-relative (`/quick-start/players/`) — Astro prefixes them with `/docs` automatically.
- **Search:** Starlight's built-in Pagefind. Runs entirely in the browser; no server-side search.

## File layout

```
applications/docs/
├── astro.config.mjs      — Starlight config (sidebar, locales, theme, base path)
├── nginx.conf            — in-container nginx config for static serving
├── Dockerfile            — two-stage: node:25-slim (build) → nginx:alpine (serve)
├── public/               — static assets copied to /docs/ as-is (favicon, og-image)
├── src/
│   ├── assets/           — imagery used via Astro <Image> (logo, screenshots)
│   ├── styles/custom.css — Starlight CSS-var overrides (accent, fonts)
│   ├── content.config.ts — Astro content collections config
│   └── content/docs/
│       ├── index.mdx                 — landing page (splash template)
│       ├── introduction/*.md         — Introduction group
│       ├── quick-start/*.mdx         — Quick start group (manual ordering)
│       ├── guides/*.mdx              — Guides group
│       ├── api/overview.mdx          — API overview (single page)
│       ├── faq.md                    — single long FAQ page
│       ├── changelog.md              — user-facing changelog
│       └── about/*.md                — About group
└── dist/                 — build output (gitignored)
```

## Content conventions

- **Write in EN first.** EN is the source locale and lives at `/docs/` (no `/en/` prefix — `defaultLocale: 'root'`).
- **Second person, active voice, short sentences.**
- **Use Starlight components** (`<Steps>`, `<Aside>`, `<Tabs>`, `<Card>`, `<CardGrid>`, `<LinkCard>`, `<FileTree>`, `<Badge>`) rather than hand-rolled equivalents.
- **Stub pages** get a 1–2 sentence placeholder plus `<Badge text="Coming soon" variant="caution" />`. Never leave them empty.
- **Images** must have meaningful alt text. Use Astro `<Image>` for responsive loading.
- Files that use Starlight components must be `.mdx`. Files that are pure markdown can stay `.md`.

## Translations (CZ)

**Policy for v1: no CZ stub files.** Do not create files under `src/content/docs/cs/`. Do not create the `cs/` directory.

Starlight's `defaultLocale: 'root'` (EN) automatically renders every `/docs/cs/<slug>/` URL with the EN content plus a "This page isn't translated yet" banner.

When translation starts:

1. Create `src/content/docs/cs/<slug>.md` (or `.mdx`) mirroring the EN file path exactly.
2. Translate the content — use **vykání** (formal "vy").
3. The banner disappears automatically once the file exists.

**Never commit partial Czech files** — they suppress the fallback banner and mislead readers into thinking the page is translated.

## Adding a new page

1. Create `src/content/docs/<group>/<slug>.md` (or `.mdx` if using components) with frontmatter `title:` (required) and optional `description:`.
2. If the sidebar group in `astro.config.mjs` uses `autogenerate`, the sidebar picks it up automatically. If it uses an explicit `items:` array, add an entry.
3. Run `pnpm --filter @sideline/docs dev` and verify the page renders at `http://localhost:3100/docs/<group>/<slug>/`.

## When to update docs

Ship docs updates **in the same PR** as code changes that alter end-user behaviour:

| Code change | Required docs update |
|-------------|----------------------|
| New API endpoint | `api/overview.mdx` (and future per-endpoint pages) |
| New form field or user-facing flow | Matching `guides/*.mdx` |
| New/changed permission model | `quick-start/<role>.mdx` |
| New Discord bot slash command | `guides/discord-integration.mdx` or `faq.md` |
| New domain term | `introduction/key-concepts.md` |
| User-visible release | Append a plain-language entry to `changelog.md` |

## Docker / deployment

- Build stage: `node:25-slim` with pnpm, runs `pnpm --filter @sideline/docs build`. Build scripts (e.g. `sharp`) run normally — no `--ignore-scripts`.
- Production stage: `nginx:alpine` listening on port 80. Contains only the static `dist/`.
- Healthcheck: `GET /health` returns `{"status":"ok"}` — served by in-container nginx, not Astro.
- The outer proxy forwards `/docs/*` to this container via `proxy_pass http://docs:80` with no URI rewriting.

## Verification checklist (manual)

Before opening a PR that changes docs:

- [ ] `pnpm --filter @sideline/docs dev` — open `http://localhost:3100/docs/`, verify landing page + sidebar
- [ ] Click every top-level sidebar entry; verify no 404s
- [ ] Open search (Cmd/Ctrl+K) and test a query; verify `/docs/pagefind/pagefind.js` loads (200, not 404) in DevTools network tab
- [ ] Visit `http://localhost:3100/docs/cs/` — verify EN content renders with "not translated yet" banner
- [ ] `pnpm --filter @sideline/docs build` succeeds
- [ ] `pnpm --filter @sideline/docs check` passes
