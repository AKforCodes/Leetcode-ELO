export type SolvedDates = Record<string, string>;

const DATES_KEY = "leetcode_solved_dates_v1";
const LEGACY_KEY = "leetcode_solved_v1";

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function loadSolvedDates(): SolvedDates {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(DATES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    }
    // Migrate from legacy Set: assign today's date to all previously solved.
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const arr = JSON.parse(legacy);
      if (Array.isArray(arr) && arr.length > 0) {
        const today = isoDate(new Date());
        const out: SolvedDates = {};
        for (const id of arr) out[String(id)] = today;
        return out;
      }
    }
  } catch {}
  return {};
}

export function saveSolvedDates(dates: SolvedDates): void {
  try {
    localStorage.setItem(DATES_KEY, JSON.stringify(dates));
    // Keep legacy key in sync so anything still reading it sees the same IDs.
    localStorage.setItem(LEGACY_KEY, JSON.stringify(Object.keys(dates)));
  } catch {}
}

export function getDayCounts(dates: SolvedDates): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id in dates) {
    const day = dates[id];
    if (!day) continue;
    counts[day] = (counts[day] || 0) + 1;
  }
  return counts;
}

export function computeStreak(dayCounts: Record<string, number>): number {
  let streak = 0;
  const cursor = new Date();
  // Today being empty doesn't break the streak — yesterday's run still counts.
  if (!dayCounts[isoDate(cursor)]) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while ((dayCounts[isoDate(cursor)] || 0) > 0) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export type HeatCell = {
  date: string;
  count: number;
  isFuture: boolean;
  isToday: boolean;
};

export function buildHeatmap(dayCounts: Record<string, number>, weeks = 13): HeatCell[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = isoDate(today);
  const dow = today.getDay(); // 0 = Sunday
  const start = new Date(today);
  start.setDate(today.getDate() - dow - (weeks - 1) * 7);

  const cells: HeatCell[] = [];
  for (let i = 0; i < weeks * 7; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = isoDate(d);
    cells.push({
      date: iso,
      count: dayCounts[iso] || 0,
      isFuture: d.getTime() > today.getTime(),
      isToday: iso === todayIso
    });
  }
  return cells;
}

export function bucketForCount(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}
