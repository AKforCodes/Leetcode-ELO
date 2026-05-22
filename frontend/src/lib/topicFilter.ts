export const TOPIC_ALIASES: Record<string, string[]> = {
  dp: ["dynamic programming"],
  dfs: ["depth first search", "depth-first search"],
  bfs: ["breadth first search", "breadth-first search"],
  bs: ["binary search"],
  bst: ["binary search tree"],
  ll: ["linked list"],
  bit: ["bit manipulation"],
  bitmask: ["bitmask", "bit manipulation"],
  uf: ["union find", "disjoint set"],
  dsu: ["union find", "disjoint set"],
  mst: ["minimum spanning tree"],
  scc: ["strongly connected"],
  topo: ["topological"],
  kmp: ["string matching"],
  lis: ["longest increasing subsequence"],
  lcs: ["longest common subsequence"],
  sw: ["sliding window"],
  tp: ["two pointers"],
  pq: ["priority queue", "heap"],
  ht: ["hash table"],
  recur: ["recursion"],
  bt: ["backtracking"],
  seg: ["segment tree"],
  fenwick: ["fenwick", "binary indexed"],
  bitree: ["fenwick", "binary indexed"]
};

export function tokenizeTopicQuery(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function expandToken(token: string): string[] {
  const aliases = TOPIC_ALIASES[token];
  return aliases ? [token, ...aliases] : [token];
}

export function matchesTopicQuery(haystack: string, query: string): boolean {
  const tokens = tokenizeTopicQuery(query);
  if (!tokens.length) return true;
  const hay = haystack.toLowerCase().replace(/-/g, " ");
  return tokens.every((tok) => {
    const variants = expandToken(tok).map((v) => v.replace(/-/g, " "));
    return variants.some((variant) => hay.includes(variant));
  });
}

export function buildHaystack(parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
