import { access, readFile, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const modulePath = fileURLToPath(import.meta.url);
const DEFAULT_PAGE_SIZE = 10;

export function slugifyTaxonomy(value) {
  return value
    .trim()
    .replace(/\(/g, "-")
    .replace(/\)/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function addPaginatedRoutes(routes, baseRoute, itemCount, pageSize) {
  routes.add(baseRoute);

  const pageCount = Math.ceil(itemCount / pageSize);
  for (let page = 2; page <= pageCount; page += 1) {
    routes.add(`${baseRoute}page/${page}/`);
  }
}

function archiveKeyFromPost(post) {
  const match = post.permalink.match(/^\/(\d{4})\/(\d{2})\/\d{2}\//);
  if (!match) {
    throw new Error(`Unsupported permalink shape: ${post.permalink}`);
  }

  return { year: match[1], month: match[2] };
}

export function buildExpectedRoutes(posts, { pageSize = DEFAULT_PAGE_SIZE } = {}) {
  const routes = new Set(["/atom.xml", "/search.xml", "/404.html"]);
  const tags = new Map();
  const categories = new Map();
  const years = new Map();
  const months = new Map();

  addPaginatedRoutes(routes, "/", posts.length, pageSize);
  routes.add("/tags/");
  routes.add("/categories/");
  addPaginatedRoutes(routes, "/archives/", posts.length, pageSize);

  for (const post of posts) {
    routes.add(post.permalink);

    for (const tag of post.tags || []) {
      const key = slugifyTaxonomy(tag);
      tags.set(key, (tags.get(key) || 0) + 1);
    }

    for (const category of post.categories || []) {
      const key = slugifyTaxonomy(category);
      categories.set(key, (categories.get(key) || 0) + 1);
    }

    const { year, month } = archiveKeyFromPost(post);
    years.set(year, (years.get(year) || 0) + 1);
    months.set(`${year}/${month}`, (months.get(`${year}/${month}`) || 0) + 1);
  }

  for (const [tag, count] of tags) {
    addPaginatedRoutes(routes, `/tags/${tag}/`, count, pageSize);
  }

  for (const [category, count] of categories) {
    addPaginatedRoutes(routes, `/categories/${category}/`, count, pageSize);
  }

  for (const [year, count] of years) {
    addPaginatedRoutes(routes, `/archives/${year}/`, count, pageSize);
  }

  for (const [monthKey, count] of months) {
    addPaginatedRoutes(routes, `/archives/${monthKey}/`, count, pageSize);
  }

  return routes;
}

export function routeToFile(route, distDir = "dist") {
  if (route.endsWith("/")) {
    return join(distDir, route.slice(1), "index.html");
  }

  return join(distDir, route.slice(1));
}

export async function findMissingRoutes(routes, distDir = "dist") {
  const missing = [];

  for (const route of [...routes].sort()) {
    try {
      await access(routeToFile(route, distDir), constants.R_OK);
    } catch {
      missing.push(route);
    }
  }

  return missing;
}

function parseJsonField(frontmatter, fieldName) {
  const match = frontmatter.match(new RegExp(`^${fieldName}:\\s*(.+)$`, "m"));
  return match ? JSON.parse(match[1]) : [];
}

function parseStringField(frontmatter, fieldName) {
  const match = frontmatter.match(new RegExp(`^${fieldName}:\\s*(.+)$`, "m"));
  return match ? JSON.parse(match[1]) : "";
}

export async function loadPostsFromContent(contentDir = "src/content/blog") {
  const filenames = (await readdir(contentDir)).filter((filename) =>
    filename.endsWith(".md"),
  );

  return Promise.all(
    filenames.map(async (filename) => {
      const file = await readFile(join(contentDir, filename), "utf8");
      const frontmatter = file.match(/^---\n([\s\S]*?)\n---/)?.[1];
      if (!frontmatter) {
        throw new Error(`Missing frontmatter in ${filename}`);
      }

      return {
        permalink: parseStringField(frontmatter, "permalink"),
        published: parseStringField(frontmatter, "published"),
        categories: parseJsonField(frontmatter, "categories"),
        tags: parseJsonField(frontmatter, "tags"),
      };
    }),
  );
}

function readCliOption(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

async function main() {
  const distDir = resolve(readCliOption("--dist", "dist"));
  const contentDir = resolve(readCliOption("--content", "src/content/blog"));
  const posts = await loadPostsFromContent(contentDir);
  const routes = buildExpectedRoutes(posts);
  const missing = await findMissingRoutes(routes, distDir);

  if (missing.length > 0) {
    console.error(`Missing ${missing.length} route files:`);
    for (const route of missing) console.error(`- ${route}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Verified ${routes.size} legacy routes in ${distDir}`);
}

if (process.argv[1] && resolve(process.argv[1]) === modulePath) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

