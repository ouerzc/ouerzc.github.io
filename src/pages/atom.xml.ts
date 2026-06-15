import type { APIRoute } from "astro";
import { getAllPosts } from "../lib/posts";
import { SITE } from "../lib/site";
import { cdata, escapeXml } from "../lib/xml";

export const GET: APIRoute = async () => {
  const posts = await getAllPosts();
  const updated = posts[0]?.data.updated.toISOString() || new Date(0).toISOString();
  const entries = posts
    .map((post) => {
      const href = new URL(post.data.permalink, SITE.url).toString();
      const categories = [
        ...post.data.categories.map(
          (category) =>
            `<category term="${escapeXml(category)}" scheme="${SITE.url}/categories/"/>`,
        ),
        ...post.data.tags.map(
          (tag) => `<category term="${escapeXml(tag)}" scheme="${SITE.url}/tags/"/>`,
        ),
      ].join("\n    ");

      return `<entry>
    <title>${escapeXml(post.data.title)}</title>
    <link href="${href}"/>
    <id>${href}</id>
    <published>${post.data.published.toISOString()}</published>
    <updated>${post.data.updated.toISOString()}</updated>
    <content type="html">${cdata(post.body || "")}</content>
    <summary type="html">${escapeXml(post.data.description)}</summary>
    ${categories}
  </entry>`;
    })
    .join("\n  ");

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(SITE.title)}</title>
  <link href="${SITE.url}/atom.xml" rel="self"/>
  <link href="${SITE.url}/"/>
  <updated>${updated}</updated>
  <id>${SITE.url}/</id>
  <author>
    <name>${escapeXml(SITE.author)}</name>
  </author>
  <generator uri="https://astro.build/">Astro</generator>
  ${entries}
</feed>
`;

  return new Response(xml, {
    headers: { "Content-Type": "application/atom+xml; charset=utf-8" },
  });
};
