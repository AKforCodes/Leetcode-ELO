import React, { useMemo, useState } from "react";

type Problem = {
  rating: number;
  id: string;
  title: string;
  title_zh?: string;
  slug?: string;
  contest?: string;
  index?: string;
};

export default function ProblemTable({
  problems,
  loading
}: {
  problems: Problem[];
  loading?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [idQuery, setIdQuery] = useState("");
  const [minRating, setMinRating] = useState<number | "">("");
  const [maxRating, setMaxRating] = useState<number | "">("");
  const [contestFilter, setContestFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"rating" | "id">("rating");
  const [desc, setDesc] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [categoryQuery, setCategoryQuery] = useState("");
  const [tagsMap, setTagsMap] = useState<Record<string, string[]>>({});

  const contests = useMemo(() => {
    const set = new Set(problems.map((p) => p.contest || ""));
    return Array.from(set).filter((s) => s).sort();
  }, [problems]);

  // load tags from GitHub and merge with localStorage
  // Fetches from GitHub raw URL for auto-updated tags from CI/CD
  // Normalize keys to problem IDs when possible (supports keys by id, slug, or title)
  React.useEffect(() => {
    (async () => {
      let remote = {};
      try {
        // Try GitHub first (auto-updated by workflow)
        const res = await fetch(
          'https://raw.githubusercontent.com/zerotrac/leetcode_problem_rating/main/frontend/public/tags.json'
        );
        if (res.ok) remote = await res.json();
      } catch (e) {
        // Fallback to local if GitHub is unavailable
        try {
          const res = await fetch('/tags.json');
          if (res.ok) remote = await res.json();
        } catch (e2) {
          // no tags available; that's fine
        }
      }

      let local = {};
      try {
        const raw = localStorage.getItem("leetcode_tags_v1");
        local = raw ? JSON.parse(raw) : {};
      } catch (e) {
        local = {};
      }

      // Normalize: for each problem, look up remote/local by id, slug, title, title_zh
      const normalized = {};
      for (const p of problems) {
        const candidates = [String(p.id), p.slug || '', p.title || '', p.title_zh || ''];
        let tags = null;
        for (const c of candidates) {
          if (!c) continue;
          if (local[c]) { tags = local[c]; break; }
          if (remote[c]) { tags = remote[c]; break; }
        }
        if (tags) normalized[String(p.id)] = tags;
      }

      // Also pick up any local entries that are keyed by id but not in problems list
      for (const k of Object.keys(local)) if (/^\d+$/.test(k) && !normalized[k]) normalized[k] = local[k];

      setTagsMap(normalized);
      // also persist merged normalized mapping so future edits use id keys
      try { localStorage.setItem('leetcode_tags_v1', JSON.stringify(normalized)); } catch (e) {}
    })();
  }, [problems]);

  const filtered = useMemo(() => {
    setPage(1); // reset to first page on filter change
    return problems
      .filter((p) => {
        // ID search
        if (idQuery && !p.id.toLowerCase().includes(idQuery.toLowerCase())) return false;
        // main text search (title)
        if (query && !p.title.toLowerCase().includes(query.toLowerCase())) return false;
        // category/tags search
        if (categoryQuery) {
          const q = categoryQuery.toLowerCase();
          const tags = tagsMap[p.id] || [];
          const hay = [p.title, p.title_zh, p.slug, ...(tags || [])].join(" ").toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (contestFilter !== "all" && p.contest !== contestFilter) return false;
        const min = minRating === "" ? -Infinity : Number(minRating);
        const max = maxRating === "" ? Infinity : Number(maxRating);
        if (p.rating < min || p.rating > max) return false;
        return true;
      })
      .sort((a, b) => {
        const key = sortBy === "rating" ? a.rating - b.rating : Number(a.id) - Number(b.id);
        return desc ? -key : key;
      });
  }, [problems, query, idQuery, categoryQuery, tagsMap, minRating, maxRating, contestFilter, sortBy, desc]);

  // pagination
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);




  return (
    <div className="table-wrap">
      <div className="control-panel">
        <div className="search-section">
          <h3>Search</h3>
          <div className="search-inputs">
            <input
              placeholder="🔍 Search title..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="search-input"
            />
            <input
              placeholder="🏷️ Search ID (e.g., 1, 2, 3)..."
              value={idQuery}
              onChange={(e) => setIdQuery(e.target.value)}
              className="search-input"
            />
            <input
              placeholder="🔖 Search topics/tags..."
              value={categoryQuery}
              onChange={(e) => setCategoryQuery(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        <div className="filters-section">
          <h3>Filters & Sort</h3>
          <div className="filters-grid">
            <div className="filter-group">
              <label>ELO Range</label>
              <div className="range-inputs">
                <input
                  placeholder="Min"
                  type="number"
                  value={minRating === "" ? "" : minRating}
                  onChange={(e) => setMinRating(e.target.value === "" ? "" : Number(e.target.value))}
                />
                <span>—</span>
                <input
                  placeholder="Max"
                  type="number"
                  value={maxRating === "" ? "" : maxRating}
                  onChange={(e) => setMaxRating(e.target.value === "" ? "" : Number(e.target.value))}
                />
              </div>
            </div>

            <div className="filter-group">
              <label>Contest</label>
              <select value={contestFilter} onChange={(e) => setContestFilter(e.target.value)}>
                <option value="all">All contests</option>
                {contests.map((c) => (
                  <option value={c} key={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Sort By</label>
              <div className="sort-controls">
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                  <option value="rating">Rating</option>
                  <option value="id">ID</option>
                </select>
                <label className="sort-order">
                  <input type="checkbox" checked={desc} onChange={(e) => setDesc(e.target.checked)} />
                  <span>{desc ? "↓ Desc" : "↑ Asc"}</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="result-count">{loading ? "Loading..." : `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`}</div>

      <table className="spreadsheet">
        <thead>
          <tr>
            <th>Rating</th>
            <th>ID</th>
            <th>Title</th>
            <th>Topics</th>
            <th>Contest</th>
            <th>Index</th>
          </tr>
        </thead>
        <tbody>
          {paged.map((p) => (
            <tr key={p.id + p.slug}>
              <td className="col-rating">{Math.round(p.rating)}</td>
              <td className="col-id">{p.id}</td>
              <td className="col-title">
                <a href={`https://leetcode.com/problems/${p.slug}/`} target="_blank" rel="noreferrer">
                  {p.title}
                </a>
              </td>
              <td className="col-tags">
                <div className="tags">
                  {(tagsMap[p.id] || []).map((t) => (
                    <span className="tag" key={t}>
                      {t}
                    </span>
                  ))}
                </div>
              </td>
              <td className="col-contest">{p.contest}</td>
              <td className="col-index">{p.index}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="pagination">
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
          Prev
        </button>
        <span>
          Page {page} / {totalPages}
        </span>
        <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
          Next
        </button>
        <label style={{ marginLeft: 12 }}>
          Per page:
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
      </div>
    </div>
  );
}
