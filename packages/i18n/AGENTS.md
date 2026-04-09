# i18n Package (`@sideline/i18n`)

Translation system using Paraglide.js with localStorage and cookie strategies.

## Overview

This package provides locale management infrastructure. The actual translations and Paraglide configuration live in `applications/web/` — see `applications/web/AGENTS.md` for translation file conventions, adding new translations, and the locale persistence model.

## Strategies

- **localStorage** — client-side locale persistence (manual language choice)
- **cookie** — server-side locale detection
- **preferredLanguage** — detects browser language via `navigator.languages` (first visit)
- **baseLocale** — fallback to English when no other strategy resolves
