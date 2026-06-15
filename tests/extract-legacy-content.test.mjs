import assert from "node:assert/strict";
import test from "node:test";

import {
  extractPostsFromLegacyXml,
  toContentFilename,
  toMarkdownDocument,
} from "../scripts/extract-legacy-content.mjs";

test("extracts post metadata and atom content from legacy Hexo XML", () => {
  const searchXml = `<?xml version="1.0" encoding="utf-8"?>
<search>
  <entry>
    <title>实现 Trie (前缀树) - LeetCode</title>
    <url>/2020/03/29/leetcode-implement-trie-prefix-tree/</url>
    <content><![CDATA[<h1 id="题目">题目</h1><p>实现 Trie</p>]]></content>
    <categories><category>算法</category></categories>
    <tags><tag>LeetCode</tag><tag>Trie (前缀树)</tag></tags>
  </entry>
</search>`;

  const atomXml = `<?xml version="1.0" encoding="utf-8"?>
<feed>
  <entry>
    <title>实现 Trie (前缀树) - LeetCode</title>
    <link href="http://yoursite.com/2020/03/29/leetcode-implement-trie-prefix-tree/"/>
    <published>2020-03-28T17:21:01.000Z</published>
    <updated>2020-03-28T17:32:45.894Z</updated>
    <content type="html"><![CDATA[<h1 id="题目">题目</h1><p>来自 atom 的完整正文</p>]]></content>
  </entry>
</feed>`;

  const posts = extractPostsFromLegacyXml({ searchXml, atomXml });

  assert.equal(posts.length, 1);
  assert.deepEqual(posts[0], {
    title: "实现 Trie (前缀树) - LeetCode",
    description: "题目 来自 atom 的完整正文",
    permalink: "/2020/03/29/leetcode-implement-trie-prefix-tree/",
    published: "2020-03-28T17:21:01.000Z",
    updated: "2020-03-28T17:32:45.894Z",
    categories: ["算法"],
    tags: ["LeetCode", "Trie (前缀树)"],
    contentHtml: '<h1 id="题目">题目</h1><p>来自 atom 的完整正文</p>',
  });
});

test("serializes extracted post as Astro markdown with stable filename", () => {
  const post = {
    title: "实现 Trie (前缀树) - LeetCode",
    description: "题目 来自 atom 的完整正文",
    permalink: "/2020/03/29/leetcode-implement-trie-prefix-tree/",
    published: "2020-03-28T17:21:01.000Z",
    updated: "2020-03-28T17:32:45.894Z",
    categories: ["算法"],
    tags: ["LeetCode", "Trie (前缀树)"],
    contentHtml: '<h1 id="题目">题目</h1><p>来自 atom 的完整正文</p>',
  };

  assert.equal(
    toContentFilename(post),
    "2020-03-29-leetcode-implement-trie-prefix-tree.md",
  );

  const markdown = toMarkdownDocument(post);

  assert.match(markdown, /^---\ntitle: "实现 Trie/);
  assert.match(markdown, /permalink: "\/2020\/03\/29\/leetcode-implement-trie-prefix-tree\/"/);
  assert.match(markdown, /tags: \["LeetCode","Trie \(前缀树\)"\]/);
  assert.match(markdown, /\n---\n\n<h1 id="题目">题目<\/h1>/);
});
