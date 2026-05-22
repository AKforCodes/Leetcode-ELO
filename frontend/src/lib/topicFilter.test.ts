import { describe, it, expect } from "vitest";
import {
  tokenizeTopicQuery,
  expandToken,
  matchesTopicQuery,
  buildHaystack,
  TOPIC_ALIASES
} from "./topicFilter";

describe("tokenizeTopicQuery", () => {
  it("splits on spaces", () => {
    expect(tokenizeTopicQuery("dp array hash")).toEqual(["dp", "array", "hash"]);
  });

  it("splits on commas", () => {
    expect(tokenizeTopicQuery("dp,array,hash")).toEqual(["dp", "array", "hash"]);
  });

  it("splits on mixed commas + spaces", () => {
    expect(tokenizeTopicQuery("dp, array  hash")).toEqual(["dp", "array", "hash"]);
  });

  it("collapses runs of commas / spaces", () => {
    expect(tokenizeTopicQuery("dp,,, , ,,array")).toEqual(["dp", "array"]);
  });

  it("handles leading/trailing whitespace + commas", () => {
    expect(tokenizeTopicQuery("  , dp , array , ")).toEqual(["dp", "array"]);
  });

  it("lowercases everything", () => {
    expect(tokenizeTopicQuery("DP, Array, HASH")).toEqual(["dp", "array", "hash"]);
  });

  it("returns empty array for empty string", () => {
    expect(tokenizeTopicQuery("")).toEqual([]);
  });

  it("returns empty array for whitespace-only", () => {
    expect(tokenizeTopicQuery("   \t\n  ")).toEqual([]);
  });

  it("returns empty array for commas-only", () => {
    expect(tokenizeTopicQuery(",,,,,")).toEqual([]);
  });

  it("treats tabs and newlines as separators", () => {
    expect(tokenizeTopicQuery("dp\tarray\nhash")).toEqual(["dp", "array", "hash"]);
  });

  it("keeps hyphenated tokens intact (no split on -)", () => {
    expect(tokenizeTopicQuery("depth-first search")).toEqual(["depth-first", "search"]);
  });

  it("keeps unicode tokens", () => {
    expect(tokenizeTopicQuery("数组 dp")).toEqual(["数组", "dp"]);
  });
});

describe("expandToken", () => {
  it("returns single token when no alias", () => {
    expect(expandToken("array")).toEqual(["array"]);
  });

  it("expands dp to dynamic programming", () => {
    expect(expandToken("dp")).toContain("dynamic programming");
    expect(expandToken("dp")).toContain("dp");
  });

  it("expands dfs to both hyphen and space variants", () => {
    const out = expandToken("dfs");
    expect(out).toContain("depth first search");
    expect(out).toContain("depth-first search");
  });

  it("expands uf and dsu to same target", () => {
    expect(expandToken("uf")).toContain("union find");
    expect(expandToken("dsu")).toContain("union find");
  });

  it("does not mutate the alias table", () => {
    const before = TOPIC_ALIASES.dp.slice();
    expandToken("dp");
    expect(TOPIC_ALIASES.dp).toEqual(before);
  });
});

describe("matchesTopicQuery — empty / trivial", () => {
  it("empty query matches anything", () => {
    expect(matchesTopicQuery("array binary search", "")).toBe(true);
  });

  it("whitespace-only query matches anything", () => {
    expect(matchesTopicQuery("array", "   ")).toBe(true);
  });

  it("commas-only query matches anything", () => {
    expect(matchesTopicQuery("array", ",,,")).toBe(true);
  });

  it("empty haystack rejects non-empty query", () => {
    expect(matchesTopicQuery("", "dp")).toBe(false);
  });
});

describe("matchesTopicQuery — order independence (the original bug)", () => {
  const hay = "Two Sum array hash-table dynamic-programming";

  it("matches when query order matches haystack order", () => {
    expect(matchesTopicQuery(hay, "array dynamic")).toBe(true);
  });

  it("matches when query order is reversed (the reported bug)", () => {
    expect(matchesTopicQuery(hay, "dynamic programming array")).toBe(true);
  });

  it("matches with comma separators in any order", () => {
    expect(matchesTopicQuery(hay, "array, dynamic, hash")).toBe(true);
  });

  it("rejects when one required token is missing", () => {
    expect(matchesTopicQuery(hay, "array greedy")).toBe(false);
  });
});

describe("matchesTopicQuery — acronyms", () => {
  it("dp matches a problem tagged 'dynamic programming'", () => {
    expect(matchesTopicQuery("longest palindromic dynamic programming", "dp")).toBe(true);
  });

  it("dfs matches hyphenated tag 'depth-first search'", () => {
    expect(matchesTopicQuery("clone graph depth-first search", "dfs")).toBe(true);
  });

  it("bfs matches space-separated tag 'breadth first search'", () => {
    expect(matchesTopicQuery("word ladder breadth first search", "bfs")).toBe(true);
  });

  it("'dfs bfs' requires BOTH (AND across tokens)", () => {
    const bothHay = "depth-first search breadth first search";
    const onlyDfs = "clone graph depth-first search";
    expect(matchesTopicQuery(bothHay, "dfs bfs")).toBe(true);
    expect(matchesTopicQuery(onlyDfs, "dfs bfs")).toBe(false);
  });

  it("comma-separated acronyms work", () => {
    expect(matchesTopicQuery("depth-first search breadth first search", "dfs,bfs")).toBe(true);
  });

  it("uppercase acronym still expands", () => {
    expect(matchesTopicQuery("dynamic programming", "DP")).toBe(true);
  });

  it("acronym + literal token mixed", () => {
    expect(matchesTopicQuery("dynamic programming array", "dp array")).toBe(true);
    expect(matchesTopicQuery("dynamic programming string", "dp array")).toBe(false);
  });

  it("unknown acronym does not match unrelated text", () => {
    expect(matchesTopicQuery("array string", "qqq")).toBe(false);
  });

  it("acronym alias variants are independently checkable", () => {
    expect(matchesTopicQuery("union find rocks", "uf")).toBe(true);
    expect(matchesTopicQuery("disjoint set is fine too", "uf")).toBe(true);
  });
});

describe("matchesTopicQuery — substring false-positives (hard cases)", () => {
  // These tests document REAL weaknesses of substring-only matching.
  // `it.fails` keeps the regression visible without breaking CI:
  // each test PASSES the suite only while the bug is still present.
  // Fix the bug → flip these to plain `it` and they assert correctness.

  it.fails("'bs' should NOT match haystack containing 'subsequence'", () => {
    expect(matchesTopicQuery("longest common subsequence", "bs")).toBe(false);
  });

  it.fails("'ht' should NOT match haystack containing 'weight'", () => {
    expect(matchesTopicQuery("path with maximum weight", "ht")).toBe(false);
  });

  it.fails("'bit' should NOT match haystack containing 'orbit'", () => {
    expect(matchesTopicQuery("planet orbit calculation", "bit")).toBe(false);
  });

  it.fails("'tp' should NOT match haystack containing 'http'", () => {
    expect(matchesTopicQuery("parse http url", "tp")).toBe(false);
  });

  it.fails("'sw' should NOT match haystack containing 'answer'", () => {
    expect(matchesTopicQuery("find the answer", "sw")).toBe(false);
  });
});

describe("matchesTopicQuery — case + whitespace robustness", () => {
  it("is case-insensitive on both sides", () => {
    expect(matchesTopicQuery("ARRAY Dynamic-Programming", "dp ARRAY")).toBe(true);
  });

  it("extra interior whitespace in query is harmless", () => {
    expect(matchesTopicQuery("array dp", "  array     dp   ")).toBe(true);
  });

  it("query with tab + newline tokenizes correctly", () => {
    expect(matchesTopicQuery("array dynamic programming", "array\tdp\n")).toBe(true);
  });
});

describe("matchesTopicQuery — multi-word phrases", () => {
  it("'binary search tree' (three tokens) matches bst tag", () => {
    expect(matchesTopicQuery("validate binary search tree", "binary search tree")).toBe(true);
  });

  it("'binary search tree' fails on haystack with only 'binary search'", () => {
    expect(matchesTopicQuery("binary search problem", "binary search tree")).toBe(false);
  });

  it("bst acronym matches a 'binary search tree' tag", () => {
    expect(matchesTopicQuery("validate binary search tree", "bst")).toBe(true);
  });

  it("bst acronym must NOT cross-match plain 'binary search' (no tree)", () => {
    expect(matchesTopicQuery("binary search only", "bst")).toBe(false);
  });
});

describe("matchesTopicQuery — adversarial / regex safety", () => {
  it("query with regex metacharacters is treated literally", () => {
    expect(matchesTopicQuery("array dp", "dp.*")).toBe(false);
    expect(matchesTopicQuery("dp.* literal", "dp.*")).toBe(true);
  });

  it("query with parens does not throw and is literal", () => {
    expect(() => matchesTopicQuery("array", "(dp")).not.toThrow();
    expect(matchesTopicQuery("array", "(dp")).toBe(false);
  });

  it("very long query terminates", () => {
    const long = "dp ".repeat(500).trim();
    expect(matchesTopicQuery("dynamic programming", long)).toBe(true);
  });

  it("very long haystack works", () => {
    const longHay = ("array ".repeat(5000) + "dynamic programming").trim();
    expect(matchesTopicQuery(longHay, "dp array")).toBe(true);
  });
});

describe("matchesTopicQuery — unicode + i18n", () => {
  it("matches Chinese title substring", () => {
    expect(matchesTopicQuery("两数之和 two sum", "两数")).toBe(true);
  });

  it("acronym still works alongside chinese haystack", () => {
    expect(matchesTopicQuery("动态规划 dynamic programming", "dp")).toBe(true);
  });
});

describe("buildHaystack", () => {
  it("joins truthy parts with spaces", () => {
    expect(buildHaystack(["a", "b", "c"])).toBe("a b c");
  });

  it("drops undefined and empty strings", () => {
    expect(buildHaystack(["a", undefined, "", "b"])).toBe("a b");
  });

  it("returns empty string for all-falsy input", () => {
    expect(buildHaystack([undefined, "", undefined])).toBe("");
  });
});
