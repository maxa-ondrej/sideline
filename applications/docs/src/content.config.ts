import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { withBase } from '../scripts/base-path.mjs';

// Starlight schema factory — takes the Astro collection context and returns a
// Zod schema. We wrap it to also rewrite frontmatter links that bypass the
// markdown pipeline (most notably `hero.actions[].link` on splash pages).
const starlightSchema = docsSchema();

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: (context) =>
      starlightSchema(context).transform((data) => {
        if (data.hero?.actions) {
          data.hero.actions = data.hero.actions.map((action) => ({
            ...action,
            link: withBase(action.link) ?? action.link,
          }));
        }
        return data;
      }),
  }),
};
