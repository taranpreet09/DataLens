// ─── DataLens — CSV Export Utility ──────────────────────────────────────────────
// Exports cleaned/filtered dataset rows back to a downloadable CSV file.

function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  // Escape if it contains comma, quote, or newline
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Converts headers + rows to a CSV string.
 * @param {string[]} headers
 * @param {object[]} rows
 * @returns {string}
 */
export function toCSVString(headers, rows) {
  const headerLine = headers.map(escapeCSV).join(',');
  const dataLines = rows.map(row =>
    headers.map(h => escapeCSV(row[h])).join(',')
  );
  return [headerLine, ...dataLines].join('\n');
}

/**
 * Triggers a CSV file download in the browser.
 * @param {string[]} headers
 * @param {object[]} rows
 * @param {string} filename
 */
export function downloadCSV(headers, rows, filename = 'DataLens-Export.csv') {
  const csvContent = toCSVString(headers, rows);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}
