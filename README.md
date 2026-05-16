# LeetCode ELO Explorer

A web app to explore and filter LeetCode problems by **ELO rating** — a far more precise measure of difficulty than the standard Easy / Medium / Hard tiers.

## What is ELO?

ELO is a rating system originally designed for chess that scores players (or, here, *problems*) on a continuous scale based on competitive results. Two problems both labeled "Medium" on LeetCode can be wildly different in difficulty — one might sit at ~1400 ELO (approachable for early intermediates) while another sits at ~2000 ELO (regularly stumps strong contest competitors).

The ratings used here come from [zerotrac's dataset](https://github.com/zerotrac/leetcode_problem_rating), which derives each problem's ELO from how contestants actually performed on it during weekly and biweekly contests. The result is a single number that captures *real-world* difficulty far better than LeetCode's three coarse buckets.

Rough tier guide:

| ELO range | Tier         | Feel                                        |
|-----------|--------------|---------------------------------------------|
| < 1300    | Beginner     | Warm-ups, fundamentals                      |
| 1300–1600 | Easy–Medium  | Standard interview territory                |
| 1600–1900 | Medium–Hard  | FAANG-style mid/senior interview questions  |
| 1900–2100 | Hard         | Top-tier interviews, strong contest problems |
| 2100+     | Very Hard    | Elite contest problems                      |

## What this app does

Browsing LeetCode itself, you cannot:
- Sort problems by **true** difficulty
- Filter "show me all Medium problems between 1500 and 1700 that involve graphs"
- See at a glance which "Easy" problems are deceptively hard (or which "Hard" problems are surprisingly approachable)

This explorer fixes that. It gives you:

- **Precise difficulty targeting** — pick an ELO range and grind problems calibrated to your current level
- **Topic + difficulty intersection** — practice graph problems at exactly the level you are preparing for
- **A practice roadmap** — the built-in Guide shows the ELO targets for startup / mid / FAANG-style interviews so you know what "ready" actually looks like
- **Always-fresh data** — a weekly GitHub Action re-fetches the dataset and LeetCode topic tags so newly added problems show up automatically
- **Instant search** — all data is shipped as static JSON, so filtering is client-side and zero-latency

In short: it turns LeetCode's flat problem list into a structured, measurable training tool.

## 🙏 Credits

**🌟 Special thanks to [zerotrac](https://github.com/zerotrac) for creating and maintaining the [LeetCode Problem Rating](https://github.com/zerotrac/leetcode_problem_rating) dataset!**

This project depends entirely on zerotrac's incredible work of calculating ELO ratings for all LeetCode problems based on contest performance data. Without zerotrac's dataset, this explorer wouldn't exist. If you find this tool useful, please star and support their original repository!

## Features

- **Browse all LeetCode problems** with ELO ratings
- **Filter by:**
  - Problem title (search)
  - Topics/categories (partial match)
  - ELO rating range (min/max)
  - Contest type
- **Sort** by rating or problem ID
- **Pagination** with adjustable page size
- **Auto-updated** — topics fetch weekly via GitHub Actions

## For Users

Visit the deployed app (Vercel link to be added) and start exploring!

- No setup required
- Ratings and topics auto-update every week
- All data is cached for instant loads

## For Developers

### Local Setup

```bash
# Install dependencies
cd frontend
npm install

# Start dev server (runs on port 5174)
npm run dev

# Build for production
npm run build
```

### Update Topics

To manually fetch the latest LeetCode topic tags:

```bash
# from repo root
node scripts/fetch_leetcode_topics.js --resume --delay=200
```

Flags:
- `--resume` — Skip already-fetched problems (continues from last run)
- `--delay=200` — Wait 200ms between requests (default 180ms)
- `--limit=20` — Fetch only first 20 problems (for testing)

### Automated Updates

GitHub Actions runs weekly (Sundays 2 AM UTC) to:
1. Fetch latest problems from zerotrac's dataset
2. Query LeetCode for current topic tags
3. Auto-commit updated data to the repo

See `GITHUB_ACTIONS_SETUP.md` for details on manual triggers.

## Data Sources

- **Ratings:** [zerotrac/leetcode_problem_rating](https://github.com/zerotrac/leetcode_problem_rating) (updated weekly)
- **Topics:** LeetCode GraphQL API (cached in `tags.json`)
- **Fallback:** Local cache for offline access

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Styling:** Modern CSS
- **Deployment:** Vercel (frontend) + GitHub Actions (automation)
- **Data Pipeline:** Node.js script with retry logic

## Known Limitations

- ~20 newest LeetCode problems may not have topics yet (LeetCode hasn't categorized them)
- Topics auto-populate when LeetCode adds categories (re-run fetch to capture)

## License

This project is licensed under the [MIT License](LICENSE).

Bundled third-party data and its license are listed in [NOTICE](NOTICE):
- `ratings.txt` is from [zerotrac/leetcode_problem_rating](https://github.com/zerotrac/leetcode_problem_rating) (MIT, © 2021 Shuxin Chen).
- `frontend/public/tags.json` is fetched from the public LeetCode GraphQL API; LeetCode retains all rights to their content.

## Contributing

Found a bug or have a feature request? Open an issue or submit a PR!
