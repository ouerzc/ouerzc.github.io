import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const modulePath = fileURLToPath(import.meta.url);

function decodeHtmlEntities(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function extractBlocks(xml, tagName) {
  const blocks = [];
  const pattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)</${tagName}>`, "g");
  let match;

  while ((match = pattern.exec(xml)) !== null) {
    blocks.push(match[1]);
  }

  return blocks;
}

function extractText(block, tagName) {
  const match = block.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)</${tagName}>`));
  return match ? decodeHtmlEntities(match[1].trim()) : "";
}

function extractAllText(block, tagName) {
  return extractBlocks(block, tagName).map((value) => decodeHtmlEntities(value.trim()));
}

function extractCdata(block, tagName) {
  const match = block.match(
    new RegExp(`<${tagName}\\b[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tagName}>`),
  );
  return match ? match[1].trim() : "";
}

function normalizePermalink(value) {
  const path = value.replace(/^https?:\/\/[^/]+/, "");
  return path.endsWith("/") ? path : `${path}/`;
}

function stripHtml(html) {
  return decodeHtmlEntities(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function descriptionFromHtml(html) {
  const text = stripHtml(html);
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

function extractAtomEntries(atomXml) {
  const entries = new Map();

  for (const block of extractBlocks(atomXml, "entry")) {
    const href = block.match(/<link\b[^>]*href="([^"]+)"/)?.[1];
    if (!href) continue;

    const permalink = normalizePermalink(decodeHtmlEntities(href));
    entries.set(permalink, {
      published: extractText(block, "published"),
      updated: extractText(block, "updated"),
      contentHtml: extractCdata(block, "content"),
    });
  }

  return entries;
}

export function extractPostsFromLegacyXml({ searchXml, atomXml }) {
  const atomEntries = extractAtomEntries(atomXml);

  return extractBlocks(searchXml, "entry").map((block) => {
    const permalink = normalizePermalink(extractText(block, "url"));
    const atomEntry = atomEntries.get(permalink);
    const fallbackContent = extractCdata(block, "content");
    const contentHtml = atomEntry?.contentHtml || fallbackContent;

    if (!atomEntry) {
      throw new Error(`Missing Atom entry for ${permalink}`);
    }

    return {
      title: extractText(block, "title"),
      description: descriptionFromHtml(contentHtml),
      permalink,
      published: atomEntry.published,
      updated: atomEntry.updated,
      categories: extractAllText(block, "category"),
      tags: extractAllText(block, "tag"),
      contentHtml,
    };
  });
}

export function toContentFilename(post) {
  const match = post.permalink.match(/^\/(\d{4})\/(\d{2})\/(\d{2})\/([^/]+)\/$/);
  if (!match) {
    throw new Error(`Unsupported permalink shape: ${post.permalink}`);
  }

  return `${match[1]}-${match[2]}-${match[3]}-${match[4]}.md`;
}

export function toMarkdownDocument(post) {
  const frontmatter = [
    "---",
    `title: ${JSON.stringify(post.title)}`,
    `description: ${JSON.stringify(post.description)}`,
    `permalink: ${JSON.stringify(post.permalink)}`,
    `published: ${JSON.stringify(post.published)}`,
    `updated: ${JSON.stringify(post.updated)}`,
    `categories: ${JSON.stringify(post.categories)}`,
    `tags: ${JSON.stringify(post.tags)}`,
    "---",
    "",
    "",
  ].join("\n");

  return `${frontmatter}${post.contentHtml}\n`;
}

function readCliOption(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

async function main() {
  const searchPath = resolve(
    readCliOption("--search", "legacy/hexo-generated/search.xml"),
  );
  const atomPath = resolve(readCliOption("--atom", "legacy/hexo-generated/atom.xml"));
  const outDir = resolve(readCliOption("--out", "src/content/blog"));

  const [searchXml, atomXml] = await Promise.all([
    readFile(searchPath, "utf8"),
    readFile(atomPath, "utf8"),
  ]);
  const posts = extractPostsFromLegacyXml({ searchXml, atomXml });

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  for (const post of posts) {
    await writeFile(
      resolve(outDir, toContentFilename(post)),
      toMarkdownDocument(post),
      "utf8",
    );
  }

  console.log(`Extracted ${posts.length} posts into ${outDir}`);
}

if (process.argv[1] && resolve(process.argv[1]) === modulePath) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
