# GitHub Actions Setup

The project includes an automated GitHub Actions workflow that:
- Runs every Sunday at 2 AM UTC
- Fetches the latest LeetCode problems from GitHub
- Queries LeetCode for topic tags
- Commits updated `tags.json` to your repo
- All users automatically see updated tags on next page load

## Setup

1. Push this repo to GitHub (if not already done)
2. GitHub Actions will automatically enable
3. Workflow file: `.github/workflows/fetch-topics.yml`

## Manual Trigger

To run the fetch immediately (instead of waiting for Sunday):

1. Go to your GitHub repo
2. Click "Actions" tab
3. Click "Fetch LeetCode Topics Weekly"
4. Click "Run workflow"

## How It Works

1. Workflow runs the fetch script: `node scripts/fetch_leetcode_topics.js --resume --delay=200`
2. Updates `frontend/public/tags.json` with latest topics
3. Commits changes to your repo
4. Frontend fetches from GitHub raw URL:
   - Primary: `https://raw.githubusercontent.com/[owner]/[repo]/main/frontend/public/tags.json`
   - Fallback: Local `/tags.json`

## Monitoring

- Check "Actions" tab in GitHub to see workflow runs and logs
- Each run takes ~20-30 minutes (depending on number of problems)

## Notes

- No additional secrets or configuration needed
- The workflow has read/write permissions to auto-commit
- Runs reliably on GitHub's infrastructure (no rate limits)
