import type { APIRoute } from "astro";
import { getAllPosts } from "../lib/posts";
import { cdata, escapeXml } from "../lib/xml";

export const GET: APIRoute = async () => {
  const posts = await getAllPosts();
  const entries = posts
    .map((post) => {
      const categories = post.data.categories
        .map((category) => `<category>${escapeXml(category)}</category>`)
        .join("");
      const tags = post.data.tags
        .map((tag) => `<tag>${escapeXml(tag)}</tag>`)
        .join("");

      return `  <entry>
    <title>${escapeXml(post.data.title)}</title>
    <url>${post.data.permalink}</url>
    <content>${cdata(post.body || "")}</content>
    <categories>${categories}</categories>
    <tags>${tags}</tags>
  </entry>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<search>
${entries}
</search>
`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
