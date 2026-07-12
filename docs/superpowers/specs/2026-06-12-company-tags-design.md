# Company Tags for LeetCode ELO

## Problem

LeetCode ELO shows problems with ELO ratings from weekly/biweekly contests, topic tags, and solved state — but no information about which companies have asked each problem in interviews. Users have to cross-reference elsewhere to target specific companies.

## Goal

Integrate the CodeJeet dataset (17,000+ company→problem mappings across 663 companies) into LeetCode ELO so each problem displays which companies have asked it, and users can filter by company.

## Design

### Data Layer

A new `scripts/fetch_companies.js` Node.js script that:

1. Reads `ratings.txt` to get the set of ~2,485 contest problem IDs our app tracks
2. Fetches the list of company CSV filenames from the CodeJeet GitHub repo (`data/companies/*.csv`)
3. Fetches each CSV, parses `ID` and `Frequency %` columns
4. Inverts the data into `problemId → [{ company, frequency }]`
5. Filters to only include problem IDs present in our ratings.txt
6. Outputs `frontend/public/companies.json`

Output format:
```json
{
  "problems": {
    "1": ["amazon", "google", "meta"],
    "2": ["microsoft", "apple"]
  },
  "companyNames": {
    "amazon": "Amazon",
    "google": "Google",
    "meta": "Meta",
    "microsoft": "Microsoft",
    "apple": "Apple"
  }
}
```

The `companyNames` map normalizes slugs to display names (e.g. `"palantir-technologies"` → `"Palantir Technologies"`). Conversion: split on `-`, capitalize each word, rejoin with spaces. Frequency data is included in the script's internal processing but not emitted (saved for future use).

### CI Integration

The script is added to `.github/workflows/fetch-topics.yml` — it runs weekly alongside the existing topic tag fetch. The `companies.json` file is force-added to git tracking and committed if changed.

### Frontend Loading

Following the exact same pattern as `tags.json` in `ProblemTable.tsx`:
- On mount, fetch `/companies.json` (with GitHub raw fallback)
- Merge remote data with localStorage cache
- Normalize by problem ID and store in React state
- Persist to localStorage for offline use

### UI — Companies Column

A new column in the problem table:
- `<th>Companies</th>` inserted after the "Topics" column
- Each cell shows company names as small chips, reusing the existing `.company-chip` CSS class (already defined in `styles.css`)
- If a problem has no company data, the cell is empty
- Chips use the same compact style as topic tags but with the `.company-chip` class

### UI — Company Filter

A new input in the search section:
- Free-text input with `<datalist>` providing autocomplete from all company names
- Keyboard shortcut `C` to focus the company filter
- Works as AND with other filters (title, topic, rating range, contest)
- Filtering matches company name case-insensitively against the problem's company list
- The company query is included in the URL share state

### URL State

The `urlState.ts` module gets a new `companyQuery` field, serialized alongside existing filter parameters.

### Files Changed

- `scripts/fetch_companies.js` — new
- `.github/workflows/fetch-topics.yml` — add company fetch step
- `frontend/src/components/ProblemTable.tsx` — new column, new filter, load companies data
- `frontend/src/lib/urlState.ts` — add companyQuery to URL state
- `frontend/public/companies.json` — generated output

### Out of Scope (v1)

- Frequency % display — data is structured to support it but not rendered
- Company sorting — companies appear alphabetically
- Company-to-tier integration with the Guide component — future enhancement
