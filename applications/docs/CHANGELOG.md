# @sideline/docs

## 0.2.0

### Minor Changes

- [#223](https://github.com/maxa-ondrej/sideline/pull/223) [`5298870`](https://github.com/maxa-ondrej/sideline/commit/52988703e2827ed558b3cf15a7e7c902fab46a38) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Scaffold `@sideline/docs`, an Astro + Starlight static documentation site served at `/docs` on the main domain. Includes EN-first landing page, introduction, role-based quick starts, guides, API overview, FAQ, changelog, and about pages. CZ locale ships with zero files — Starlight's built-in fallback banner renders EN content for any `/docs/cs/*` URL. The docs container is a two-stage build producing a `nginx:alpine` image that serves static files, with `/health` exposed for healthchecks. The proxy routes `/docs/*` to the new docs container via a new `$var_docs_upstream` map.
