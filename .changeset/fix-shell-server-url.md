---
'@sideline/web': patch
---

Fix every authenticated API call (translations, teams, etc.) returning 404 / "team not found". The API base URL (`serverUrl`) was read via `Route.useRouteContext()` inside the document `shellComponent`, but TanStack Router renders the shell *above* the root match's context provider, so `serverUrl` was `undefined` there. With an undefined base URL the HTTP client skipped its prefix and sent requests (e.g. `/api/translations`) to the page origin instead of the API, which the server's prefixed routes returned 404 for. The `serverUrl`-dependent providers (`RunProvider`, `TranslationOverridesProvider`) now live in a root route `component` that renders inside the match context, so the resolved base URL reaches every client call. The translations query is also keyed by `serverUrl` and gated until it resolves.
