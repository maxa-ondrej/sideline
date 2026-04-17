# Sideline Docs — Design Specification (v1)

**Target implementation:** `applications/docs/` — a new Astro + Starlight site served at `/docs` on the main domain.

This spec assumes Starlight defaults for chrome (top nav, left sidebar, right on-this-page TOC, built-in Pagefind search, dark/light toggle). We only diverge from defaults where the user value is clear.

---

## 1. Information architecture

Starlight builds its sidebar from the directory structure under `src/content/docs/<locale>/`. The tree below is the **v1 EN** structure; CZ mirrors it. Each entry lists whether it must ship in v1 (`v1`) or can be a stub page (`stub`) that exists in the sidebar but displays a short placeholder + "Coming soon".

```
Docs root (/docs)
│
├── Introduction
│   ├── What is Sideline?              [v1]   — Positioning: Discord-first team mgmt for amateur sports clubs. Who it's for, what it does in two minutes.
│   ├── Why Sideline?                  [v1]   — Pain points solved (RSVP chaos, roster drift, event spam) and how we solve them.
│   └── Key concepts                   [v1]   — Glossary of Team, Roster, Group, Role, Event, RSVP, Training type. Anchors used throughout docs.
│
├── Quick start
│   ├── For Players                    [v1]   — "I joined my team's Discord — now what?" 5-step onboarding: sign in, complete profile, RSVP to first event.
│   ├── For Captains                   [v1]   — Setting up a roster, assigning roles, creating a recurring training, understanding notifications.
│   └── For Admins                     [v1]   — Connecting Sideline to a Discord server, inviting the bot, permission model, groups & channels setup.
│
├── Guides
│   ├── RSVP to an event               [v1]   — Both Discord and web flows, what Yes/No/Maybe mean, changing your response.
│   ├── Manage your roster             [v1]   — Adding members, jersey numbers, age thresholds, archiving inactive players.
│   ├── Create recurring events        [v1]   — Training types, day-of-week schedules, time zones, exceptions.
│   ├── Invite members                 [v1]   — Invite links, Discord OAuth, first-time profile completion.
│   ├── Discord integration            [v1]   — Slash commands overview, channel linking, cleanup modes (nothing/delete/archive).
│   ├── Notifications                  [v1]   — Reminder timing, late-RSVP pings, per-user preferences.
│   ├── Groups and rosters             [stub] — Difference between the two, when to use which.
│   └── Calendar subscription (iCal)   [stub] — Subscribe to your team's events from your phone/laptop calendar.
│
├── Reference
│   ├── API overview                   [v1]   — What the API is for, base URL, versioning policy.
│   ├── Authentication                 [v1]   — Discord OAuth flow, session tokens, how to get one.
│   ├── REST endpoints                 [stub] — Auto-generated in a later PR from the server's OpenAPI schema.
│   ├── Rate limits                    [stub] — Current limits and 429 handling.
│   └── Error codes                    [stub] — Tagged errors the API returns and how to recover.
│
├── FAQ                                [v1]   — 8–12 of the most common support questions grouped by role.
│
├── Changelog                          [v1]   — Curated user-facing release notes. Hand-authored from `applications/web/CHANGELOG.md`; only user-visible changes, in plain language.
│
└── About
    ├── Contact                        [v1]   — Where to get help (Discord community link, email).
    ├── Report a bug                   [v1]   — Link to GitHub Issues with a short "how to write a good bug report" section.
    └── Roadmap                        [stub] — Link out to the public roadmap (e.g. GitHub Projects).
```

**Sidebar group config (Starlight `astro.config.mjs`):** each top-level category becomes a `sidebar` entry with `label` and `autogenerate: { directory: 'introduction' }` etc. Do **not** hand-maintain the order of pages within a category unless ordering is meaningful (e.g. Quick start must be Player → Captain → Admin, not alphabetical). In those cases, use an explicit `items:` array.

**Internal docs split:** The root-level `docs/` folder (`api.md`, `database.md`, `deployment.md`, `discord-bot.md`) stays where it is and is **not** rendered here. That's developer/operator documentation for contributors; the `/docs` site is strictly for product users.

---

## 2. Visual identity

### Brand colours

Pulled from `applications/web/src/styles.css` and `applications/web/src/lib/event-colors.ts`. The web app uses a neutral shadcn palette (`--primary` is near-black in light, near-white in dark) plus **teal** as the de-facto brand accent (matches the whistle logo at `applications/web/public/icons/icon-512.png`, which is teal + navy). Starlight, unlike shadcn, picks a single accent hue.

| Token | Light | Dark | Notes |
|---|---|---|---|
| `--sl-color-accent` | `#0d9488` (Tailwind teal-600) | `#2dd4bf` (Tailwind teal-400) | Matches logo teal. Used for links, active sidebar item, focused tab. |
| `--sl-color-accent-low` | `#ccfbf1` (teal-100) | `#134e4a` (teal-900) | Selected-item background, callout tints. |
| `--sl-color-accent-high` | `#115e59` (teal-800) | `#99f6e4` (teal-200) | High-contrast accent text. |
| `--sl-color-bg` | `#ffffff` | `#141517` (≈ `oklch(0.205 0.006 285.885)`) | Matches `--background` in web app dark mode. |
| `--sl-color-text` | `#0a0a0f` | `#fafafa` | Matches web app foreground. |
| `--sl-color-gray-*` | Starlight defaults | Starlight defaults | Don't override; Starlight's grey ramp is tuned for contrast. |

Override via a `src/styles/custom.css` file imported through the Starlight config's `customCss` option — do **not** fight the Starlight CSS-vars system from component-level styles.

### Typography

The web app uses the system font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, …`) — **not** Inter. To stay consistent with the web app, the docs site should match rather than adopt Starlight's default Inter.

- **Body / headings:** system font stack (override `--sl-font` in `custom.css` with the same stack from `applications/web/src/styles.css`).
- **Monospace / code:** `source-code-pro, Menlo, Monaco, Consolas, "Courier New", monospace` — same as web app.
- **No custom web fonts.** Zero font loading cost, instant render, matches OS look.

### Logo

- **File:** copy `applications/web/public/icons/icon-512.png` → `applications/docs/src/assets/logo.png`. Produce an SVG version later; PNG is acceptable for v1.
- **Placement:** Starlight `logo.src` option (top-left). Show the logo **and** the site title "Sideline Docs" side by side — set `logo.replacesTitle: false`.
- **Sizing:** Starlight renders the logo at ~1.5rem height. The whistle icon reads well at that size.
- **Link target:** logo links to `/docs/{locale}/` (Starlight default — no config needed).

### Favicon

Reuse `applications/web/public/favicon.ico`. Copy to `applications/docs/public/favicon.ico`. Also copy `favicon-32.png` for modern browsers. Set `head` entries in `astro.config.mjs` to serve both.

### Dark mode default

**Follow system preference** (Starlight default — do not hard-code). The web app has a light/dark/system toggle with light as the fallback; match that. Starlight's built-in toggle appears in the top-right and is keyboard-accessible; no extra work.

### Code block theme

Starlight uses Shiki. Pick themes that read well next to the web app's neutral shadcn chrome:

- **Light:** `github-light`
- **Dark:** `github-dark-dimmed`

Rationale: the web app is deliberately restrained (no saturated accents in code). `github-dark-dimmed` avoids the over-saturated reds of `github-dark`; `github-light` is the canonical pair. Both are built into Shiki, zero config cost.

Set via Starlight's `expressiveCode.themes: ['github-dark-dimmed', 'github-light']`.

---

## 3. Page templates

### 3.1 Landing page (`src/content/docs/<locale>/index.mdx`)

Starlight's splash template (`template: splash` in frontmatter) gives us a hero + CTA + cards layout for free. Use it.

```
┌─────────────────────────────────────────────────────────────────────┐
│  [whistle logo]  Sideline Docs                         [EN ▾] [🌙] │  ← Starlight chrome
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                 Everything you need to run your team                │  ← hero title
│                                                                     │
│     Sideline keeps your roster, events, and RSVPs in Discord —      │  ← tagline
│        these docs help you get the most out of it.                  │
│                                                                     │
│      [ Get started → ]     [ Ask the community (Discord) ]          │  ← 2 CTAs
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Pick your role                                                    │
│                                                                     │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│   │ 🏃 Player    │  │ 📋 Captain   │  │ ⚙  Admin     │              │  ← <CardGrid> with 3 <LinkCard>
│   │              │  │              │  │              │              │
│   │ RSVP, track  │  │ Build roster,│  │ Install bot, │              │
│   │ attendance,  │  │ schedule     │  │ configure    │              │
│   │ join events  │  │ events       │  │ your server  │              │
│   │              │  │              │  │              │              │
│   │ Start →      │  │ Start →      │  │ Start →      │              │
│   └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Feature highlights                                                │
│                                                                     │
│   ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                       │
│   │ 📅     │ │ ✅     │ │ 💬     │ │ 🔔     │                       │  ← <CardGrid> with 4 <Card>
│   │Events  │ │ RSVPs  │ │Discord │ │Reminders│                      │
│   └────────┘ └────────┘ └────────┘ └────────┘                       │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│   Need help?                                                        │
│   Check the FAQ, open an issue on GitHub, or say hi in Discord.     │
│   [ FAQ ]  [ Report a bug ]  [ Discord community ]                  │
└─────────────────────────────────────────────────────────────────────┘
```

**Implementation notes:**
- Hero from frontmatter (`hero: { tagline, actions }`) — Starlight renders it automatically.
- Role cards: Starlight `<LinkCard>` (one-liner with arrow) — each links to the matching Quick-start page.
- Feature highlights: Starlight `<CardGrid>` with `<Card icon="...">`. Use built-in Starlight icon names where possible; fall back to emoji in copy only.
- "Need help?" is a plain paragraph with three `<LinkButton>`-style links; no custom component.

### 3.2 Quick-start page template

```
# Quick start for {Role}

{One-sentence "by the end of this page you'll have…" promise.}

<Steps>
1. Step one — one imperative sentence.

   Screenshot or short paragraph of detail.

2. Step two — next action.

   ```bash
   # or a code/CLI block if relevant
   ```

3. …continue for 4–6 steps max.
</Steps>

## Next steps

<CardGrid>
  <LinkCard title="Set up your roster" href="/docs/en/guides/manage-your-roster/" />
  <LinkCard title="Discord integration" href="/docs/en/guides/discord-integration/" />
</CardGrid>
```

Use Starlight's `<Steps>` component — it renders the numbers, spacing, and keyboard navigation correctly. Do not hand-roll numbered lists.

### 3.3 Guide page template

```
# {Guide title}

> Brief lead paragraph — what this guide solves, who it's for, prerequisites.

## Concepts

{1–3 short paragraphs establishing the mental model. Link to Key concepts page.}

## Steps

<Steps>
1. …
2. …
</Steps>

## Screenshots / examples

{Inline images or code blocks.}

## Troubleshooting

<Aside type="caution" title="If the bot doesn't respond">
  …most common failure mode with a one-line fix.
</Aside>

## See also

- [Related guide A](…)
- [Related guide B](…)
```

Screenshots go in `src/assets/screenshots/<guide-slug>/*.png` and are imported via the Astro `<Image>` component for responsive sizing and lazy loading.

### 3.4 API reference page template

```
# {Endpoint group, e.g. "Events"}

## Create event

`POST /api/teams/{teamId}/events`

### Authentication

Bearer token required. See [Authentication](…).

### Request

<Tabs>
  <TabItem label="Schema">
    | Field | Type | Required | Description |
    | --- | --- | --- | --- |
    | title | string | yes | … |
  </TabItem>
  <TabItem label="Example">
    ```json
    { "title": "Tuesday training", … }
    ```
  </TabItem>
</Tabs>

### Response — 200 OK

```json
{ "eventId": "…", … }
```

### Errors

| Status | Tag | Meaning |
| --- | --- | --- |
| 401 | Unauthorized | Missing or invalid bearer token |
| 404 | TeamNotFound | The `teamId` does not exist |
```

Use Starlight `<Tabs>` + `<TabItem>` for "Schema vs. Example" toggles. Eventually this page should be auto-generated from the server's OpenAPI schema, but v1 hand-writes the overview and leaves endpoint pages as stubs.

### 3.5 FAQ page template

Single long page (not a category). H3 per question, grouped under H2 per role/topic:

```
# Frequently asked questions

## General

### Is Sideline free?
Answer paragraph.

### Does it work without Discord?
Answer paragraph.

## For players

### How do I change my RSVP after I submitted it?
…

## For captains

### …

## For admins

### …
```

No custom accordion component — browser `Ctrl+F` and Starlight's search cover findability. H3s auto-populate the on-this-page TOC on the right.

---

## 4. i18n & navigation

### Locale config

Starlight `locales` option:

```js
locales: {
  root: { label: 'English', lang: 'en' },         // served at /docs/
  cs:   { label: 'Čeština', lang: 'cs' },         // served at /docs/cs/
}
```

**URL structure:** `root: 'en'` is intentional — EN is the source language and lives at `/docs/` (no `/en/` prefix). CZ lives at `/docs/cs/`. This makes the most common case (typing the URL, sharing a link) one segment shorter and matches how the web app treats EN as the base locale (per `applications/web/AGENTS.md`).

> **Alternative considered:** forcing `/docs/en/` and redirecting `/docs` by Accept-Language. Rejected — adds nginx complexity for a marginal UX win, and Starlight's default root-locale behaviour already does the right thing for linked URLs.

### Language picker

Starlight renders a language picker in the top nav automatically once `locales` has more than one entry. It stays in the top-right of the chrome and is keyboard-accessible. No custom work needed.

### Untranslated CZ pages

**Recommendation: show the English page with a banner, do not 404.**

For every CZ page that hasn't been translated yet, Starlight's default behaviour is to render a "This page isn't translated yet, showing English version" fallback automatically when you enable `defaultLocale: 'en'` and use the `i18n` content loader. Adopt that default. Rationale:

1. 404ing on untranslated pages punishes Czech users for our shipping schedule.
2. The banner is honest — it tells them the page is EN and why.
3. It makes progress visible (the banner goes away when we translate).

For v1, **every CZ page is a stub** that triggers this fallback, except the landing page and the three Quick-start pages, which we translate fully in the first PR. Everything else gets translated in subsequent PRs.

### Nav structure

- Top nav: logo + title (left), search (centre), language picker + theme toggle + GitHub link (right).
- Left sidebar: the IA tree from §1. Collapsed by default on mobile (Starlight default).
- Right sidebar: on-this-page TOC, auto-generated from H2/H3. Hidden on the landing page (`template: splash`).
- Footer: minimal — "© Sideline" + link to GitHub repo. Starlight default footer is fine; no custom component.

---

## 5. Content tone & voice

### Audience split

| Audience | % of traffic (estimate) | Tone |
| --- | --- | --- |
| Players | 60% | Friendliest, shortest sentences, phone-first. Assume zero product knowledge. |
| Captains | 25% | Practical, task-oriented. Willing to read a 5-step guide if it saves them time. |
| Admins | 10% | Slightly more technical. Comfortable with terms like "OAuth", "channel permissions". |
| API integrators | 5% | Developer tone. Code-first, precise, no hand-holding. |

### Voice rules

- **Second person, active voice.** "You'll see the RSVP buttons appear…" not "The RSVP buttons will be displayed…".
- **Short sentences.** If a sentence has two commas, split it.
- **No marketing puffery.** "Sideline manages your team" > "Sideline revolutionises how your team collaborates".
- **Czech uses vykání (formal `vy`).** Teams are mixed ages; the safe default is polite. Add this to the translation style guide as the first rule.
- **Screenshots before walls of text.** Wherever a picture works, use one.
- **Link liberally.** Key concept first mentioned? Link to the Key concepts page. Low cost, high orientation value.

### Visual grammar — Starlight components to use (and not to)

| Use | Instead of |
| --- | --- |
| `<Steps>` | Hand-numbered markdown lists |
| `<Aside type="note">` / `"tip"` / `"caution"` / `"danger"` | Blockquotes with emoji |
| `<Tabs>` + `<TabItem>` | Parallel code blocks |
| `<Card>` / `<CardGrid>` / `<LinkCard>` | Custom HTML grid wrappers |
| `<FileTree>` | ASCII trees in code blocks (Starlight renders real icons) |
| `<Badge>` | Inline `**[NEW]**` markers |
| Astro `<Image>` | Plain `![]()` (gets you responsive srcsets + lazy loading for free) |

Document these in a `src/content/docs/<locale>/contributing.md` page (internal, unlisted in sidebar) so future doc authors know the patterns.

---

## 6. Assets needed

### Must ship in v1 (first PR)

```
src/assets/
├── logo.png                     — copy of applications/web/public/icons/icon-512.png
├── logo.svg                     — (nice-to-have) vectorised version; defer if time-constrained
└── screenshots/
    ├── quickstart-player/
    │   ├── 01-sign-in.png       — Discord OAuth screen
    │   ├── 02-complete-profile.png
    │   └── 03-first-rsvp.png
    ├── quickstart-captain/
    │   ├── 01-create-roster.png
    │   └── 02-create-event.png
    └── quickstart-admin/
        ├── 01-invite-bot.png
        └── 02-link-channels.png
```

Screenshots: 1600×1000 PNG, light mode, cropped to relevant UI area (not full browser). Store source PSDs/Figma separately, not in the repo.

### Can defer (stub with placeholder illustration or no image)

```
src/assets/
├── illustrations/
│   ├── empty-state.svg           — drawn illustration for "no results" in search
│   ├── hero-background.svg       — subtle whistle pattern for landing page hero
│   └── role-{player,captain,admin}.svg  — spot illustrations for each role card on the landing page
└── screenshots/
    ├── guides/                   — per-guide screenshots, backfilled as guides graduate from stub
    └── discord/                  — Discord slash command and embed examples
```

### Logo size variants

| Variant | Size | Use |
| --- | --- | --- |
| `logo-light.svg` (or `.png`) | 512×512 | Top nav on light mode |
| `logo-dark.svg` (or `.png`) | 512×512 | Top nav on dark mode (add a subtle outline if the navy-on-dark contrast suffers; the current logo has a white inner crescent that holds up on dark) |
| `favicon.ico` | 16/32/48 multi-res | Browser tab |
| `favicon-32.png` | 32×32 | Modern browsers |
| `apple-touch-icon.png` | 180×180 | iOS add-to-home-screen |
| `og-image.png` | 1200×630 | Social sharing — reuse `applications/web/public/og-image.png` |

All reuses come from `applications/web/public/` — copy them into `applications/docs/public/` during the build or symlink at generation time.

---

## 7. Accessibility

Starlight's chrome meets WCAG AA out of the box: keyboard-navigable sidebar, skip-to-content link, focus-visible outlines, ARIA landmarks, language attribute on `<html>`. Extra rules on top of defaults:

1. **Every image needs alt text.** For screenshots, write a sentence that captures what the reader should notice — not "screenshot of dashboard". Lint with `astro-eslint-plugin-jsx-a11y` (`alt-text` rule).
2. **Code blocks get a language.** Shiki can't colour-blind-safely highlight without knowing the language; always write ` ```json `, ` ```bash `, etc.
3. **No colour-only signals.** Error codes in the API reference get both a colour badge **and** a written status (e.g. "401 Unauthorized", not a red dot alone).
4. **Keyboard-reachable language picker.** Starlight default is fine; if we add a custom locale switcher anywhere (e.g. inline banner), ensure it's `<button>` or `<a>`, never a `<div onclick>`.
5. **Focus outlines on custom components.** If anything beyond Starlight defaults is added (e.g. a custom role-picker on the landing page), it must honour `:focus-visible` and match the Starlight accent ring colour.
6. **Headings are hierarchical.** No skipping levels (H1 → H2 → H3, never H1 → H3). The on-this-page TOC relies on it.
7. **Respect `prefers-reduced-motion`.** Any animation (hover scales, fade-ins) must be wrapped in a reduced-motion media query. Starlight itself does not animate; custom additions must match.
8. **Colour contrast.** Verify the teal `--sl-color-accent` against both bg tokens with a contrast checker. Tailwind teal-600 on white is 4.6:1 (passes AA for body text); teal-400 on `#141517` is 6.8:1 (passes AAA). If we change the accent hue, re-verify.

---

## Summary for the developer agent

Build this as a vanilla Starlight site — resist the urge to customise. The value comes from the content architecture (§1), the honest Czech fallback policy (§4), and the role-based landing page (§3.1). Everything else is "use the Starlight default, match the web app's fonts and teal accent, ship it".

Priority order for the first PR:
1. Scaffold `applications/docs/` with Astro + Starlight, configure `locales`, accent colour, fonts.
2. Write EN content for all `[v1]` pages from §1.
3. Stub every `[stub]` page with a 2-sentence placeholder + "Coming soon" badge.
4. Stub every CZ page (let Starlight's untranslated banner handle the rest).
5. Wire nginx `/docs` → docs container in `applications/proxy/`.
6. Add CI build step for the new package.

The developer should not need to make any more design decisions. If something is genuinely ambiguous, follow the Starlight default.
