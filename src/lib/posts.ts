import { getCollection, type CollectionEntry } from "astro:content";
import { PAGE_SIZE } from "./site";

export type BlogPost = CollectionEntry<"blog">;

export function slugifyTaxonomy(value: string) {
  return value
    .trim()
    .replace(/\(/g, "-")
    .replace(/\)/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function getAllPosts() {
  const posts = await getCollection("blog");
  return posts.sort(
    (a, b) => b.data.published.getTime() - a.data.published.getTime(),
  );
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replace(/\//g, "-");
}

export function paginate<T>(items: T[], pageSize = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  return Array.from({ length: totalPages }, (_, index) => {
    const page = index + 1;
    return {
      page,
      totalPages,
      items: items.slice(index * pageSize, page * pageSize),
    };
  });
}

export function taxonomyCounts(
  posts: BlogPost[],
  field: "tags" | "categories",
) {
  const counts = new Map<string, { name: string; count: number; slug: string }>();

  for (const post of posts) {
    for (const name of post.data[field]) {
      const slug = slugifyTaxonomy(name);
      counts.set(slug, {
        name,
        slug,
        count: (counts.get(slug)?.count || 0) + 1,
      });
    }
  }

  return [...counts.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "zh-CN"),
  );
}

export function postsForTaxonomy(
  posts: BlogPost[],
  field: "tags" | "categories",
  slug: string,
) {
  return posts.filter((post) =>
    post.data[field].some((name) => slugifyTaxonomy(name) === slug),
  );
}

export function permalinkParts(post: BlogPost) {
  const match = post.data.permalink.match(/^\/(\d{4})\/(\d{2})\/(\d{2})\/([^/]+)\/$/);
  if (!match) {
    throw new Error(`Unsupported permalink: ${post.data.permalink}`);
  }

  return {
    year: match[1],
    month: match[2],
    day: match[3],
    slug: match[4],
  };
}

export function archiveKeys(post: BlogPost) {
  const { year, month } = permalinkParts(post);
  return { year, month, monthKey: `${year}/${month}` };
}

export function postsForArchive(
  posts: BlogPost[],
  year?: string,
  month?: string,
) {
  return posts.filter((post) => {
    const keys = archiveKeys(post);
    if (year && keys.year !== year) return false;
    if (month && keys.month !== month) return false;
    return true;
  });
}

export function archiveCounts(posts: BlogPost[]) {
  const years = new Map<string, number>();
  const months = new Map<string, number>();

  for (const post of posts) {
    const { year, monthKey } = archiveKeys(post);
    years.set(year, (years.get(year) || 0) + 1);
    months.set(monthKey, (months.get(monthKey) || 0) + 1);
  }

  return {
    years: [...years.entries()].sort((a, b) => b[0].localeCompare(a[0])),
    months: [...months.entries()].sort((a, b) => b[0].localeCompare(a[0])),
  };
}

export function excerptHtml(post: BlogPost) {
  return (post.body || "").split('<a id="more"></a>')[0];
}
