// ─── DataLens — Smart Data Cleansing Engine ────────────────────────────────────
// Pure utility module. Zero React dependencies.
// Provides 1-click data standardization for messy CSV/Excel imports.

// Strings that should be treated as null/missing
const NULL_STRINGS = new Set([
  'n/a', 'na', 'N/A', 'NA', 'null', 'NULL', 'none', 'None', 'NONE',
  '-', '--', '---', '.', '..', 'missing', 'MISSING', 'undefined',
  '#N/A', '#NA', '#REF!', '#VALUE!', '#DIV/0!', '#NULL!', '#NAME?',
  'NaN', 'nan', 'inf', '-inf',
]);

// ─── Currency / Number Cleaning ────────────────────────────────────────────────
// Strips $, €, £, ¥, ₹ and thousands separators to recover numeric values
// e.g. "$1,234.56" → 1234.56, "€ 2.345,67" → 2345.67, "(500)" → -500

function cleanNumericValue(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;

  let s = String(val).trim();

  // Check null-ish strings first
  if (NULL_STRINGS.has(s)) return null;
  if (s === '') return null;

  // Check for percentage
  const isPct = s.endsWith('%');
  if (isPct) s = s.slice(0, -1);

  // Check for accounting-style negatives: (500) → -500
  const isNegParens = /^\([\d,.\s$€£¥₹]+\)$/.test(s);
  if (isNegParens) s = s.replace(/[()]/g, '');

  // Strip currency symbols and whitespace
  s = s.replace(/[$€£¥₹\s]/g, '');

  // Handle European format: 1.234,56 → 1234.56
  // Detect: has both . and , where , appears after .
  if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // Standard: remove commas as thousands separators
    s = s.replace(/,/g, '');
  }

  const num = Number(s);
  if (isNaN(num)) return null; // couldn't parse

  let result = isPct ? num / 100 : num;
  if (isNegParens) result = -Math.abs(result);
  return result;
}

// ─── Date Cleaning ─────────────────────────────────────────────────────────────
// Standardizes mixed date formats to ISO YYYY-MM-DD

function cleanDateValue(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return null; // Excel serial numbers ignored for now

  const s = String(val).trim();
  if (NULL_STRINGS.has(s) || s === '') return null;

  // Try native parse first
  const d = new Date(s);
  if (!isNaN(d.getTime()) && isNaN(Number(s))) {
    const year = d.getFullYear();
    if (year > 1900 && year < 2100) {
      return `${year}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  }

  // Try DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (ddmmyyyy) {
    const [, a, b, year] = ddmmyyyy;
    const day = parseInt(a), month = parseInt(b);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null; // couldn't parse
}

// ─── General null standardization ──────────────────────────────────────────────

function cleanGeneralValue(val) {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (NULL_STRINGS.has(s) || s === '') return null;
  return s;
}

// ─── Main Cleansing Function ───────────────────────────────────────────────────
// Takes headers, rows, and columnTypes, returns cleaned rows + a report of changes

export function cleanseDataset(headers, rows, columnTypes) {
  const report = {
    totalChanges: 0,
    nullsStandardized: 0,
    numericsCleaned: 0,
    datesCleaned: 0,
    columnReports: {},
  };

  const cleanedRows = rows.map(row => {
    const newRow = { ...row };

    for (const h of headers) {
      const type = columnTypes[h];
      const original = row[h];
      let cleaned;

      if (type === 'numeric' || type === 'id') {
        cleaned = cleanNumericValue(original);
        if (cleaned !== original && cleaned !== null && original !== null) {
          report.numericsCleaned++;
        }
      } else if (type === 'date') {
        cleaned = cleanDateValue(original);
        if (cleaned !== original && cleaned !== null && original !== null) {
          report.datesCleaned++;
        }
      } else {
        cleaned = cleanGeneralValue(original);
      }

      // Track null standardization
      if (cleaned === null && original !== null && original !== '') {
        const origStr = String(original).trim();
        if (NULL_STRINGS.has(origStr)) {
          report.nullsStandardized++;
        }
      }

      if (cleaned !== original) {
        report.totalChanges++;
        if (!report.columnReports[h]) report.columnReports[h] = { changed: 0, samples: [] };
        report.columnReports[h].changed++;
        if (report.columnReports[h].samples.length < 3) {
          report.columnReports[h].samples.push({
            from: original === null ? 'null' : String(original),
            to: cleaned === null ? 'null' : String(cleaned),
          });
        }
      }

      newRow[h] = cleaned;
    }

    return newRow;
  });

  return { cleanedRows, report };
}

// ─── Detect dirty columns (for UI preview before cleaning) ─────────────────────

export function detectDirtyColumns(headers, rows, columnTypes) {
  const dirty = [];

  for (const h of headers) {
    const type = columnTypes[h];
    let dirtyCount = 0;
    const samples = [];

    for (let i = 0; i < Math.min(rows.length, 500); i++) {
      const val = rows[i][h];
      if (val === null || val === undefined || val === '') continue;

      if (type === 'numeric' || type === 'id') {
        if (typeof val === 'string') {
          const s = String(val).trim();
          if (NULL_STRINGS.has(s)) {
            dirtyCount++;
            if (samples.length < 3) samples.push(s);
          } else if (/[$€£¥₹,()%]/.test(s) || /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
            dirtyCount++;
            if (samples.length < 3) samples.push(s);
          }
        }
      } else if (type === 'date') {
        if (typeof val === 'string') {
          const s = String(val).trim();
          if (NULL_STRINGS.has(s)) {
            dirtyCount++;
          } else {
            const d = new Date(s);
            if (isNaN(d.getTime())) {
              dirtyCount++;
              if (samples.length < 3) samples.push(s);
            }
          }
        }
      } else {
        // Text/categorical — check for N/A type strings
        if (typeof val === 'string' && NULL_STRINGS.has(String(val).trim())) {
          dirtyCount++;
          if (samples.length < 3) samples.push(String(val).trim());
        }
      }
    }

    if (dirtyCount > 0) {
      dirty.push({
        column: h,
        type,
        dirtyCount,
        pct: Math.round((dirtyCount / Math.min(rows.length, 500)) * 100),
        samples,
      });
    }
  }

  return dirty;
}
