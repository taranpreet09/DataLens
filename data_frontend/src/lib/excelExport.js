/**
 * Excel Export with Multiple Sheets (#40)
 * Uses SheetJS (xlsx) loaded from CDN to generate .xlsx files client-side.
 */

let XLSX = null;

async function loadXLSX() {
  if (XLSX) return XLSX;
  try {
    XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs');
    return XLSX;
  } catch (err) {
    throw new Error('Failed to load Excel library. Check your internet connection.');
  }
}

/**
 * Generate and download an Excel workbook with multiple sheets.
 * @param {Object} exportData - Response from collaborationApi.exportExcel()
 *   { filename: string, sheets: [{ name, headers, rows }] }
 */
export async function downloadExcel(exportData) {
  const xlsx = await loadXLSX();

  const wb = xlsx.utils.book_new();

  for (const sheet of exportData.sheets) {
    // Build array-of-arrays: headers + data rows
    const aoa = [sheet.headers, ...sheet.rows];
    const ws = xlsx.utils.aoa_to_sheet(aoa);

    // Auto-size columns (approximate)
    const colWidths = sheet.headers.map((h, i) => {
      let maxLen = h.length;
      for (const row of sheet.rows.slice(0, 100)) {
        const cellLen = String(row[i] ?? '').length;
        if (cellLen > maxLen) maxLen = cellLen;
      }
      return { wch: Math.min(maxLen + 2, 40) };
    });
    ws['!cols'] = colWidths;

    xlsx.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31)); // Sheet name max 31 chars
  }

  // Generate and download
  const wbout = xlsx.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = exportData.filename || 'export.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate Excel from local dataset data (no backend call needed).
 * Useful for quick exports without server round-trip.
 * @param {Object} dataset - The dataset object from DatasetContext
 * @param {Object} options - { includeStats, includeQuality, includeCorrelations }
 */
export async function exportDatasetToExcel(dataset, options = {}) {
  const xlsx = await loadXLSX();
  const { includeStats = true, includeQuality = true, includeCorrelations = true } = options;

  const wb = xlsx.utils.book_new();
  const stats = dataset.stats;

  // Sheet 1: Raw Data
  if (dataset.rows?.length && dataset.headers?.length) {
    const dataAoa = [
      dataset.headers,
      ...dataset.rows.map(r => dataset.headers.map(h => r[h] ?? '')),
    ];
    const ws = xlsx.utils.aoa_to_sheet(dataAoa);
    ws['!cols'] = dataset.headers.map(h => ({ wch: Math.min(h.length + 5, 30) }));
    xlsx.utils.book_append_sheet(wb, ws, 'Data');
  }

  // Sheet 2: Statistics
  if (includeStats && stats?.numericColumns?.length) {
    const statHeaders = ['Column', 'Count', 'Mean', 'Median', 'Min', 'Max', 'StdDev', 'Variance', 'Skewness', 'IQR', 'CV%'];
    const statRows = stats.numericColumns.map(col => {
      const s = stats.numericStats?.[col];
      if (!s) return [col];
      return [col, s.count, s.mean, s.median, s.min, s.max, s.stdDev, s.variance, s.skewness, s.iqr, s.cv];
    });
    const ws = xlsx.utils.aoa_to_sheet([statHeaders, ...statRows]);
    ws['!cols'] = statHeaders.map(h => ({ wch: Math.max(h.length + 2, 12) }));
    xlsx.utils.book_append_sheet(wb, ws, 'Statistics');
  }

  // Sheet 3: Quality
  if (includeQuality && stats?.qualityFlags) {
    const qf = stats.qualityFlags;
    const qualityData = [
      ['Metric', 'Value'],
      ['Total Rows', dataset.rowCount],
      ['Duplicate Rows', qf.duplicateRowCount],
      ['Duplicate %', qf.duplicatePct],
      ['Total Null Cells', qf.totalNullCount],
      ['Null %', qf.nullPct],
      ['Empty Rows', qf.emptyRowCount],
      ['Quality Score', stats.qualityScore],
    ];
    const ws = xlsx.utils.aoa_to_sheet(qualityData);
    ws['!cols'] = [{ wch: 20 }, { wch: 15 }];
    xlsx.utils.book_append_sheet(wb, ws, 'Quality');
  }

  // Sheet 4: Correlations
  if (includeCorrelations && stats?.correlationMatrix && stats.numericColumns?.length > 1) {
    const cols = stats.numericColumns;
    const corrData = [
      ['', ...cols],
      ...cols.map((col, i) => [col, ...cols.map((_, j) => stats.correlationMatrix[i]?.[j] ?? '')]),
    ];
    const ws = xlsx.utils.aoa_to_sheet(corrData);
    ws['!cols'] = [{ wch: 15 }, ...cols.map(() => ({ wch: 10 }))];
    xlsx.utils.book_append_sheet(wb, ws, 'Correlations');
  }

  // Sheet 5: Column Types
  if (stats?.columnTypes) {
    const typeData = [
      ['Column', 'Type'],
      ...dataset.headers.map(h => [h, stats.columnTypes[h] || 'unknown']),
    ];
    const ws = xlsx.utils.aoa_to_sheet(typeData);
    ws['!cols'] = [{ wch: 25 }, { wch: 12 }];
    xlsx.utils.book_append_sheet(wb, ws, 'Column Types');
  }

  // Generate and download
  const wbout = xlsx.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);

  const baseName = dataset.name?.replace(/\.[^.]+$/, '') || 'dataset';
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}-export.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
