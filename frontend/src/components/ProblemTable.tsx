import React, { useMemo, useState } from "react";

function ratingTier(r: number): string {
  if (r < 1500) return "beginner";
  if (r < 1700) return "competent";
  if (r < 1900) return "strong";
  if (r < 2100) return "elite";
  if (r < 2500) return "exceptional";
  return "world";
}

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
        const res = await fetch('/tags.json', { cache: 'no-cache' });
        if (res.ok) remote = await res.json();
      } catch (e) {
        try {
          const res = await fetch(
            'https://raw.githubusercontent.com/AKforCodes/Leetcode-ELO/main/frontend/public/tags.json'
          );
          if (res.ok) remote = await res.json();
        } catch (e2) {}
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
          <div className="search-inputs">
            <div className="input-wrap">
              <svg className="input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                placeholder="Search by title"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search by title"
              />
            </div>
            <div className="input-wrap">
              <span className="input-prefix" aria-hidden="true">#</span>
              <input
                placeholder="Problem ID"
                value={idQuery}
                onChange={(e) => setIdQuery(e.target.value)}
                inputMode="numeric"
                aria-label="Search by problem ID"
              />
            </div>
            <div className="input-wrap">
              <svg className="input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
              </svg>
              <input
                placeholder="Topic or tag"
                value={categoryQuery}
                onChange={(e) => setCategoryQuery(e.target.value)}
                aria-label="Search by topic or tag"
              />
            </div>
          </div>
        </div>

        <div className="filters-section">
          <div className="filters-grid">
            <div className="filter-group">
              <label>Rating range</label>
              <div className="range-inputs">
                <input
                  placeholder="Min"
                  type="number"
                  value={minRating === "" ? "" : minRating}
                  onChange={(e) => setMinRating(e.target.value === "" ? "" : Number(e.target.value))}
                />
                <span aria-hidden="true">→</span>
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
              <label>Sort by</label>
              <div className="sort-controls">
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                  <option value="rating">Rating</option>
                  <option value="id">ID</option>
                </select>
                <button
                  type="button"
                  className="sort-order"
                  onClick={() => setDesc((d) => !d)}
                  aria-label={desc ? "Sort descending" : "Sort ascending"}
                  title={desc ? "Sort descending" : "Sort ascending"}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: desc ? "none" : "rotate(180deg)", transition: "transform .15s ease" }}>
                    <path d="M12 5v14" />
                    <path d="m19 12-7 7-7-7" />
                  </svg>
                  <span>{desc ? "Desc" : "Asc"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="result-count">{loading ? "Loading..." : `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`}</div>

      <div className="table-scroll">
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
              <td className="col-rating" data-label="Rating">
                <span className={`rating-pill tier-${ratingTier(p.rating)}`}>{Math.round(p.rating)}</span>
              </td>
              <td className="col-id" data-label="ID">{p.id}</td>
              <td className="col-title" data-label="Title">
                <a href={`https://leetcode.com/problems/${p.slug}/`} target="_blank" rel="noreferrer">
                  {p.title}
                </a>
              </td>
              <td className="col-tags" data-label="Topics">
                <div className="tags">
                  {(tagsMap[p.id] || []).map((t) => (
                    <span className="tag" key={t}>
                      {t}
                    </span>
                  ))}
                </div>
              </td>
              <td className="col-contest" data-label="Contest">{p.contest}</td>
              <td className="col-index" data-label="Index">{p.index}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

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
