# LeetCode ELO Explorer

A web app to explore and filter LeetCode problems by difficulty (ELO rating), topics, and other criteria.

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
