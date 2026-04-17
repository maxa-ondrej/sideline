// @ts-check
import { visit } from 'unist-util-visit';
import { withBase } from './base-path.mjs';

/**
 * Remark/MDX plugin that prefixes the configured base path to all internal
 * absolute-path links in markdown and MDX content.
 *
 * Rewrites:
 *   - Markdown `[text](/foo/)` link nodes.
 *   - JSX `<Component href="/foo/">` and `<img src="/foo.png">` string
 *     attributes.
 *
 * Leaves alone:
 *   - External URLs (`http://`, `https://`, `//example.com`).
 *   - Anchor-only (`#section`) and mail/tel URIs.
 *   - Links already prefixed with the base path.
 *   - Non-string JSX attribute values (expressions).
 *
 * Frontmatter values (e.g. `hero.actions[].link`) bypass this pipeline and are
 * handled by the content-collection schema transform in `content.config.ts`.
 */
export function remarkBasePath() {
  return () => (/** @type {any} */ tree) => {
    visit(tree, (node) => {
      // Markdown link: [text](/foo/)
      if (node.type === 'link' && typeof node.url === 'string') {
        node.url = withBase(node.url);
        return;
      }
      // MDX JSX: <Component href="/foo/" src="/img.png" />
      if (
        (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') &&
        Array.isArray(node.attributes)
      ) {
        for (const attr of node.attributes) {
          if (
            attr.type === 'mdxJsxAttribute' &&
            (attr.name === 'href' || attr.name === 'src') &&
            typeof attr.value === 'string'
          ) {
            attr.value = withBase(attr.value);
          }
        }
      }
    });
  };
}
