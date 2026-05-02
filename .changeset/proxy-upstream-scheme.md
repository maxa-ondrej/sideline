---
'@sideline/proxy': patch
---

Add per-upstream `WEB_SCHEME`, `SERVER_SCHEME`, and `DOCS_SCHEME` env vars (accepting `http` or `https`, defaulting to `http`) so the proxy can reach upstreams that terminate TLS at their own ingress. The startup script composes `${SCHEME}://${HOST}:${PORT}` for each upstream and elides the redundant default port (`:80` for `http`, `:443` for `https`) from the resulting URL. Existing internal-network deployments keep working unchanged because the default scheme stays `http`.
