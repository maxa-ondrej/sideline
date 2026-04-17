// @ts-check
/**
 * Shared helpers for the docs-site base path. Used by both the remark plugin
 * (which rewrites links inside rendered content) and the content-collection
 * schema transform (which rewrites links in frontmatter that bypass the
 * markdown pipeline, e.g. `hero.actions[].link`).
 *
 * Configure via the `DOCS_BASE_PATH` env var. Default: `/docs`.
 */

export const basePath = (process.env.DOCS_BASE_PATH ?? '/docs').replace(/\/$/, '');

/**
 * Prefix `basePath` onto an internal absolute-path URL. Leaves external URLs,
 * anchors, protocol-relative URLs, and already-prefixed URLs untouched.
 *
 * @param {string | undefined | null} url
 * @returns {string | undefined | null}
 */
export function withBase(url) {
  if (typeof url !== 'string') return url;
  if (!url.startsWith('/')) return url;
  if (url.startsWith('//')) return url;
  if (url === basePath || url.startsWith(`${basePath}/`)) return url;
  return basePath + url;
}
