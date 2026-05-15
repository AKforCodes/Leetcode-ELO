import React from "react";

type TierClass =
  | "beginner"
  | "competent"
  | "strong"
  | "elite"
  | "exceptional"
  | "world";

type Tier = {
  range: string;
  tier: string;
  tierClass: TierClass;
  companies: string[];
  practice: string;
};

const TIERS: Tier[] = [
  {
    range: "1200–1400",
    tier: "Beginner",
    tierClass: "beginner",
    companies: ["Mid-tier startups", "Agency roles", "Non-FAANG SWE"],
    practice:
      "Comfortable on Easys and some Mediums. Most non-elite companies are passable with strong system design / behavioral prep.",
  },
  {
    range: "1500–1700",
    tier: "Competent",
    tierClass: "competent",
    companies: ["Amazon", "Microsoft", "Apple", "Meta", "Capgemini", "Cloudflare", "Stripe SWE"],
    practice:
      "Reliable on Mediums, can attempt Hards. Solid OA territory for Big Tech. Amazon and Meta phone screens become very passable here.",
  },
  {
    range: "1700–1900",
    tier: "Strong",
    tierClass: "strong",
    companies: ["Google", "Stripe SWE (senior)", "Palantir", "Databricks", "TikTok / ByteDance"],
    practice:
      "Consistently solves 2 Mediums + 1 Hard per contest. Core FAANG coding rounds feel under control. You're top ~15%.",
  },
  {
    range: "1900–2100",
    tier: "Elite",
    tierClass: "elite",
    companies: ["HRT (algo eng)", "Two Sigma QR", "D.E. Shaw", "Headlands", "Google L5+", "DeepMind SWE"],
    practice:
      "Hard problems feel tractable. Quant SWE coding rounds (HRT, Jump, Two Sigma) become realistic. You're top ~5%.",
  },
  {
    range: "2100–2500",
    tier: "Exceptional",
    tierClass: "exceptional",
    companies: ["Jane Street SWE", "Citadel Securities SWE", "Jump Trading SWE", "Competitive programming roles"],
    practice:
      "Top-tier quant firm SWE coding. These firms hire ex-ICPC/IOI competitors. Rating alone won't get you in — full profile (math, finance, behavioral) matters.",
  },
  {
    range: "2500+",
    tier: "World Class",
    tierClass: "world",
    companies: ["CodeNation / Trilogy", "Competitive programming jobs", "Top quant SWE specialist"],
    practice:
      "IOI/ICPC finalist territory. Extremely rare. No standard company interview is a blocker at this level.",
  },
];

export default function Guide() {
  return (
    <section className="guide" id="guide">
      <div className="guide-header">
        <h2>ELO Tier Guide</h2>
        <p className="guide-sub">
          Where your contest rating maps to real-world target companies. Use it to gauge whether
          you're in shape for a given interview loop.
        </p>
      </div>

      <div className="guide-table-wrap">
        <table className="guide-table">
          <thead>
            <tr>
              <th>Rating</th>
              <th>Tier</th>
              <th>Companies / Roles</th>
              <th className="hide-on-mobile">In Practice</th>
            </tr>
          </thead>
          <tbody>
            {TIERS.map((t) => (
              <tr key={t.range}>
                <td className="guide-rating">
                  <span className={`rating-pill tier-${t.tierClass}`}>{t.range}</span>
                </td>
                <td className="guide-tier">
                  <span className={`tier-chip tier-${t.tierClass}`}>{t.tier}</span>
                </td>
                <td>
                  <div className="company-chips">
                    {t.companies.map((c) => (
                      <span className="company-chip" key={c}>
                        {c}
                      </span>
                    ))}
                  </div>
                  <p className="practice-mobile">{t.practice}</p>
                </td>
                <td className="hide-on-mobile guide-practice">{t.practice}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="guide-footnote">
        Caveats: tiers are guidelines, not guarantees. Coding rating ≠ interview performance —
        system design, behavioral, and seniority bar matter. Role granularity (e.g. L5+, "senior")
        shifts placement within a company. Data informed by frequency-weighted analysis of
        community-curated company question lists.
      </p>
    </section>
  );
}
