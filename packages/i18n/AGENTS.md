# i18n Package (`@sideline/i18n`)

Translation system using Paraglide.js with localStorage and cookie strategies.

## Overview

This package provides locale management infrastructure. The actual translations and Paraglide configuration live in `applications/web/` — see `applications/web/AGENTS.md` for translation file conventions, adding new translations, and the locale persistence model.

## Strategies

- **localStorage** — for client-side locale persistence (unauthenticated users)
- **Cookie** — for server-side locale detection
