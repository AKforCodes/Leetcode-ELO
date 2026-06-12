// Client-side helpers for the LeetCode bio-challenge verification flow.
// State lives entirely in localStorage; data is fetched from /api/leetcode.

export type LCAcSubmission = {
  id: string;
  title: string;
  titleSlug: string;
  timestamp: string; // unix seconds as string
};

export type LCProfilePayload = {
  username: string;
  aboutMe: string;
  ranking: number | null;
  avatar: string | null;
  submitStats: unknown;
  streak: number;
  totalActiveDays: number;
  submissionCalendar: Record<string, number | string>;
  recentAcSubmissionList: LCAcSubmission[];
};

export type LCAccount = {
  username: string;
  verified: boolean;
  verifiedAt: string | null; // ISO datetime
  lastSyncAt: string | null;
};

const ACCOUNT_KEY = "leetcode_account_v1";

export function loadAccount(): LCAccount | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.username !== "string" || !parsed.username) return null;
    return {
      username: parsed.username,
      verified: !!parsed.verified,
      verifiedAt: parsed.verifiedAt ?? null,
      lastSyncAt: parsed.lastSyncAt ?? null
    };
  } catch {
    return null;
  }
}

export function saveAccount(acc: LCAccount | null): void {
  if (typeof window === "undefined") return;
  try {
    if (acc) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(acc));
    else localStorage.removeItem(ACCOUNT_KEY);
  } catch {}
}

export function generateVerifyToken(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const stamp = Date.now().toString(36).slice(-4);
  return `leetcode-elo-verify-${rand}${stamp}`;
}

export async function fetchProfile(username: string): Promise<LCProfilePayload> {
  const res = await fetch(`/api/leetcode?user=${encodeURIComponent(username)}`);
  if (!res.ok) {
    let detail: any = null;
    try { detail = await res.json(); } catch {}
    const code = detail?.error || `http_${res.status}`;
    throw new Error(code);
  }
  return res.json();
}

// Convert LeetCode's submissionCalendar (unix-seconds keyed) into ISO-date counts
// matching the shape used by lib/activity.ts.
export function calendarToDayCounts(
  calendar: Record<string, number | string>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key in calendar) {
    const sec = Number(key);
    if (!Number.isFinite(sec)) continue;
    const d = new Date(sec * 1000);
    if (Number.isNaN(d.getTime())) continue;
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    const iso = `${y}-${m}-${day}`;
    const v = Number(calendar[key]) || 0;
    out[iso] = (out[iso] || 0) + v;
  }
  return out;
}

// Convert a LeetCode submission timestamp (unix seconds string) into a local
// YYYY-MM-DD so it matches the existing solvedDates schema.
export function timestampToIsoDate(timestamp: string): string {
  const sec = Number(timestamp);
  const d = Number.isFinite(sec) ? new Date(sec * 1000) : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
