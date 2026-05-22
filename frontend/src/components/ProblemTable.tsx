import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { matchesTopicQuery, buildHaystack } from "../lib/topicFilter";
import { DEFAULT_STATE, readStateFromUrl, writeStateToUrl } from "../lib/urlState";
import { isoDate, loadSolvedDates, saveSolvedDates, type SolvedDates } from "../lib/activity";
import ActivityPanel from "./ActivityPanel";

const INITIAL_URL_STATE =
  typeof window !== "undefined" ? readStateFromUrl(window.location.search) : {};

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
  const [query, setQuery] = useState(INITIAL_URL_STATE.query ?? DEFAULT_STATE.query);
  const [idQuery, setIdQuery] = useState(INITIAL_URL_STATE.idQuery ?? DEFAULT_STATE.idQuery);
  const [minRating, setMinRating] = useState<number | "">(
    INITIAL_URL_STATE.minRating ?? DEFAULT_STATE.minRating
  );
  const [maxRating, setMaxRating] = useState<number | "">(
    INITIAL_URL_STATE.maxRating ?? DEFAULT_STATE.maxRating
  );
  const [contestFilter, setContestFilter] = useState(
    INITIAL_URL_STATE.contestFilter ?? DEFAULT_STATE.contestFilter
  );
  const [sortBy, setSortBy] = useState<"rating" | "id">(
    INITIAL_URL_STATE.sortBy ?? DEFAULT_STATE.sortBy
  );
  const [desc, setDesc] = useState(INITIAL_URL_STATE.desc ?? DEFAULT_STATE.desc);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [categoryQuery, setCategoryQuery] = useState(
    INITIAL_URL_STATE.categoryQuery ?? DEFAULT_STATE.categoryQuery
  );
  const [tagsMap, setTagsMap] = useState<Record<string, string[]>>({});
  const [solvedDates, setSolvedDates] = useState<SolvedDates>(() => loadSolvedDates());
  const solved = useMemo(() => new Set(Object.keys(solvedDates)), [solvedDates]);
  const [hideSolved, setHideSolved] = useState(
    INITIAL_URL_STATE.hideSolved ?? DEFAULT_STATE.hideSolved
  );

  useEffect(() => {
    saveSolvedDates(solvedDates);
  }, [solvedDates]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const qs = writeStateToUrl({
      query,
      idQuery,
      categoryQuery,
      minRating,
      maxRating,
      contestFilter,
      sortBy,
      desc,
      hideSolved
    });
    const next = `${window.location.pathname}${qs}${window.location.hash}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(null, "", next);
    }
  }, [query, idQuery, categoryQuery, minRating, maxRating, contestFilter, sortBy, desc, hideSolved]);

  const toggleSolved = useCallback((id: string) => {
    setSolvedDates((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = isoDate(new Date());
      return next;
    });
  }, []);

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

      // Normalize: for each problem, prefer REMOTE (authoritative, refreshes weekly)
      // over local cache. Empty arrays are treated as "no data" so a previously
      // cached empty result never shadows fresh tags after LC categorizes a problem.
      const hasTags = (v) => Array.isArray(v) && v.length > 0;
      const normalized = {};
      for (const p of problems) {
        const candidates = [String(p.id), p.slug || '', p.title || '', p.title_zh || ''];
        let tags = null;
        for (const c of candidates) {
          if (!c) continue;
          if (hasTags(remote[c])) { tags = remote[c]; break; }
          if (hasTags(local[c])) { tags = local[c]; break; }
        }
        if (tags) normalized[String(p.id)] = tags;
      }

      // Pick up any local entries keyed by id but not in problems list (legacy data).
      for (const k of Object.keys(local)) {
        if (/^\d+$/.test(k) && !normalized[k] && hasTags(local[k])) normalized[k] = local[k];
      }

      setTagsMap(normalized);
      // Persist only non-empty entries so empty placeholders never get baked into the cache.
      try { localStorage.setItem('leetcode_tags_v1', JSON.stringify(normalized)); } catch (e) {}
    })();
  }, [problems]);

  const filtered = useMemo(() => {
    setPage(1); // reset to first page on filter change
    return problems
      .filter((p) => {
        if (hideSolved && solved.has(String(p.id))) return false;
        // ID search
        if (idQuery && !p.id.toLowerCase().includes(idQuery.toLowerCase())) return false;
        // main text search (title)
        if (query && !p.title.toLowerCase().includes(query.toLowerCase())) return false;
        // category/tags search
        if (categoryQuery) {
          const tags = tagsMap[p.id] || [];
          const hay = buildHaystack([p.title, p.title_zh, p.slug, ...tags]);
          if (!matchesTopicQuery(hay, categoryQuery)) return false;
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
  }, [problems, query, idQuery, categoryQuery, tagsMap, minRating, maxRating, contestFilter, sortBy, desc, hideSolved, solved]);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const topicInputRef = useRef<HTMLInputElement>(null);

  const [copied, setCopied] = useState(false);
  const copyShareLink = useCallback(async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked — fallback: select-prompt
      window.prompt("Copy this link:", url);
    }
  }, []);

  const openRandomProblem = useCallback(() => {
    if (!filtered.length) return;
    const pick = filtered[Math.floor(Math.random() * filtered.length)];
    if (!pick.slug) return;
    window.open(`https://leetcode.com/problems/${pick.slug}/`, "_blank", "noopener,noreferrer");
  }, [filtered]);

  useEffect(() => {
    const isEditableTarget = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (el.isContentEditable) return true;
      return false;
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;

      if (e.key === "/") {
        e.preventDefault();
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
        return;
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        openRandomProblem();
        return;
      }
      if (e.key === "h" || e.key === "H") {
        e.preventDefault();
        setHideSolved((v) => !v);
        return;
      }
      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        topicInputRef.current?.focus();
        topicInputRef.current?.select();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openRandomProblem]);

  // pagination
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);




  return (
    <div className="table-wrap">
      <ActivityPanel solvedDates={solvedDates} />
      <div className="control-panel">
        <div className="search-section">
          <div className="search-inputs">
            <div className="input-wrap">
              <svg className="input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                ref={titleInputRef}
                placeholder="Search by title"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search by title"
              />
              {!query && <kbd className="kbd-hint kbd-in-input" aria-hidden="true">/</kbd>}
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
                ref={topicInputRef}
                placeholder="Topic or tag"
                value={categoryQuery}
                onChange={(e) => setCategoryQuery(e.target.value)}
                aria-label="Search by topic or tag"
              />
              {!categoryQuery && <kbd className="kbd-hint kbd-in-input" aria-hidden="true">T</kbd>}
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

      <div className="result-row">
        <div className="result-count">
          {loading ? "Loading..." : `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`}
          {solved.size > 0 && !loading && (
            <span className="solved-count"> · {solved.size} solved</span>
          )}
        </div>
        <div className="result-actions">
          <button
            type="button"
            className="random-btn"
            onClick={copyShareLink}
            title="Copy a link to this exact filtered view"
            aria-label="Copy share link"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <span>{copied ? "Copied!" : "Share"}</span>
          </button>
          <label className="hide-solved-toggle" title="Hide problems you've marked solved">
            <input
              type="checkbox"
              checked={hideSolved}
              onChange={(e) => setHideSolved(e.target.checked)}
            />
            <span className="hst-check" aria-hidden="true" />
            <span className="hst-label">Hide solved</span>
          </label>
        <button
          type="button"
          className="random-btn"
          onClick={openRandomProblem}
          disabled={!filtered.length}
          title="Open a random problem from the current filter (R)"
          aria-label="Open a random problem from the current filter"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <circle cx="8" cy="8" r="1.2" />
            <circle cx="16" cy="16" r="1.2" />
            <circle cx="16" cy="8" r="1.2" />
            <circle cx="8" cy="16" r="1.2" />
            <circle cx="12" cy="12" r="1.2" />
          </svg>
          <span>Random</span>
          <kbd className="kbd-hint" aria-hidden="true">R</kbd>
        </button>
        </div>
      </div>

      <div className="table-scroll">
      <table className="spreadsheet">
        <thead>
          <tr>
            <th className="col-done-h" aria-label="Solved"></th>
            <th>Rating</th>
            <th>ID</th>
            <th>Title</th>
            <th>Topics</th>
            <th>Contest</th>
            <th>Index</th>
          </tr>
        </thead>
        <tbody>
          {paged.map((p) => {
            const isSolved = solved.has(String(p.id));
            return (
            <tr key={p.id + p.slug} className={isSolved ? "row-solved" : undefined}>
              <td className="col-done" data-label="Solved">
                <label className="solve-check" title={isSolved ? "Mark as unsolved" : "Mark as solved"}>
                  <input
                    type="checkbox"
                    checked={isSolved}
                    onChange={() => toggleSolved(String(p.id))}
                    aria-label={isSolved ? `Mark ${p.title} as unsolved` : `Mark ${p.title} as solved`}
                  />
                  <span aria-hidden="true" />
                </label>
              </td>
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
            );
          })}
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
