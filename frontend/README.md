# LeetCode ELO Explorer (frontend)

Simple React + Vite frontend to view and filter the LeetCode ELO ratings list.

## For Users (Hosted on Vercel)

- Visit the deployed app
- Ratings and topics auto-update weekly via GitHub Actions
- No setup needed — just browse, search, and filter

## For Developers

Run locally:

```bash
cd "frontend"
npm install
npm run dev
```

Import topics by querying LeetCode (recommended):

```bash
# from the repo root
# This fetches ratings.txt from GitHub automatically, then fetches topics for each problem
node scripts/fetch_leetcode_topics.js --resume --delay=200

# then in frontend
cd "frontend"
npm install
npm run dev
```

Optional quick test run:

```bash
node scripts/fetch_leetcode_topics.js --limit=20 --delay=200
```

Notes:
- The script fetches the latest `ratings.txt` directly from GitHub, so it always stays in sync with new problems
- Topics are fetched from LeetCode and saved to `frontend/public/tags.json`
- Re-run the script periodically to get topics for newly added problems

Features:
- Fetches `ratings.txt` from the GitHub source by default
- Upload a local `ratings.txt` as fallback
- Search, rating range filter, contest filter, sort

Additional features:
- Pagination (20/50/100 per page)
 - CSV export (full filtered set or current page)
 - Per-problem topic/tags you can add inline (saved to browser localStorage)

Deployment / build

```bash
cd "frontend"
 Tagging and topics
 - Add topics inline in the table; tags are saved to localStorage and used in the category search input.
 - If you want tags synced across users or stored centrally, I can add a small backend to store and serve tags.
npm install
npm run build
npx serve dist
```

Notes
- The app reads the raw `ratings.txt` from the upstream repo: https://raw.githubusercontent.com/zerotrac/leetcode_problem_rating/main/ratings.txt
- If you want an automated weekly cache or proxy, I can add a tiny backend that fetches and stores the file on a schedule.
