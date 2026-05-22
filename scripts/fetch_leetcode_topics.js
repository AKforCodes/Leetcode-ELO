/*
Fetch topic tags for LeetCode problems using public GraphQL endpoint.
Outputs frontend/public/tags.json keyed by problem ID (string) with array of topics.

Usage examples:
  node scripts/fetch_leetcode_topics.js
  node scripts/fetch_leetcode_topics.js --limit=100
  node scripts/fetch_leetcode_topics.js --delay=300 --resume
*/

const fs = require("fs");
const path = require("path");
const https = require("https");

const root = path.join(__dirname, "..");
const ratingsPath = path.join(root, "ratings.txt");
const outDir = path.join(root, "frontend", "public");
const outPath = path.join(outDir, "tags.json");
const statePath = path.join(outDir, "tags.state.json");
const GITHUB_RATINGS_URL =
  "https://raw.githubusercontent.com/zerotrac/leetcode_problem_rating/main/ratings.txt";

function parseArg(name, fallback) {
  const p = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!p) return fallback;
  const v = p.split("=").slice(1).join("=");
  return v || fallback;
}

const limit = Number(parseArg("limit", "0"));
const delayMs = Number(parseArg("delay", "180"));
const retries = Number(parseArg("retries", "3"));
const resume = process.argv.includes("--resume");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readRatings(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const header = lines[0].split(/\t+/);
  const iId = header.indexOf("ID");
  const iSlug = header.indexOf("Title Slug");
  const iTitle = header.indexOf("Title");

  return lines.slice(1).map((line) => {
    const cols = line.split(/\t+/);
    return {
      id: String(cols[iId] || "").trim(),
      slug: String(cols[iSlug] || "").trim(),
      title: String(cols[iTitle] || "").trim()
    };
  }).filter((r) => r.id && r.slug);
}

function postGraphQL(slug) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      query:
        "query questionData($titleSlug: String!) { question(titleSlug: $titleSlug) { titleSlug topicTags { name slug } } }",
      variables: { titleSlug: slug }
    });

    const req = https.request(
      {
        hostname: "leetcode.com",
        path: "/graphql",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent": "Mozilla/5.0"
        },
        timeout: 15000
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          }
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Bad JSON for ${slug}: ${String(e)}`));
          }
        });
      }
    );

    req.on("timeout", () => req.destroy(new Error("Request timeout")));
    req.on("error", (err) => reject(err));
    req.write(body);
    req.end();
  });
}

function fetchRatingsFromGitHub() {
  return new Promise((resolve, reject) => {
    https.get(GITHUB_RATINGS_URL, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`Failed to fetch from GitHub: HTTP ${res.statusCode}`));
        }
        try {
          resolve(data);
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });
}

async function fetchTagsForSlug(slug) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const payload = await postGraphQL(slug);
      const tags = payload?.data?.question?.topicTags || [];
      return tags.map((t) => t.name).filter(Boolean);
    } catch (e) {
      if (attempt === retries) throw e;
      await sleep(delayMs * attempt);
    }
  }
  return [];
}

async function main() {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // Fetch ratings from GitHub
  console.log("Fetching ratings.txt from GitHub...");
  let ratingsText;
  try {
    ratingsText = await fetchRatingsFromGitHub();
  } catch (e) {
    throw new Error(`Failed to fetch from GitHub: ${String(e)}`);
  }

  // Parse ratings
  const lines = ratingsText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error("No data in ratings.txt");
  const header = lines[0].split(/\t+/);
  const iId = header.indexOf("ID");
  const iSlug = header.indexOf("Title Slug");
  const iTitle = header.indexOf("Title");

  const rows = lines.slice(1).map((line) => {
    const cols = line.split(/\t+/);
    return {
      id: String(cols[iId] || "").trim(),
      slug: String(cols[iSlug] || "").trim(),
      title: String(cols[iTitle] || "").trim()
    };
  }).filter((r) => r.id && r.slug);

  const input = limit > 0 ? rows.slice(0, limit) : rows;

  let tagsById = {};
  let doneSlugs = {};
  let failedSlugs = {};

  if (resume && fs.existsSync(outPath)) {
    tagsById = JSON.parse(fs.readFileSync(outPath, "utf8"));
  }
  if (resume && fs.existsSync(statePath)) {
    doneSlugs = JSON.parse(fs.readFileSync(statePath, "utf8"));
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < input.length; i += 1) {
    const row = input[i];
    // Skip only if previously marked done AND we have real tags. Empty tag
    // results (LC hasn't categorized the problem yet) stay pending so the
    // next run retries them.
    if (doneSlugs[row.slug] && (tagsById[row.id] || []).length > 0) continue;

    process.stdout.write(`[${i + 1}/${input.length}] ${row.id} ${row.slug} ... `);
    try {
      const tags = await fetchTagsForSlug(row.slug);
      tagsById[row.id] = tags;
      if (tags.length > 0) {
        doneSlugs[row.slug] = true;
      }
      success += 1;
      process.stdout.write(`ok (${tags.length} tags)${tags.length === 0 ? " — empty, will retry next run" : ""}\n`);
    } catch (e) {
      failed += 1;
      process.stdout.write(`failed: ${String(e.message || e)}\n`);
    }

    if ((i + 1) % 25 === 0) {
      fs.writeFileSync(outPath, JSON.stringify(tagsById, null, 2), "utf8");
      fs.writeFileSync(statePath, JSON.stringify(doneSlugs, null, 2), "utf8");
    }

    await sleep(delayMs);
  }

  fs.writeFileSync(outPath, JSON.stringify(tagsById, null, 2), "utf8");
  fs.writeFileSync(statePath, JSON.stringify(doneSlugs, null, 2), "utf8");

  // Check for problems with empty tags and log them
  const emptyTags = Object.entries(tagsById).filter(([id, tags]) => tags.length === 0);
  if (emptyTags.length > 0) {
    console.log(`\nWarning: ${emptyTags.length} problems have empty tags (not yet categorized on LeetCode):`);
    emptyTags.slice(0, 10).forEach(([id]) => {
      const prob = input.find((p) => p.id === id);
      console.log(`  - ID ${id}: ${prob?.slug || "unknown"}`);
    });
    if (emptyTags.length > 10) console.log(`  ... and ${emptyTags.length - 10} more`);
  }

  console.log(`\nDone. Fetched from GitHub. success=${success}, failed=${failed}`);
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
