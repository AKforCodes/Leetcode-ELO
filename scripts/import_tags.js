// Node script: read ELO_NeetCode_Categories.xlsx and emit frontend/public/tags.json
// Usage: from repo root after installing dependencies in frontend:
//   cd frontend && npm install && node ../scripts/import_tags.js

const fs = require('fs');
const path = require('path');
let xlsx;
try {
  xlsx = require('xlsx');
} catch (e) {
  console.error('Missing dependency "xlsx". Run `npm install xlsx` in the frontend folder.');
  process.exit(1);
}

const workbookPath = path.join(__dirname, '..', 'ELO_NeetCode_Categories.xlsx');
if (!fs.existsSync(workbookPath)) {
  console.error('Excel file not found at', workbookPath);
  process.exit(1);
}

const wb = xlsx.readFile(workbookPath);
const sheetName = wb.SheetNames[0];
const sheet = wb.Sheets[sheetName];
const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

// Try to detect columns
const possibleIdCols = ['ID','Problem ID','LeetCode ID','id'];
const possibleSlugCols = ['Title Slug','slug','Slug','title_slug'];
const possibleTitleCols = ['Title','title','Problem','Problem Title'];
const possibleTagCols = ['Topics','Tags','Category','Categories','topics','tags','categories'];

function findCol(keys, candidates) {
  for (const c of candidates) if (keys.includes(c)) return c;
  return null;
}

const keys = rows.length ? Object.keys(rows[0]) : [];
const idCol = findCol(keys, possibleIdCols);
const slugCol = findCol(keys, possibleSlugCols);
const titleCol = findCol(keys, possibleTitleCols);
const tagCol = findCol(keys, possibleTagCols);

if (!tagCol) {
  console.error('Could not find a Tags/Topics column. Found columns:', keys.join(', '));
  // still continue, but output empty
}

const mapping = {};
for (const r of rows) {
  const tagsRaw = tagCol ? String(r[tagCol] || '') : '';
  const tags = tagsRaw
    .split(/[;,|\/]+/) // split on common separators
    .map(s => s.trim())
    .filter(Boolean);

  // prefer ID, then slug, then title as key
  let key = '';
  if (idCol && r[idCol] !== undefined && r[idCol] !== '') key = String(r[idCol]);
  else if (slugCol && r[slugCol]) key = String(r[slugCol]);
  else if (titleCol && r[titleCol]) key = String(r[titleCol]);
  if (!key) continue;
  mapping[key] = tags;
}

const outDir = path.join(__dirname, '..', 'frontend', 'public');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'tags.json');
fs.writeFileSync(outPath, JSON.stringify(mapping, null, 2), 'utf8');
console.log('Wrote', outPath, 'with', Object.keys(mapping).length, 'entries');
