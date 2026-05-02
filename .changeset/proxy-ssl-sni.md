---
'@sideline/proxy': patch
---

Send SNI on the TLS handshake to HTTPS upstreams (`proxy_ssl_server_name on`, `proxy_ssl_name $proxy_host`). Without this, upstreams fronted by SNI-routing TLS terminators (Cloudflare, Coolify ingress, etc.) reject the handshake with `SSL alert number 40` because they can't pick the right certificate. No effect on plain-HTTP upstreams.
