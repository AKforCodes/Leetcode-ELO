import React, { useEffect, useMemo, useState } from "react";
import ProblemTable from "./components/ProblemTable";

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
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function App() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

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

  const summary = useMemo(() => {
    if (!problems.length) return "0 problems";
    const avg = Math.round(
      problems.reduce((s, p) => s + (p.rating || 0), 0) / problems.length
    );
    return `${problems.length} problems — avg rating ${avg}`;
  }, [problems]);

  return (
    <div className="app">
      <header>
        <h1>LeetCode ELO Explorer</h1>
        <div className="controls">
          <div className="summary">{summary}</div>
          <button
            type="button"
            className="theme-toggle"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4"/>
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
        </div>
      </header>

      {error && <div className="error">{error}</div>}
      <main>
        <ProblemTable problems={problems} loading={loading} />
      </main>

      <footer>
        <small>
          Data source: <a href="https://github.com/zerotrac/leetcode_problem_rating">zerotrac/leetcode_problem_rating</a>
        </small>
      </footer>
    </div>
  );
}
