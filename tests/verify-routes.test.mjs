import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  buildExpectedRoutes,
  findMissingRoutes,
  routeToFile,
  slugifyTaxonomy,
} from "../scripts/verify-routes.mjs";

function makePosts(count) {
  return Array.from({ length: count }, (_, index) => ({
    permalink: `/2020/03/${String(index + 1).padStart(2, "0")}/post-${index + 1}/`,
    published: `2020-03-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
    categories: ["算法"],
    tags: ["LeetCode", index === 0 ? "Trie (前缀树)" : "算法"],
  }));
}

test("builds the legacy route contract including paginated archives and taxonomy pages", () => {
  const routes = buildExpectedRoutes(makePosts(11), { pageSize: 10 });

  assert(routes.has("/"));
  assert(routes.has("/page/2/"));
  assert(routes.has("/2020/03/01/post-1/"));
  assert(routes.has("/tags/"));
  assert(routes.has("/tags/LeetCode/"));
  assert(routes.has("/tags/LeetCode/page/2/"));
  assert(routes.has("/tags/Trie-前缀树/"));
  assert(routes.has("/categories/算法/page/2/"));
  assert(routes.has("/archives/page/2/"));
  assert(routes.has("/archives/2020/page/2/"));
  assert(routes.has("/archives/2020/03/page/2/"));
  assert(routes.has("/atom.xml"));
  assert(routes.has("/search.xml"));
  assert(routes.has("/404.html"));
});

test("maps routes to static build output files and reports missing files", async () => {
  const distDir = await mkdir(join(tmpdir(), `astro-route-test-${Date.now()}`), {
    recursive: true,
  });
  const indexFile = routeToFile("/2020/03/01/post-1/", distDir);
  const atomFile = routeToFile("/atom.xml", distDir);

  await mkdir(join(distDir, "2020/03/01/post-1"), { recursive: true });
  await writeFile(indexFile, "<html></html>");
  await writeFile(atomFile, "<feed></feed>");

  assert.equal(indexFile, join(distDir, "2020/03/01/post-1/index.html"));
  assert.equal(atomFile, join(distDir, "atom.xml"));

  const missing = await findMissingRoutes(
    new Set(["/2020/03/01/post-1/", "/atom.xml", "/missing/"]),
    distDir,
  );

  assert.deepEqual(missing, ["/missing/"]);
});

test("matches Hexo taxonomy slug compatibility", () => {
  assert.equal(slugifyTaxonomy("Trie (前缀树)"), "Trie-前缀树");
  assert.equal(slugifyTaxonomy("深度优先搜索(DFS)"), "深度优先搜索-DFS");
  assert.equal(slugifyTaxonomy("Kadane 算法"), "Kadane-算法");
});
