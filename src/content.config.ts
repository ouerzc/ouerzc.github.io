import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    permalink: z.string(),
    published: z.coerce.date(),
    updated: z.coerce.date(),
    categories: z.array(z.string()),
    tags: z.array(z.string()),
  }),
});

export const collections = { blog };
