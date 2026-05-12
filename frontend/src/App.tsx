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

export default function App() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
