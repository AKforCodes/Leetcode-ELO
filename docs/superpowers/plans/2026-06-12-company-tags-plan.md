# Company Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add company tags from the CodeJeet dataset to LeetCode ELO problems — new Companies column, company filter with autocomplete, and a CI script to keep data fresh.

**Architecture:** A Node.js script fetches company CSVs from the CodeJeet GitHub repo weekly (via GitHub Actions), filters to only contest problems we track, and outputs `companies.json`. The frontend loads this JSON alongside the existing `tags.json` and renders company chips in a new table column.

**Tech Stack:** Node.js (built-in https only), React 18, TypeScript, CSS custom properties, GitHub Actions

---

### Task 1: Create `scripts/fetch_companies.js`

**Files:**
- Create: `scripts/fetch_companies.js`

- [ ] **Step 1: Write the script**

```javascript
const fs = require("fs");
const path = require("path");
const https = require("https");

const root = path.join(__dirname, "..");
const ratingsPath = path.join(root, "ratings.txt");
const outDir = path.join(root, "frontend", "public");
const outPath = path.join(outDir, "companies.json");
const CODEJEET_API = "https://api.github.com/repos/ayush-that/codejeet/contents/data/companies";
const RAW_BASE = "https://raw.githubusercontent.com/ayush-that/codejeet/main/data/companies";
const CONCURRENCY = 20;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "Leetcode-ELO" } }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        }
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Bad JSON: ${String(e)}`)); }
      });
    }).on("error", reject);
  });
}

function readRatings() {
  const text = fs.readFileSync(ratingsPath, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return new Set();
  const header = lines[0].split(/\t+/);
  const iId = header.indexOf("ID");
  const ids = new Set();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/\t+/);
    const id = String(cols[iId] || "").trim();
    if (id) ids.add(id);
  }
  return ids;
}

function capitalizeWords(slug) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 1) return [];
  // Try comma or tab
  const sep = lines[0].includes("\t") ? "\t" : ",";
  const header = lines[0].split(sep).map((c) => c.trim());
  const iId = header.indexOf("ID");
  if (iId === -1) return [];
  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep);
    const id = String(cols[iId] || "").trim();
    if (id) result.push(id);
  }
  return result;
}

async function fetchCSV(filename) {
  const url = `${RAW_BASE}/${filename}`;
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "Leetcode-ELO" } }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode} for ${filename}`));
        }
        resolve(data);
      });
    }).on("error", reject);
  });
}

async function main() {
  console.log("Reading ratings.txt...");
  const ourIds = readRatings();
  console.log(`Tracking ${ourIds.size} problem IDs`);

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // Get list of company CSV files from CodeJeet repo
  console.log("Fetching company file list from CodeJeet...");
  let files;
  try {
    files = await get(CODEJEET_API);
  } catch (e) {
    throw new Error(`Failed to fetch CodeJeet file list: ${String(e)}`);
  }

  const csvFiles = files
    .filter((f) => f.name.endsWith(".csv"))
    .map((f) => ({ name: f.name, slug: f.name.replace(/\.csv$/i, "") }));

  console.log(`Found ${csvFiles.length} company CSV files`);

  // Fetch CSVs in batches
  const problems = {}; // { problemId: Set<companySlug> }
  const companySlugToName = {};
  let fetched = 0;
  let totalMatches = 0;

  for (let i = 0; i < csvFiles.length; i += CONCURRENCY) {
    const batch = csvFiles.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((f) => fetchCSV(f.name))
    );

    for (let j = 0; j < batch.length; j++) {
      const f = batch[j];
      const r = results[j];
      if (r.status === "rejected") {
        console.warn(`  Failed: ${f.name} — ${r.reason.message}`);
        continue;
      }
      const ids = parseCSV(r.value);
      const matched = [];
      for (const id of ids) {
        if (ourIds.has(id)) {
          matched.push(id);
          if (!problems[id]) problems[id] = new Set();
          problems[id].add(f.slug);
        }
      }
      companySlugToName[f.slug] = capitalizeWords(f.slug);
      fetched++;
      totalMatches += matched.length;
    }

    if ((i + CONCURRENCY) % 100 === 0) {
      console.log(`  Processed ${Math.min(i + CONCURRENCY, csvFiles.length)}/${csvFiles.length} files, ${totalMatches} problem-company matches so far`);
    }

    // Small delay between batches to avoid hammering
    await sleep(100);
  }

  // Convert Sets to sorted arrays
  const problemsOut = {};
  for (const [id, companies] of Object.entries(problems)) {
    problemsOut[id] = Array.from(companies).sort();
  }

  const output = {
    problems: problemsOut,
    companyNames: companySlugToName,
  };

  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`\nDone. Processed ${fetched}/${csvFiles.length} files.`);
  console.log(`Mapped ${Object.keys(problemsOut).length} problems to companies.`);
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the script locally to verify it works**

Run:
```bash
cd /home/akincodes/Development/Leetcode\ ELO/Leetcode-ELO
node scripts/fetch_companies.js
```

Expected: exits with "Done." and creates `frontend/public/companies.json`. The file should have `problems` and `companyNames` keys.

- [ ] **Step 3: Commit**

```bash
git add scripts/fetch_companies.js
git commit -m "feat: add script to fetch company tags from CodeJeet dataset"
```

---

### Task 2: Update GitHub Actions workflow

**Files:**
- Modify: `.github/workflows/fetch-topics.yml`

- [ ] **Step 1: Add company fetch step to the workflow**

Insert after the "Fetch topics from LeetCode" step:

```yaml
      - name: Fetch company data from CodeJeet
        run: |
          node scripts/fetch_companies.js
        timeout-minutes: 30
```

Then add `frontend/public/companies.json` to the git add line:

```yaml
          git add -f ratings.txt frontend/public/tags.json frontend/public/tags.state.json frontend/public/companies.json
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/fetch-topics.yml
git commit -m "ci: fetch company tags weekly alongside topics"
```

---

### Task 3: Add `companyQuery` to URL state

**Files:**
- Modify: `frontend/src/lib/urlState.ts`

- [ ] **Step 1: Add `companyQuery` to FilterState type and defaults**

Add `companyQuery` to the `FilterState` type:

```typescript
export type FilterState = {
  query: string;
  idQuery: string;
  categoryQuery: string;
  companyQuery: string;
  minRating: number | "";
  maxRating: number | "";
  contestFilter: string;
  sortBy: "rating" | "id";
  desc: boolean;
  hideSolved: boolean;
};
```

Add `companyQuery: ""` to `DEFAULT_STATE`.

Add to `KEYS`:
```typescript
  companyQuery: "co",
```

Add to `readStateFromUrl`:
```typescript
  const co = params.get(KEYS.companyQuery);
  if (co !== null) out.companyQuery = co;
```

Add to `writeStateToUrl`:
```typescript
  if (state.companyQuery) params.set(KEYS.companyQuery, state.companyQuery);
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/urlState.ts
git commit -m "feat: add companyQuery to URL filter state"
```

---

### Task 4: Load `companies.json` in ProblemTable + add company filter + Companies column

**Files:**
- Modify: `frontend/src/components/ProblemTable.tsx`

This is the largest task. All the changes are in one file following the existing patterns.

- [ ] **Step 1: Add `companyQuery` state, load companies data, add to filtering**

Add `companyQuery` state alongside the existing filter states (around line 60):

```typescript
  const [companyQuery, setCompanyQuery] = useState(
    INITIAL_URL_STATE.companyQuery ?? DEFAULT_STATE.companyQuery
  );
```

Add a `companiesMap` state alongside `tagsMap` (after line 63):

```typescript
  const [companiesMap, setCompaniesMap] = useState<Record<string, string[]>>({});
```

Add a `companyNamesMap` state for display names:

```typescript
  const [companyNames, setCompanyNames] = useState<Record<string, string>>({});
```

Add URL state sync for `companyQuery` in the `writeStateToUrl` effect (around line 120):

```typescript
      companyQuery,
```

And in the URL state parameters:

```typescript
      companyQuery,
```

Add a new `React.useEffect` block (after the tags loading effect at line 199) to load `companies.json`:

```typescript
  // Load companies.json (same pattern as tags.json)
  React.useEffect(() => {
    (async () => {
      let remote = {};
      try {
        const res = await fetch('/companies.json', { cache: 'no-cache' });
        if (res.ok) remote = await res.json();
      } catch (e) {
        try {
          const res = await fetch(
            'https://raw.githubusercontent.com/AKforCodes/Leetcode-ELO/main/frontend/public/companies.json'
          );
          if (res.ok) remote = await res.json();
        } catch (e2) {}
      }

      if (remote && (remote as any).problems) {
        setCompaniesMap((remote as any).problems);
        setCompanyNames((remote as any).companyNames || {});
      }
    })();
  }, []);
```

Add `companyQuery` to the filter logic (around line 211). Add after the `categoryQuery` check:

```typescript
        // company filter
        if (companyQuery) {
          const companies = companiesMap[p.id] || [];
          const hay = companies
            .map((c) => (companyNames[c] || c).toLowerCase())
            .join(" ");
          if (!hay.includes(companyQuery.toLowerCase())) return false;
        }
```

Add `companyQuery`, `companiesMap`, `companyNames` to the filter dependencies array.

- [ ] **Step 2: Add company filter input in the search section**

Add a new input in the `search-inputs` div (after the topic filter at line 354):

```tsx
            <div className="input-wrap">
              <svg className="input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="2" width="20" height="20" rx="3" />
                <circle cx="8" cy="8" r="1.5" />
                <circle cx="16" cy="16" r="1.5" />
                <circle cx="16" cy="8" r="1.5" />
                <circle cx="8" cy="16" r="1.5" />
              </svg>
              <input
                placeholder="Company"
                value={companyQuery}
                onChange={(e) => setCompanyQuery(e.target.value)}
                list="company-list"
                aria-label="Search by company"
              />
              <datalist id="company-list">
                {Object.values(companyNames).map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
```

Add the keyboard shortcut for focusing the company input. Add a ref:

```typescript
  const companyInputRef = useRef<HTMLInputElement>(null);
```

Inside the `onKey` handler (after the `t` case at line 285):

```typescript
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        companyInputRef.current?.focus();
        companyInputRef.current?.select();
      }
```

Add `ref={companyInputRef}` to the company input.

- [ ] **Step 3: Add Companies column to the table header**

Insert after the Topics `<th>` (line 477):

```tsx
            <th>Companies</th>
```

- [ ] **Step 4: Add Companies column cell in the table body**

Insert after the Topics `<td>` (after line 515):

```tsx
              <td className="col-tags" data-label="Companies">
                <div className="company-chips">
                  {(companiesMap[p.id] || []).map((c) => (
                    <span className="company-chip" key={c}>
                      {companyNames[c] || c}
                    </span>
                  ))}
                </div>
              </td>
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ProblemTable.tsx
git commit -m "feat: add Companies column and company filter with autocomplete"
```

---

### Task 5: Verify everything works

- [ ] **Step 1: Run the lint/typecheck**

Check if the project has linting configured:

```bash
cd frontend
npm run lint 2>/dev/null || npm run typecheck 2>/dev/null || npx tsc --noEmit 2>/dev/null || echo "No lint/typecheck configured"
```

- [ ] **Step 2: Run any existing tests**

```bash
cd frontend
npx vitest run 2>/dev/null || echo "No test suite to run"
```

Expected: existing tests still pass (topic filter tests, etc.)

- [ ] **Step 3: Verify the app builds**

```bash
cd frontend
npm run build
```

Expected: build succeeds with no errors.
