"""Validate company → ELO tier mapping using frequency-weighted percentiles.

For each company:
  - Fetch their interview question list from preptrack repo
  - Match each problem's title-slug against ratings.txt
  - Weight by interview Frequency (%) when available
  - Report unweighted and weighted median + p75
  - Classify by weighted p75 (closer to "interview bar" than median)
"""
from __future__ import annotations

import csv
import io
import json
import statistics
import sys
import urllib.parse
import urllib.request
from typing import Iterable

RATINGS_PATH = r"C:/Development/Leetcode ELO/Leetcode-ELO/ratings.txt"

COMPANIES: list[str] = [
    "amazon", "microsoft", "google", "meta", "apple", "stripe",
    "cloudflare", "capgemini", "palantir-technologies", "databricks",
    "citadel", "jane-street", "two-sigma", "jump-trading", "hrt",
    "de-shaw",
]

USER_PLACEMENT: dict[str, str] = {
    "amazon": "competent", "microsoft": "competent", "capgemini": "competent",
    "cloudflare": "competent", "stripe": "competent",
    "google": "strong", "meta": "strong", "apple": "strong",
    "databricks": "strong", "palantir-technologies": "strong",
    "hrt": "elite", "two-sigma": "elite", "de-shaw": "elite",
    "jane-street": "exceptional", "citadel": "exceptional", "jump-trading": "exceptional",
}

TIER_ORDER = ["beginner", "competent", "strong", "elite", "exceptional", "world class"]


def tier_from_score(score: float | None) -> str:
    if score is None:
        return "n/a"
    if score < 1500: return "beginner"
    if score < 1700: return "competent"
    if score < 1900: return "strong"
    if score < 2100: return "elite"
    if score < 2500: return "exceptional"
    return "world class"


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "curl/8"})
    with urllib.request.urlopen(req, timeout=30) as resp:  # noqa: S310
        return resp.read().decode("utf-8", errors="replace")


def list_files(company: str) -> list[str]:
    url = (
        "https://api.github.com/repos/pranavsh1408/preptrack/"
        f"contents/leetcode-companywise-interview-questions/{company}"
    )
    data = json.loads(fetch(url))
    return [item["name"] for item in data if item["type"] == "file"]


def extract_slug(link: str) -> str | None:
    link = (link or "").strip().rstrip("/")
    if not link:
        return None
    return link.split("/")[-1] or None


def parse_freq(raw: str) -> float:
    if not raw:
        return 0.0
    s = raw.strip().rstrip("%").replace(",", "")
    try:
        return float(s)
    except ValueError:
        return 0.0


def collect_company(company: str) -> list[tuple[str, float]]:
    files = list_files(company)
    csv_files = [f for f in files if f.lower().endswith(".csv")]
    target = next((f for f in csv_files if "all" in f.lower()), None)
    chosen = [target] if target else csv_files

    out: dict[str, float] = {}
    for fn in chosen:
        url = (
            "https://raw.githubusercontent.com/pranavsh1408/preptrack/main/"
            f"leetcode-companywise-interview-questions/{company}/{urllib.parse.quote(fn)}"
        )
        try:
            text = fetch(url)
        except Exception as exc:  # noqa: BLE001
            print(f"  err fetching {fn}: {exc}", file=sys.stderr)
            continue
        reader = csv.DictReader(io.StringIO(text))
        fields = reader.fieldnames or []
        link_key = next(
            (k for k in fields if "link" in k.lower() or "leetcode" in k.lower() or k.lower() == "url"),
            None,
        )
        freq_key = next((k for k in fields if "freq" in k.lower()), None)
        if not link_key:
            continue
        for row in reader:
            slug = extract_slug(row.get(link_key, ""))
            if not slug:
                continue
            freq = parse_freq(row.get(freq_key, "")) if freq_key else 0.0
            out[slug] = max(out.get(slug, 0.0), freq)
    return list(out.items())


def load_ratings() -> dict[str, float]:
    slug_to_rating: dict[str, float] = {}
    with open(RATINGS_PATH, encoding="utf-8") as f:
        reader = csv.reader(f, delimiter="\t")
        next(reader, None)
        for row in reader:
            if len(row) < 5:
                continue
            try:
                slug_to_rating[row[4]] = float(row[0])
            except ValueError:
                continue
    return slug_to_rating


def weighted_percentile(values: Iterable[tuple[float, float]], pct: float) -> float | None:
    items = sorted([(v, w) for v, w in values if w > 0], key=lambda x: x[0])
    if not items:
        return None
    total = sum(w for _, w in items)
    if total <= 0:
        return None
    cumulative = 0.0
    target = total * pct
    for v, w in items:
        cumulative += w
        if cumulative >= target:
            return v
    return items[-1][0]


def main() -> None:
    slug_to_rating = load_ratings()

    print(
        f"{'company':<24} {'matched/total':>13}  "
        f"{'uw_med':>6} {'uw_p75':>6}  {'w_med':>6} {'w_p75':>6}  "
        f"{'tier_by_w_p75':<14} {'placed':<12} verdict"
    )
    print("-" * 110)

    for company in COMPANIES:
        try:
            entries = collect_company(company)
        except Exception as exc:  # noqa: BLE001
            print(f"{company}: ERROR {exc}", file=sys.stderr)
            continue
        total = len(entries)
        matched: list[tuple[float, float]] = []
        for slug, freq in entries:
            rating = slug_to_rating.get(slug)
            if rating is None:
                continue
            matched.append((rating, freq))

        if not matched:
            print(f"{company:<24} {f'0/{total}':>13}  — no matches —")
            continue

        ratings_only = sorted(r for r, _ in matched)
        uw_med = statistics.median(ratings_only)
        uw_p75 = ratings_only[int(len(ratings_only) * 0.75)] if ratings_only else 0

        any_freq = any(w > 0 for _, w in matched)
        weighted = matched if any_freq else [(r, 1.0) for r, _ in matched]
        w_med = weighted_percentile(weighted, 0.50) or 0.0
        w_p75 = weighted_percentile(weighted, 0.75) or 0.0

        score = w_p75 if any_freq else uw_p75
        implied = tier_from_score(score)
        placed = USER_PLACEMENT.get(company, "?")

        try:
            delta = TIER_ORDER.index(implied) - TIER_ORDER.index(placed)
        except ValueError:
            delta = 0
        if delta == 0:
            verdict = "MATCH"
        elif delta > 0:
            verdict = f"UNDERRATED (+{delta})"
        else:
            verdict = f"OVERRATED ({delta})"

        note = "" if any_freq else " [no freq -> uniform]"
        print(
            f"{company:<24} {f'{len(matched)}/{total}':>13}  "
            f"{uw_med:>6.0f} {uw_p75:>6.0f}  {w_med:>6.0f} {w_p75:>6.0f}  "
            f"{implied:<14} {placed:<12} {verdict}{note}"
        )

    print()
    print("Classification rule: tier from FREQUENCY-WEIGHTED p75 (interview bar).")


if __name__ == "__main__":
    main()
