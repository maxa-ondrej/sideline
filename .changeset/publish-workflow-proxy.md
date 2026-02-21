---
"@sideline/proxy": patch
---

Move proxy from .docker/proxy to applications/proxy, replace snapshot workflow with a unified publish workflow that routes npm publishing for packages and Docker builds for applications based on the tagged package name, and separate release PR creation from publishing in the release workflow
