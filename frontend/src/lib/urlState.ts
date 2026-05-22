export type FilterState = {
  query: string;
  idQuery: string;
  categoryQuery: string;
  minRating: number | "";
  maxRating: number | "";
  contestFilter: string;
  sortBy: "rating" | "id";
  desc: boolean;
  hideSolved: boolean;
};

const KEYS = {
  query: "q",
  idQuery: "id",
  categoryQuery: "t",
  minRating: "min",
  maxRating: "max",
  contestFilter: "c",
  sortBy: "s",
  desc: "o",
  hideSolved: "hs"
} as const;

export const DEFAULT_STATE: FilterState = {
  query: "",
  idQuery: "",
  categoryQuery: "",
  minRating: "",
  maxRating: "",
  contestFilter: "all",
  sortBy: "rating",
  desc: true,
  hideSolved: false
};

export function readStateFromUrl(search: string): Partial<FilterState> {
  const params = new URLSearchParams(search);
  const out: Partial<FilterState> = {};

  const q = params.get(KEYS.query);
  if (q !== null) out.query = q;

  const id = params.get(KEYS.idQuery);
  if (id !== null) out.idQuery = id;

  const t = params.get(KEYS.categoryQuery);
  if (t !== null) out.categoryQuery = t;

  const min = params.get(KEYS.minRating);
  if (min !== null && min !== "") {
    const n = Number(min);
    if (Number.isFinite(n)) out.minRating = n;
  }

  const max = params.get(KEYS.maxRating);
  if (max !== null && max !== "") {
    const n = Number(max);
    if (Number.isFinite(n)) out.maxRating = n;
  }

  const c = params.get(KEYS.contestFilter);
  if (c !== null && c !== "") out.contestFilter = c;

  const s = params.get(KEYS.sortBy);
  if (s === "rating" || s === "id") out.sortBy = s;

  const o = params.get(KEYS.desc);
  if (o === "a") out.desc = false;
  else if (o === "d") out.desc = true;

  const hs = params.get(KEYS.hideSolved);
  if (hs === "1") out.hideSolved = true;

  return out;
}

export function writeStateToUrl(state: FilterState): string {
  const params = new URLSearchParams();
  if (state.query) params.set(KEYS.query, state.query);
  if (state.idQuery) params.set(KEYS.idQuery, state.idQuery);
  if (state.categoryQuery) params.set(KEYS.categoryQuery, state.categoryQuery);
  if (state.minRating !== "") params.set(KEYS.minRating, String(state.minRating));
  if (state.maxRating !== "") params.set(KEYS.maxRating, String(state.maxRating));
  if (state.contestFilter && state.contestFilter !== "all") params.set(KEYS.contestFilter, state.contestFilter);
  if (state.sortBy !== DEFAULT_STATE.sortBy) params.set(KEYS.sortBy, state.sortBy);
  if (state.desc !== DEFAULT_STATE.desc) params.set(KEYS.desc, state.desc ? "d" : "a");
  if (state.hideSolved) params.set(KEYS.hideSolved, "1");
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
