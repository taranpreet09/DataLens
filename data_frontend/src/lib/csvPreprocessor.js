// ─── DataLens — CSV Pre-processor ──────────────────────────────────────────────
// Runs on raw CSV text BEFORE parsing.
// Fixes structural issues like unquoted commas in numeric/compound values
// that would cause column shifting after parsing.

// ─── Step 1: Robust CSV Line Parser ────────────────────────────────────────────
// Parses a single CSV line respecting quoted fields.

export function parseCSVLine(line) {
  const fields = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote inside quoted field
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

// ─── Step 2: Re-serialize fields back into a CSV line ──────────────────────────

function serializeCSVLine(fields) {
  return fields.map(f => {
    const s = String(f);
    // Quote if contains comma, quote, or newline
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }).join(',');
}

// ─── Step 3: Heuristic merge — can two adjacent fields be one number? ──────────
// Handles these real-world patterns:
//   "4" + "500"    → 4500   (e.g., 4,500 weight was unquoted)
//   "1" + "200kg"  → 1200kg (e.g., 1,200kg unit was unquoted)
//   "95" + "000"   → 95000  (e.g., $95,000 currency was unquoted)
//   "1" + "500.50" → 1500.50

function canMergeAsNumber(a, b) {
  const sa = String(a).trim();
  const sb = String(b).trim();

  // a must look like a short integer prefix (1-4 digits, no unit)
  if (!/^\d{1,4}$/.test(sa)) return false;

  // b must be 3 digits (thousands), 3 digits + suffix, or 2 digits (might be cents)
  const isThousands = /^\d{3}$/.test(sb);
  const isThousandsWithUnit = /^\d{3}[a-zA-Z%]+$/.test(sb);
  const isThousandsWithDecimal = /^\d{3}\.\d+$/.test(sb);

  if (!isThousands && !isThousandsWithUnit && !isThousandsWithDecimal) return false;

  // Final sanity: merged value must be numeric (ignoring unit)
  const merged = sa + sb.replace(/[a-zA-Z%]+$/, '');
  return !isNaN(Number(merged));
}

function mergeFields(a, b) {
  return String(a).trim() + String(b).trim();
}

// ─── Step 4: Try all possible single-pair merges; pick best by scoring ─────────
// "best" = the merge that reduces field count to target AND
//           makes the most fields match their expected types.

function scoreFieldsAgainstTypes(fields, expectedTypes) {
  let score = 0;
  const len = Math.min(fields.length, expectedTypes.length);
  for (let i = 0; i < len; i++) {
    if (typeMatchesValue(expectedTypes[i], fields[i])) score++;
  }
  // Penalize if we still have too many fields
  if (fields.length > expectedTypes.length) score -= (fields.length - expectedTypes.length) * 2;
  return score;
}

function typeMatchesValue(type, val) {
  if (val === null || val === undefined || val === '') return true; // empty is ok
  const s = String(val).trim().toLowerCase();

  const NULL_SET = new Set(['n/a', 'na', 'null', 'none', '-', '--', 'missing', 'undefined', 'nan']);
  if (NULL_SET.has(s)) return true; // Null-ish — acceptable in any column

  switch (type) {
    case 'numeric':
    case 'id': {
      // Numeric: could have currency prefix — strip and check
      const stripped = s.replace(/[$€£¥₹,\s%()]/g, '');
      return !isNaN(Number(stripped)) && stripped !== '';
    }
    case 'date': {
      return /\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{1,4}/.test(s) ||
             /[a-z]+ \d{1,2}[\s,]+\d{4}/.test(s) ||
             (!isNaN(new Date(val).getTime()) && isNaN(Number(val)));
    }
    case 'categorical':
    case 'text':
    default: {
      // Text/categorical should ideally NOT be a plain number
      // but we don't penalize hard — text accepts anything
      return true;
    }
  }
}

// ─── Step 5: Intelligently realign a row that has extra fields ─────────────────

function realignRow(fields, expectedTypes) {
  const target = expectedTypes.length;

  if (fields.length <= target) return fields; // Nothing to do

  const extra = fields.length - target;

  // Try all adjacent pair merges, up to 'extra' merges needed
  // Use BFS/greedy: at each step try all possible single merges, pick best
  let current = [...fields];

  for (let step = 0; step < extra; step++) {
    let bestResult = null;
    let bestScore = -Infinity;

    for (let i = 0; i < current.length - 1; i++) {
      // Try merging fields[i] and fields[i+1]
      const candidate = [...current];
      candidate.splice(i, 2, mergeFields(current[i], current[i + 1]));

      const score = scoreFieldsAgainstTypes(candidate, expectedTypes);

      // Strongly prefer merges that look like split numbers
      const bonusIfNumericMerge = canMergeAsNumber(current[i], current[i + 1]) ? 3 : 0;

      if (score + bonusIfNumericMerge > bestScore) {
        bestScore = score + bonusIfNumericMerge;
        bestResult = candidate;
      }
    }

    if (bestResult) {
      current = bestResult;
    } else {
      break; // Can't improve
    }
  }

  // Trim to target length (drop overflow if we still couldn't reduce)
  return current.slice(0, target);
}

// ─── Step 6: Infer expected column types from the first N data rows ────────────
// This is a lightweight heuristic — full detection happens in statsEngine.

function inferColumnTypes(dataLines, headers) {
  const SAMPLE = Math.min(dataLines.length, 30);
  const typeCounts = headers.map(() => ({ numeric: 0, date: 0, text: 0, total: 0 }));

  for (let i = 0; i < SAMPLE; i++) {
    const line = dataLines[i];
    // Only analyze lines with correct field count (not shifted ones)
    const fields = parseCSVLine(line);
    if (fields.length !== headers.length) continue;

    fields.forEach((raw, idx) => {
      const s = raw.replace(/^"|"$/g, '').trim();
      typeCounts[idx].total++;

      const stripped = s.replace(/[$€£¥₹,\s%()]/g, '');
      if (stripped !== '' && !isNaN(Number(stripped))) {
        typeCounts[idx].numeric++;
      } else if (
        /\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{1,4}/.test(s) ||
        /[a-zA-Z]+ \d{1,2}[\s,]+\d{4}/.test(s)
      ) {
        typeCounts[idx].date++;
      } else {
        typeCounts[idx].text++;
      }
    });
  }

  return headers.map((_, i) => {
    const c = typeCounts[i];
    if (c.total === 0) return 'text';
    const numRatio = c.numeric / c.total;
    const dateRatio = c.date / c.total;
    if (dateRatio > 0.4) return 'date';
    if (numRatio > 0.4) return 'numeric';
    return 'text';
  });
}

// ─── Main Export: Preprocess raw CSV text ──────────────────────────────────────
// Returns fixed CSV text with structural misalignment corrected.

export function preprocessCSV(rawText) {
  const lines = rawText.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length < 2) return rawText;

  // Parse header
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map(h => h.replace(/^"|"$/g, '').trim());
  const targetFieldCount = headers.length;

  // Infer expected types from "clean" rows to help the re-alignment scorer
  const dataLines = lines.slice(1);
  const expectedTypes = inferColumnTypes(dataLines, headers);

  let fixedCount = 0;

  const fixedLines = [headerLine];
  for (const line of dataLines) {
    const fields = parseCSVLine(line);

    if (fields.length === targetFieldCount) {
      // Row is correctly aligned — pass through unchanged
      fixedLines.push(line);
    } else if (fields.length > targetFieldCount) {
      // Row has extra fields — try to realign
      const realigned = realignRow(fields, expectedTypes);
      fixedLines.push(serializeCSVLine(realigned));
      fixedCount++;
    } else {
      // Row has fewer fields than expected — pad with empty
      const padded = [...fields];
      while (padded.length < targetFieldCount) padded.push('');
      fixedLines.push(serializeCSVLine(padded));
    }
  }

  if (fixedCount > 0) {
    console.log(`[DataLens CSV Pre-processor] Fixed ${fixedCount} structurally misaligned rows.`);
  }

  return fixedLines.join('\n');
}
