import React, { useEffect, useMemo, useRef, useState } from "react";
import ProblemTable from "./components/ProblemTable";
import Guide from "./components/Guide";

type Problem = {
  rating: number;
  id: string;
  title: string;
  title_zh?: string;
  slug?: string;
  contest?: string;
  index?: string;
};

const GITHUB_RAW =
  "https://raw.githubusercontent.com/zerotrac/leetcode_problem_rating/main/ratings.txt";

function parseRatings(text: string): Problem[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length <= 1) return [];
  const header = lines[0].split(/\t+/).map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);
  const iRating = idx("Rating");
  const iId = idx("ID");
  const iTitle = idx("Title");
  const iTitleZH = idx("Title ZH");
  const iSlug = idx("Title Slug");
  const iContest = idx("Contest Slug");
  const iIndex = idx("Problem Index");

  const rows = lines.slice(1);
  return rows.map((r) => {
    const cols = r.split(/\t+/);
    return {
      rating: Number(cols[iRating]) || 0,
      id: cols[iId] || "",
      title: cols[iTitle] || "",
      title_zh: cols[iTitleZH] || "",
      slug: cols[iSlug] || "",
      contest: cols[iContest] || "",
      index: cols[iIndex] || ""
    } as Problem;
  });
}

type Theme = "light" | "dark";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = localStorage.getItem("theme") as Theme | null;
  if (saved === "light" || saved === "dark") return saved;
  return "light";
}

export default function App() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [showGuide, setShowGuide] = useState(false);
  const guideRef = useRef<HTMLDivElement>(null);

  function toggleGuide() {
    setShowGuide((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => guideRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      }
      return next;
    });
  }

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#0f1115" : "#ffffff");
  }, [theme]);

  useEffect(() => {
    loadFromGit();
  }, []);

  async function loadFromGit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(GITHUB_RAW);
      if (!res.ok) throw new Error(res.statusText);
      const txt = await res.text();
      const parsed = parseRatings(txt);
      setProblems(parsed);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    if (!problems.length) return null;
    const ratings = problems.map((p) => p.rating || 0).filter((r) => r > 0);
    if (!ratings.length) return null;
    const avg = Math.round(ratings.reduce((s, r) => s + r, 0) / ratings.length);
    const min = Math.min(...ratings);
    const max = Math.max(...ratings);
    return { count: problems.length, avg, min, max };
  }, [problems]);

  return (
    <div className="app">
      <header className="site-header">
        <div className="brand">
          <img
            src={theme === "dark" ? "/brand/logo-dark.png" : "/brand/logo-white.png"}
            alt=""
            className="brand-mark"
            width={72}
            height={72}
            decoding="async"
          />
          <div className="brand-text">
            <h1>
              LeetCode <em>ELO</em>
            </h1>
            <p className="brand-tag">Contest ratings, mapped to where they actually land.</p>
          </div>
        </div>
        <div className="controls">
          <button
            type="button"
            className="ghost-btn"
            aria-expanded={showGuide}
            aria-controls="guide"
            onClick={toggleGuide}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <span>{showGuide ? "Hide guide" : "Tier guide"}</span>
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {stats && (
        <section className="stat-row" aria-label="Dataset overview">
          <div className="stat">
            <span className="stat-label">Problems</span>
            <span className="stat-value">{stats.count.toLocaleString()}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Average rating</span>
            <span className="stat-value">{stats.avg.toLocaleString()}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Lowest</span>
            <span className="stat-value">{Math.round(stats.min).toLocaleString()}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Highest</span>
            <span className="stat-value">{Math.round(stats.max).toLocaleString()}</span>
          </div>
        </section>
      )}

      {error && <div className="error" role="alert">{error}</div>}
      {showGuide && (
        <div ref={guideRef}>
          <Guide />
        </div>
      )}
      <main>
        <ProblemTable problems={problems} loading={loading} />
      </main>

      <footer>
        <small>
          Data from <a href="https://github.com/zerotrac/leetcode_problem_rating">zerotrac/leetcode_problem_rating</a>.
          Built for the in-between hour before a contest.
        </small>
      </footer>
    </div>
  );
}
