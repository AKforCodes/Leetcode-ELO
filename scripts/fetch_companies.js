const fs = require("fs");
const path = require("path");
const https = require("https");

const root = path.join(__dirname, "..");
const ratingsPath = path.join(root, "ratings.txt");
const outDir = path.join(root, "frontend", "public");
const outPath = path.join(outDir, "companies.json");

const GITHUB_API_URL =
  "https://api.github.com/repos/ayush-that/codejeet/contents/data/companies";
const RAW_BASE =
  "https://raw.githubusercontent.com/ayush-that/codejeet/main/data/companies";
const CONCURRENCY = 20;
const BATCH_DELAY_MS = 100;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readProblemIds(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return new Set();
  const header = lines[0].split(/\t+/);
  const iId = header.indexOf("ID");
  const ids = new Set();
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(/\t+/);
    const id = (cols[iId] || "").trim();
    if (id) ids.add(id);
  }
  return ids;
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        { headers: { "User-Agent": "LeetCode-ELO/1.0" } },
        (res) => {
          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () => {
            if (res.statusCode < 200 || res.statusCode >= 300) {
              return reject(
                new Error(`HTTP ${res.statusCode} for ${url}`)
              );
            }
            resolve(data);
          });
        }
      )
      .on("error", reject);
  });
}

function slugToDisplayName(slug) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function fetchCompanyFilenames() {
  const json = await httpsGet(GITHUB_API_URL);
  const items = JSON.parse(json);
  return items
    .filter((item) => item.type === "file" && item.name.endsWith(".csv"))
    .map((item) => item.name);
}

async function fetchCSV(filename) {
  const url = `${RAW_BASE}/${filename}`;
  const text = await httpsGet(url);
  const slug = filename.replace(/\.csv$/i, "");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { slug, ids: [] };
  const header = lines[0].split(",");
  const iId = header.indexOf("ID");
  if (iId === -1) return { slug, ids: [] };
  const ids = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(",");
    const id = (cols[iId] || "").trim();
    if (id) ids.push(id);
  }
  return { slug, ids };
}

async function main() {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  console.log("Reading problem IDs from ratings.txt...");
  const trackedIds = readProblemIds(ratingsPath);
  console.log(`Found ${trackedIds.size} tracked problem IDs.`);

  console.log("Fetching company CSV list from CodeJeet...");
  let filenames;
  try {
    filenames = await fetchCompanyFilenames();
  } catch (e) {
    throw new Error(`Failed to fetch company file list: ${String(e)}`);
  }
  console.log(`Found ${filenames.length} company CSV files.`);

  const result = { slugs: [], idsBySlug: {} };
  let processed = 0;
  let failed = 0;

  for (let i = 0; i < filenames.length; i += CONCURRENCY) {
    const batch = filenames.slice(i, i + CONCURRENCY);
    const promises = batch.map((f) => fetchCSV(f));
    const outcomes = await Promise.allSettled(promises);

    for (const outcome of outcomes) {
      if (outcome.status === "fulfilled") {
        const { slug, ids } = outcome.value;
        if (ids.length > 0) {
          result.slugs.push(slug);
          result.idsBySlug[slug] = ids;
        }
        processed += 1;
      } else {
        failed += 1;
        process.stdout.write(
          `  warn: failed to fetch a CSV: ${String(outcome.reason)}\n`
        );
      }
    }

    if ((i + CONCURRENCY) % 100 === 0 || i + CONCURRENCY >= filenames.length) {
      process.stdout.write(
        `Progress: ${Math.min(i + CONCURRENCY, filenames.length)}/${filenames.length} files processed\n`
      );
    }

    await sleep(BATCH_DELAY_MS);
  }

  console.log(
    `\nFetched ${processed} CSVs${failed > 0 ? `, ${failed} failed` : ""}.`
  );

  // Invert: problemId -> sorted array of company slugs
  const problems = {};
  for (const slug of result.slugs) {
    const ids = result.idsBySlug[slug];
    for (const id of ids) {
      if (trackedIds.has(id)) {
        if (!problems[id]) problems[id] = [];
        problems[id].push(slug);
      }
    }
  }

  // Deduplicate and sort company slugs per problem
  for (const id of Object.keys(problems)) {
    problems[id] = [...new Set(problems[id])].sort();
  }

  // Build company name map
  const companyNames = {};
  for (const slug of Object.keys(result.idsBySlug)) {
    companyNames[slug] = slugToDisplayName(slug);
  }

  const output = { problems, companyNames };
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

  const totalCompanies = Object.keys(companyNames).length;
  const totalProblems = Object.keys(problems).length;
  const totalLinks = Object.values(problems).reduce(
    (sum, arr) => sum + arr.length,
    0
  );

  console.log(`\nDone. Summary:`);
  console.log(`  Companies tracked: ${totalCompanies}`);
  console.log(`  Problems with company tags: ${totalProblems}`);
  console.log(`  Total problem-company links: ${totalLinks}`);
  console.log(`  Failed files: ${failed}`);
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
