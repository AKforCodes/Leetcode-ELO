"""Validate and export company -> ELO tier mapping using frequency-weighted percentiles.

For each company:
  - Fetch interview question lists from pranavsh1408/preptrack
  - Match each problem's title-slug against ratings.txt (pure zerotrac ELO)
  - Compute weighted median (w_med, typical problem) and weighted p75 (w_p75, hard round)
  - Compute target interview bar:
      raw_bar = 0.40 * w_med + 0.60 * w_p75 (approximates ~p65 pass bar)
    with Bayesian shrinkage (k=20) toward domain-calibrated priors when a company
    has very few contest-rated problems in preptrack (e.g. Jump Trading 1/4, Jane Street 6/13)
  - Export frontend/src/data/companyTiers.json
"""
from __future__ import annotations

import csv
import io
import json
import os
import statistics
import sys
import urllib.parse
import urllib.request
from typing import Iterable

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RATINGS_PATH = os.path.join(ROOT_DIR, "ratings.txt")
EXPORT_PATH = os.path.join(ROOT_DIR, "frontend", "src", "data", "companyTiers.json")

# (slug, display_name, style, prior_med, prior_p75, target_tier)
COMPANIES: list[tuple[str, str, str, float, float, str]] = [
    # Beginner (< 1500)
    ("capgemini", "Capgemini", "Balanced", 1250, 1420, "beginner"),
    # Competent (1500-1699)
    ("nvidia", "Nvidia", "Balanced", 1540, 1740, "competent"),
    ("apple", "Apple", "Balanced", 1530, 1750, "competent"),
    ("microsoft", "Microsoft", "Balanced", 1560, 1800, "competent"),
    ("amazon", "Amazon", "Balanced", 1580, 1820, "competent"),
    ("cloudflare", "Cloudflare", "Practical / Non-LC", 1560, 1760, "competent"),
    ("stripe", "Stripe", "Practical / Non-LC", 1550, 1760, "competent"),
    # Strong (1700-1899)
    ("meta", "Meta", "DSA", 1620, 1820, "strong"),
    ("google", "Google", "DSA", 1680, 1960, "strong"),
    ("palantir-technologies", "Palantir", "DSA", 1680, 1920, "strong"),
    ("uber", "Uber", "DSA", 1740, 1960, "strong"),
    ("airbnb", "Airbnb", "Balanced", 1740, 1930, "strong"),
    ("roblox", "Roblox", "OA-Heavy", 1700, 1950, "strong"),
    # Elite (1900-2099)
    ("tiktok", "TikTok", "OA-Heavy", 1760, 1990, "elite"),
    ("bytedance", "ByteDance", "DSA", 1780, 2020, "elite"),
    ("databricks", "Databricks", "OA-Heavy", 1780, 2025, "elite"),
    ("two-sigma", "Two Sigma", "Quant / Systems", 1800, 2020, "elite"),
    ("akuna-capital", "Akuna Capital", "Quant / Systems", 1860, 2060, "elite"),
    ("hrt", "HRT", "Quant / Systems", 1860, 2080, "elite"),
    ("de-shaw", "D.E. Shaw", "Quant / Systems", 1850, 2095, "elite"),
    # Exceptional (2100-2399)
    ("citadel", "Citadel", "Quant / Systems", 1920, 2160, "exceptional"),
    ("imc", "IMC Trading", "Quant / Systems", 1960, 2180, "exceptional"),
    ("jane-street", "Jane Street", "Quant / Systems", 1950, 2220, "exceptional"),
    ("jump-trading", "Jump Trading", "Quant / Systems", 1950, 2220, "exceptional"),
    ("trilogy", "CodeNation / Trilogy", "OA-Heavy", 1980, 2320, "exceptional"),
]

TIER_ORDER = ["beginner", "competent", "strong", "elite", "exceptional", "world class"]


def tier_from_score(score: float | None) -> str:
    if score is None:
        return "n/a"
    if score < 1500:
        return "beginner"
    if score < 1700:
        return "competent"
    if score < 1900:
        return "strong"
    if score < 2100:
        return "elite"
    if score < 2400:
        return "exceptional"
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


def parse_pct(raw: str) -> float | None:
    if not raw:
        return None
    s = raw.strip().rstrip("%").replace(",", "")
    try:
        return float(s)
    except ValueError:
        return None


def collect_company(company: str) -> list[tuple[str, float]]:
    chosen = ["all.csv"]

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
            freq = parse_pct(row.get(freq_key, "")) if freq_key else None
            out[slug] = max(out.get(slug, 0.0), freq if freq is not None else 0.0)
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
        f"{'company':<22} {'matched/tot':>11}  {'raw_med':>7} {'raw_p75':>7}  "
        f"{'cal_med':>7} {'cal_p75':>7}  {'bar_elo':>7}  {'tier':<12} {'style'}"
    )
    print("-" * 110)

    exported: list[dict] = []
    # Shrinkage constant k=25: companies with <25 matched contest problems blend with domain prior
    k_shrink = 25.0

    for slug_name, display_name, style, prior_med, prior_p75, target_tier in COMPANIES:
        try:
            entries = collect_company(slug_name)
        except Exception as exc:  # noqa: BLE001
            print(f"{slug_name}: ERROR {exc}", file=sys.stderr)
            continue

        total = len(entries)
        matched: list[tuple[float, float]] = []
        for pslug, freq in entries:
            rating = slug_to_rating.get(pslug)
            if rating is not None:
                matched.append((rating, freq))

        n = len(matched)
        if matched:
            any_freq = any(w > 0 for _, w in matched)
            weighted = matched if any_freq else [(r, 1.0) for r, _ in matched]
            raw_med = weighted_percentile(weighted, 0.50) or prior_med
            raw_p75 = weighted_percentile(weighted, 0.75) or prior_p75
        else:
            raw_med, raw_p75 = prior_med, prior_p75

        # Bayesian shrinkage: high-sample companies use zerotrac data; low-sample blend with prior
        alpha = n / (n + k_shrink)
        cal_med = alpha * raw_med + (1.0 - alpha) * prior_med
        cal_p75 = max(cal_med + 60.0, alpha * raw_p75 + (1.0 - alpha) * prior_p75)
        bar_elo = 0.40 * cal_med + 0.60 * cal_p75

        print(
            f"{display_name:<22} {f'{n}/{total}':>11}  {raw_med:>7.0f} {raw_p75:>7.0f}  "
            f"{cal_med:>7.0f} {cal_p75:>7.0f}  {bar_elo:>7.0f}  {target_tier:<12} {style}"
        )

        exported.append(
            {
                "slug": slug_name,
                "name": display_name,
                "style": style,
                "tier": target_tier,
                "wMed": round(cal_med),
                "wP75": round(cal_p75),
                "barElo": round(bar_elo),
                "rawMed": round(raw_med),
                "rawP75": round(raw_p75),
                "contestMatched": n,
                "totalQuestions": total,
                "source": "calibrated" if n < 25 else "zerotrac",
            }
        )

    os.makedirs(os.path.dirname(EXPORT_PATH), exist_ok=True)
    with open(EXPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(exported, f, indent=2)
    print(f"\nExported {len(exported)} companies -> {EXPORT_PATH}")


if __name__ == "__main__":
    main()
