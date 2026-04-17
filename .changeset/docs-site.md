---
'@sideline/docs': minor
'@sideline/proxy': patch
---

Scaffold `@sideline/docs`, an Astro + Starlight static documentation site served at `/docs` on the main domain. Includes EN-first landing page, introduction, role-based quick starts, guides, API overview, FAQ, changelog, and about pages. CZ locale ships with zero files — Starlight's built-in fallback banner renders EN content for any `/docs/cs/*` URL. The docs container is a two-stage build producing a `nginx:alpine` image that serves static files, with `/health` exposed for healthchecks. The proxy routes `/docs/*` to the new docs container via a new `$var_docs_upstream` map.
