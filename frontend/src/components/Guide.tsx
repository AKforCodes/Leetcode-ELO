import React, { useMemo, useState } from "react";
import rawCompanies from "../data/companyTiers.json";

type TierClass =
  | "beginner"
  | "competent"
  | "strong"
  | "elite"
  | "exceptional"
  | "world";

type CompanyEntry = {
  slug: string;
  name: string;
  style: string;
  tier: string;
  wMed: number;
  wP75: number;
  barElo: number;
};

const COMPANIES = rawCompanies as CompanyEntry[];

type TierDef = {
  range: string;
  tier: string;
  tierClass: TierClass;
  tierKey: string;
  extraChips?: string[];
  practice: string;
};

const TIERS: TierDef[] = [
  {
    range: "< 1500",
    tier: "Beginner",
    tierClass: "beginner",
    tierKey: "beginner",
    extraChips: ["Mid-tier startups", "Agency / IT services", "Non-FAANG SWE"],
    practice:
      "Comfortable on Easys and some Mediums. Most non-elite companies are passable with strong system design / behavioral prep.",
  },
  {
    range: "1500–1699",
    tier: "Competent",
    tierClass: "competent",
    tierKey: "competent",
    practice:
      "Reliable on Mediums, can attempt Hards. Solid OA and core SWE loop territory for Amazon, Microsoft, Apple, and Nvidia.",
  },
  {
    range: "1700–1899",
    tier: "Strong",
    tierClass: "strong",
    tierKey: "strong",
    practice:
      "Consistently solves 2 Mediums + 1 Hard per contest. Core FAANG coding rounds (Google, Meta, Uber, Airbnb) feel under control. You're top ~15%.",
  },
  {
    range: "1900–2099",
    tier: "Elite",
    tierClass: "elite",
    tierKey: "elite",
    practice:
      "Hard problems feel tractable. High-bar OAs (Databricks, TikTok / ByteDance) and quant SWE coding rounds (HRT, Two Sigma, D.E. Shaw) become realistic. You're top ~5%.",
  },
  {
    range: "2100–2399",
    tier: "Exceptional",
    tierClass: "exceptional",
    tierKey: "exceptional",
    practice:
      "Top-tier quant firm SWE coding (Jane Street, Citadel, Jump Trading, IMC) and toughest OAs. Rating alone won't get you in — full profile (math, systems, behavioral) matters.",
  },
  {
    range: "2400+",
    tier: "World Class",
    tierClass: "world",
    tierKey: "world class",
    extraChips: ["IOI / ICPC Finalists", "Competitive programming roles", "Top quant specialist"],
    practice:
      "IOI/ICPC finalist territory. Extremely rare. No standard company interview is a blocker at this level.",
  },
];

const AXIS_MIN = 1200;
const AXIS_MAX = 2400;
const AXIS_TICKS = [1200, 1500, 1700, 1900, 2100, 2400];
const STYLE_FILTERS = [
  "All",
  "DSA",
  "Balanced",
  "OA-Heavy",
  "Quant / Systems",
  "Practical / Non-LC",
];
const TIER_LEGEND: { label: string; cls: TierClass }[] = [
  { label: "Beginner (<1500)", cls: "beginner" },
  { label: "Competent (1500–1699)", cls: "competent" },
  { label: "Strong (1700–1899)", cls: "strong" },
  { label: "Elite (1900–2099)", cls: "elite" },
  { label: "Exceptional (2100+)", cls: "exceptional" },
];

function tierClassFromName(tier: string): TierClass {
  if (tier === "beginner") return "beginner";
  if (tier === "competent") return "competent";
  if (tier === "strong") return "strong";
  if (tier === "elite") return "elite";
  if (tier === "exceptional") return "exceptional";
  return "world";
}

function toPct(elo: number): number {
  const clamped = Math.max(AXIS_MIN, Math.min(AXIS_MAX, elo));
  return ((clamped - AXIS_MIN) / (AXIS_MAX - AXIS_MIN)) * 100;
}

export default function Guide() {
  const [view, setView] = useState<"tiers" | "ranges">("tiers");
  const [styleFilter, setStyleFilter] = useState<string>("All");

  const companiesByTier = useMemo(() => {
    const map = new Map<string, CompanyEntry[]>();
    for (const c of COMPANIES) {
      const list = map.get(c.tier) ?? [];
      list.push(c);
      map.set(c.tier, list);
    }
    return map;
  }, []);

  const filteredCompanies = useMemo(() => {
    const base =
      styleFilter === "All"
        ? COMPANIES
        : COMPANIES.filter((c) => c.style === styleFilter);
    return [...base].sort((a, b) => a.barElo - b.barElo || a.wP75 - b.wP75);
  }, [styleFilter]);

  return (
    <section className="guide" id="guide">
      <div className="guide-header guide-header-row">
        <div>
          <h2>ELO Tier Guide</h2>
          <p className="guide-sub">
            Where your contest rating maps to real-world target companies. Use it to gauge whether
            you&apos;re in shape for a given interview loop.
          </p>
        </div>

        <div className="guide-view-toggle" role="tablist" aria-label="Guide view">
          <button
            type="button"
            role="tab"
            aria-selected={view === "tiers"}
            className={view === "tiers" ? "is-active" : ""}
            onClick={() => setView("tiers")}
          >
            By Tier
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "ranges"}
            className={view === "ranges" ? "is-active" : ""}
            onClick={() => setView("ranges")}
          >
            ELO Ranges
          </button>
        </div>
      </div>

      {view === "tiers" ? (
        <div className="guide-table-wrap">
          <table className="guide-table">
            <colgroup>
              <col className="col-rating-w" />
              <col className="col-tier-w" />
              <col className="col-companies-w" />
              <col className="col-practice-w" />
            </colgroup>
            <thead>
              <tr>
                <th>Rating</th>
                <th>Tier</th>
                <th>Companies / Roles</th>
                <th className="hide-on-mobile">In Practice</th>
              </tr>
            </thead>
            <tbody>
              {TIERS.map((t) => {
                const matched = companiesByTier.get(t.tierKey) ?? [];
                return (
                  <tr key={t.range}>
                    <td className="guide-rating">
                      <span className={`rating-pill tier-${t.tierClass}`}>{t.range}</span>
                    </td>
                    <td className="guide-tier">
                      <span className={`tier-chip tier-${t.tierClass}`}>{t.tier}</span>
                    </td>
                    <td>
                      <div className="company-chips">
                        {matched.map((c) => (
                          <span
                            className="company-chip"
                            key={c.slug}
                            title={`${c.name}: ${c.wMed}–${c.wP75} ELO`}
                          >
                            {c.name}
                          </span>
                        ))}
                        {t.extraChips?.map((name) => (
                          <span className="company-chip" key={name}>
                            {name}
                          </span>
                        ))}
                      </div>
                      <p className="practice-mobile">{t.practice}</p>
                    </td>
                    <td className="hide-on-mobile guide-practice">{t.practice}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="range-view">
          <div className="range-toolbar">
            <div className="range-filters" role="group" aria-label="Filter by company type">
              {STYLE_FILTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`range-filter-btn ${styleFilter === s ? "is-active" : ""}`}
                  onClick={() => setStyleFilter(s)}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="range-legend" aria-label="Tier color legend">
              {TIER_LEGEND.map((item) => (
                <span key={item.cls} className="range-legend-item">
                  <span className={`range-legend-dot tier-${item.cls}`} />
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          <div className="range-axis-header">
            <div className="range-col-company">Company</div>
            <div className="range-col-track">
              <div className="range-axis-ticks">
                {AXIS_TICKS.map((tick) => (
                  <span
                    key={tick}
                    className="range-tick-label"
                    style={{ left: `${toPct(tick)}%` }}
                  >
                    {tick}
                  </span>
                ))}
              </div>
            </div>
            <div className="range-col-stats">Median – P75</div>
          </div>

          <div className="range-rows">
            {filteredCompanies.map((c) => {
              const leftPct = toPct(c.wMed);
              const rightPct = toPct(c.wP75);
              const widthPct = Math.max(1.5, rightPct - leftPct);
              const tc = tierClassFromName(c.tier);

              return (
                <div className="range-row" key={c.slug}>
                  <div className="range-col-company">
                    <span className="range-company-name">{c.name}</span>
                  </div>

                  <div className="range-col-track">
                    <div className="range-track">
                      {AXIS_TICKS.slice(1, -1).map((tick) => (
                        <span
                          key={tick}
                          className="range-grid-line"
                          style={{ left: `${toPct(tick)}%` }}
                        />
                      ))}
                      <div
                        className={`range-bar tier-${tc}`}
                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                        title={`${c.name}: Median ${c.wMed} – P75 ${c.wP75}`}
                      >
                        <span className="range-dot-med" />
                      </div>
                    </div>
                  </div>

                  <div className="range-col-stats">
                    <span className={`range-nums tier-text-${tc}`}>
                      {c.wMed}–{c.wP75}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="guide-footnote">
        Caveats: tiers are guidelines, not guarantees. Coding rating ≠ interview performance.
        System design, behavioral, and seniority bar matter. Role granularity (e.g. L5+, &quot;senior&quot;)
        shifts placement within a company. Data informed by frequency-weighted analysis of
        community-curated company question lists.
      </p>
    </section>
  );
}
