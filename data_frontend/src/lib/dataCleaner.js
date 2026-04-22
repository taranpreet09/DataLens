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

// Regex to detect a "dirty numeric" string regardless of detected column type
// Matches things like: $95,000 | €1.234,56 | (500) | 1,200.50 | 45% | ₹8,000
const DIRTY_NUMERIC_RE = /^[($€£¥₹\s]*[\d][\d,.\s]*[)%]?$|^[($€£¥₹][,.\d\s]+$/;

// ─── Currency / Number Cleaning ────────────────────────────────────────────────

function cleanNumericValue(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;

  let s = String(val).trim();

  if (NULL_STRINGS.has(s)) return null;
  if (s === '') return null;

  const isPct = s.endsWith('%');
  if (isPct) s = s.slice(0, -1);

  // Accounting-style negatives: (500) → -500
  const isNegParens = /^\([\d,.\\s$€£¥₹]+\)$/.test(s);
  if (isNegParens) s = s.replace(/[()]/g, '');

  // Strip currency symbols and whitespace
  s = s.replace(/[$€£¥₹\s]/g, '');

  // European format: 1.234,56 → 1234.56
  if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // Standard: remove commas as thousands separators
    s = s.replace(/,/g, '');
  }

  const num = Number(s);
  if (isNaN(num)) return null;

  let result = isPct ? num / 100 : num;
  if (isNegParens) result = -Math.abs(result);
  return result;
}

// ─── Date Cleaning ─────────────────────────────────────────────────────────────

function cleanDateValue(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return null;

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

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const ddmmyyyy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (ddmmyyyy) {
    const [, a, b, year] = ddmmyyyy;
    const day = parseInt(a), month = parseInt(b);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // YYYY/MM/DD
  const yyyymmdd = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (yyyymmdd) {
    const [, year, month, day] = yyyymmdd;
    if (parseInt(month) >= 1 && parseInt(month) <= 12) {
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }

  // Month Name formats: "March 5 2022", "5 March 2022", "Mar 5, 2022"
  const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  const monthShort = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

  const namedDate = s.match(/^([a-zA-Z]+)\s+(\d{1,2})[,\s]+(\d{4})$/) ||
                    s.match(/^(\d{1,2})\s+([a-zA-Z]+)[,\s]+(\d{4})$/);
  if (namedDate) {
    let monthStr, day, year;
    // "March 5 2022" format
    const m1 = s.match(/^([a-zA-Z]+)\s+(\d{1,2})[,\s]+(\d{4})$/);
    if (m1) { [, monthStr, day, year] = m1; }
    // "5 March 2022" format
    const m2 = s.match(/^(\d{1,2})\s+([a-zA-Z]+)[,\s]+(\d{4})$/);
    if (m2) { [, day, monthStr, year] = m2; }

    if (monthStr) {
      const ml = monthStr.toLowerCase();
      let monthIdx = monthNames.findIndex(m => m.startsWith(ml.slice(0, 3)));
      if (monthIdx === -1) monthIdx = monthShort.indexOf(ml.slice(0, 3));
      if (monthIdx !== -1) {
        const m = String(monthIdx + 1).padStart(2, '0');
        const d2 = String(parseInt(day)).padStart(2, '0');
        return `${year}-${m}-${d2}`;
      }
    }
  }

  return null;
}

// ─── General null standardization ──────────────────────────────────────────────

function cleanGeneralValue(val) {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (NULL_STRINGS.has(s) || s === '') return null;
  return s;
}

// ─── Detect if a string VALUE looks like a dirty numeric, regardless of column type ──
// This addresses the case where type detection misclassifies a column

function looksLikeDirtyNumeric(val) {
  if (typeof val !== 'string') return false;
  const s = val.trim();
  if (NULL_STRINGS.has(s) || s === '') return false;
  return /[$€£¥₹]/.test(s) && /[\d]/.test(s);
}

function looksLikeDirtyDate(val) {
  if (typeof val !== 'string') return false;
  const s = val.trim();
  if (NULL_STRINGS.has(s) || s === '') return false;
  // Matches DD/MM/YYYY, YYYY/MM/DD, "March 5 2022", "11-01-2019"
  return /^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}$/.test(s) ||
         /^\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}$/.test(s) ||
         /^[a-zA-Z]+ \d{1,2}[, ]+\d{4}$/.test(s) ||
         /^\d{1,2} [a-zA-Z]+[, ]+\d{4}$/.test(s);
}

// ─── Main Cleansing Function ───────────────────────────────────────────────────

export function cleanseDataset(headers, rows, columnTypes) {
  const report = {
    totalChanges: 0,
    nullsStandardized: 0,
    numericsCleaned: 0,
    datesCleaned: 0,
    columnReports: {},
  };

  // ── Per-column override: if a column is flagged as text/categorical but has
  //    currency symbols or dirty dates in >20% of values, upgrade it so the
  //    cleaner actually fixes those values.
  const effectiveTypes = { ...columnTypes };

  for (const h of headers) {
    const sampleVals = rows.slice(0, 200).map(r => r[h]).filter(v => v !== null && v !== '');
    if (sampleVals.length === 0) continue;

    const currencyCount = sampleVals.filter(v => looksLikeDirtyNumeric(v)).length;
    if (currencyCount / sampleVals.length > 0.2 && effectiveTypes[h] !== 'numeric') {
      effectiveTypes[h] = 'numeric'; // upgrade to numeric so we strip currency
    }
  }

  const cleanedRows = rows.map(row => {
    const newRow = { ...row };

    for (const h of headers) {
      const type = effectiveTypes[h];
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
        // For text/categorical: still try to fix null-ish strings
        // AND opportunistically fix any currency values that slipped through type detection
        const s = original !== null ? String(original).trim() : null;
        if (s !== null && looksLikeDirtyNumeric(s)) {
          const numAttempt = cleanNumericValue(s);
          cleaned = numAttempt !== null ? numAttempt : cleanGeneralValue(original);
          if (cleaned !== original && typeof cleaned === 'number') report.numericsCleaned++;
        } else if (s !== null && (columnTypes[h] === 'text' || columnTypes[h] === 'categorical') && looksLikeDirtyDate(s)) {
          const dateAttempt = cleanDateValue(s);
          cleaned = dateAttempt !== null ? dateAttempt : cleanGeneralValue(original);
          if (cleaned !== original && cleaned !== null) report.datesCleaned++;
        } else {
          cleaned = cleanGeneralValue(original);
        }
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
    const sample = rows.slice(0, 500);

    for (const row of sample) {
      const val = row[h];
      if (val === null || val === undefined || val === '') continue;

      const s = String(val).trim();

      if (NULL_STRINGS.has(s)) {
        dirtyCount++;
        if (samples.length < 3) samples.push(s);
        continue;
      }

      // Currency symbols are dirty regardless of column type
      if (looksLikeDirtyNumeric(s)) {
        dirtyCount++;
        if (samples.length < 3) samples.push(s);
        continue;
      }

      if (type === 'numeric' || type === 'id') {
        if (typeof val === 'string') {
          if (/[€£¥₹,()%]/.test(s) || /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
            dirtyCount++;
            if (samples.length < 3) samples.push(s);
          }
        }
      } else if (type === 'date') {
        if (typeof val === 'string') {
          const d = new Date(s);
          if (isNaN(d.getTime())) {
            dirtyCount++;
            if (samples.length < 3) samples.push(s);
          }
        }
      }
    }

    if (dirtyCount > 0) {
      dirty.push({
        column: h,
        type,
        dirtyCount,
        pct: Math.round((dirtyCount / sample.length) * 100),
        samples,
      });
    }
  }

  return dirty;
}
