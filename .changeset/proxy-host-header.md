---
'@sideline/proxy': patch
---

Forward `Host: $proxy_host` (the upstream FQDN) instead of `Host: $host` (the client's host) so Host-routed upstream terminators (Coolify ingress, Cloudflare) accept the request. Also fix `X-Forwarded-Host` to carry `$host` (was `$server_name`, which evaluated to `_` from the wildcard `server_name _;`), so apps that need the original incoming host can still recover it. Apps continue to use their `*_URL` env vars for URL generation, so this is transparent to them.
