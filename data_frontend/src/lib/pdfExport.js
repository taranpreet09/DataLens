import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Generates a professional, text-selectable, formal business PDF Report 
 * computationally populated by the dataset stats logic natively.
 *
 * @param {Object} ds       - The Data Lens activeDataset object containing .stats
 * @param {Object} options  - Optional: { includeNarrative: true, includeEda: true }
 * @param {string} filename - Output filename
 */
export async function exportReportToPDF(ds, options = {}, filename) {
  // Support legacy two-argument call: exportReportToPDF(ds, filename)
  if (typeof options === 'string') {
    filename = options;
    options = {};
  }
  if (!filename) filename = 'Data Lens-Report.pdf';

  const { includeNarrative = true, includeEda = true } = options;

  if (!ds || !ds.stats) throw new Error('Invalid dataset or missing stats data.');
  
  const stats = ds.stats;
  // Professional A4 format (Portrait)
  const pdf = new jsPDF('p', 'mm', 'a4');
  
  // Theme constants
  const primaryColor = [148, 170, 255]; // Represents the Data Lens brand blueish-violet
  const errorColor = [220, 53, 69];

  // ─── PAGE 1: Executive Summary ──────────────────────────────────────────
  pdf.setFontSize(26);
  pdf.setTextColor(20, 20, 24); 
  pdf.text('Data Lens Analytical Report', 14, 24);
  
  pdf.setFontSize(10);
  pdf.setTextColor(120, 120, 120);
  pdf.text(`Generated on: ${new Date().toLocaleString()}`, 14, 32);
  
  pdf.setDrawColor(200, 200, 200);
  pdf.line(14, 38, 196, 38);

  pdf.setFontSize(16);
  pdf.setTextColor(0, 0, 0);
  pdf.text('Executive Summary', 14, 50);
  
  pdf.setFontSize(11);
  pdf.setTextColor(50, 50, 50);
  pdf.text(`Dataset Reference : ${ds.name}`, 14, 60);
  pdf.text(`Total Records     : ${stats.rowCount.toLocaleString()} rows`, 14, 66);
  pdf.text(`Schema Size       : ${stats.headers.length} columns`, 14, 72);
  pdf.text(`Quality Score     : ${stats.qualityScore} / 100`, 14, 78);
  
  pdf.setFontSize(16);
  pdf.setTextColor(0, 0, 0);
  pdf.text('Auto-Generated Insights', 14, 95);
  
  let currentY = 103;
  pdf.setFontSize(11);
  pdf.setTextColor(60, 60, 60);
  if (stats.insights && stats.insights.length > 0) {
    stats.insights.forEach((insight) => {
      // Split text strictly so it wraps in A4 dimensions
      const lines = pdf.splitTextToSize(`• ${insight.text}`, 180);
      pdf.text(lines, 14, currentY);
      currentY += (lines.length * 6) + 3;
    });
  } else {
    pdf.text('No critical insights generated for this dataset.', 14, currentY);
  }

  // ─── PAGE 2: Dataset Schema ─────────────────────────────────────────────
  pdf.addPage();
  pdf.setFontSize(18);
  pdf.setTextColor(0, 0, 0);
  pdf.text('Data Schema Overview', 14, 20);
  
  const schemaBody = stats.headers.map(h => {
    const type = stats.columnTypes[h];
    const basics = stats.columnBasics[h];
    return [
      h, 
      type ? type.toUpperCase() : 'UNKNOWN', 
      basics ? `${((basics.nullCount / stats.rowCount) * 100).toFixed(1)}%` : 'NA',
      basics ? basics.uniqueCount.toLocaleString() : 'NA'
    ];
  });
  
  autoTable(pdf, {
    startY: 26,
    head: [['Column Name', 'Inferred Type', 'Missing Data (%)', 'Unique Values']],
    body: schemaBody,
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });

  // ─── PAGE 3: Numeric Analysis ───────────────────────────────────────────
  if (stats.numericColumns && stats.numericColumns.length > 0) {
    pdf.addPage();
    pdf.setFontSize(18);
    pdf.text('Numeric Statistics', 14, 20);
    
    const numBody = stats.numericColumns.map(col => {
      const s = stats.numericStats[col];
      return [
        col,
        s ? Number(s.mean.toFixed(2)).toLocaleString() : 'NA',
        s ? Number(s.min.toFixed(2)).toLocaleString() : 'NA',
        s ? Number(s.max.toFixed(2)).toLocaleString() : 'NA',
        s ? Number(s.stdDev.toFixed(2)).toLocaleString() : 'NA',
        s && s.skewness != null ? s.skewness.toFixed(2) : 'NA'
      ];
    });
    
    autoTable(pdf, {
      startY: 26,
      head: [['Column', 'Mean', 'Min', 'Max', 'Std Dev', 'Skew']],
      body: numBody,
      theme: 'grid',
      headStyles: { fillColor: primaryColor },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });
  }

  // ─── PAGE 4: Text Analysis ─────────────────────────────────────────────
  if (stats.textColumns && stats.textColumns.length > 0) {
    pdf.addPage();
    pdf.setFontSize(18);
    pdf.text('Text & Unstructured Analysis', 14, 20);
    
    const txtBody = stats.textColumns.map(col => {
      const s = stats.textStats[col];
      return [
        col,
        s && s.maxLength !== undefined ? s.maxLength : 'NA',
        s && s.avgLength !== undefined ? s.avgLength.toFixed(1) : 'NA',
        s && s.specialCharRows !== undefined ? `${((s.specialCharRows / stats.rowCount)*100).toFixed(1)}%` : 'NA',
        s && s.whitespaceRows !== undefined ? `${((s.whitespaceRows / stats.rowCount)*100).toFixed(1)}%` : 'NA'
      ];
    });
    
    autoTable(pdf, {
      startY: 26,
      head: [['Column', 'Max Length', 'Avg Length', 'Special Chars (%)', 'Whitespace Iss. (%)']],
      body: txtBody,
      theme: 'grid',
      headStyles: { fillColor: primaryColor },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });
  }

  // ─── PAGE 5: Anomalies & Data Quality ──────────────────────────────────
  const qualityFlagsList = Array.isArray(stats.qualityFlags)
    ? stats.qualityFlags
    : (stats.qualityFlags?.flags || []);

  // Data Quality Summary section
  {
    pdf.addPage();
    pdf.setFontSize(18);
    pdf.setTextColor(0, 0, 0);
    pdf.text('Data Quality Summary', 14, 20);

    const qf = typeof stats.qualityFlags === 'object' && !Array.isArray(stats.qualityFlags)
      ? stats.qualityFlags
      : { totalNullCount: 0, nullPct: 0, duplicateRowCount: 0, duplicatePct: 0, emptyRowCount: 0 };

    const qualitySummaryBody = [
      ['Quality Score', `${stats.qualityScore ?? 'N/A'} / 100`],
      ['Total Records', (stats.rowCount || 0).toLocaleString()],
      ['Null Cells', `${(qf.totalNullCount || 0).toLocaleString()} (${qf.nullPct || 0}%)`],
      ['Duplicate Rows', `${(qf.duplicateRowCount || 0).toLocaleString()} (${qf.duplicatePct || 0}%)`],
      ['Empty Rows', `${qf.emptyRowCount || 0}`],
      ['Total Columns', `${stats.headers?.length || 0}`],
      ['Numeric Columns', `${stats.numericColumns?.length || 0}`],
      ['Categorical Columns', `${stats.categoricalColumns?.length || 0}`],
    ];

    autoTable(pdf, {
      startY: 28,
      head: [['Metric', 'Value']],
      body: qualitySummaryBody,
      theme: 'grid',
      headStyles: { fillColor: primaryColor },
      columnStyles: { 0: { fontStyle: 'bold' } },
    });
  }

  if (qualityFlagsList.length > 0) {
    pdf.addPage();
    pdf.setFontSize(18);
    pdf.text('Detected Anomalies & Quality Flags', 14, 20);
    
    const qBody = qualityFlagsList.map(q => {
      return [
        q.column || 'Global (Cross-column)', 
        q.detail || q.issue || q.type || '', 
        q.severity ? q.severity.toUpperCase() : 'INFO'
      ];
    });
    
    autoTable(pdf, {
      startY: 26,
      head: [['Scope / Column', 'Quality Issue Description', 'Severity']],
      body: qBody,
      theme: 'grid',
      headStyles: { fillColor: errorColor }, // Highlight anomalies in red/crimson
      alternateRowStyles: { fillColor: [255, 245, 245] }, // Slight red tint
    });
  }

  // ─── AI Narrative page ──────────────────────────────────────────────────
  if (includeNarrative && ds.narrative?.fullMarkdown) {
    try {
      pdf.addPage();
      pdf.setFontSize(18);
      pdf.setTextColor(0, 0, 0);
      pdf.text('AI Narrative', 14, 20);

      pdf.setFontSize(10);
      pdf.setTextColor(60, 60, 60);

      // Strip markdown syntax for plain-text PDF rendering
      const plainText = stripMarkdown(ds.narrative.fullMarkdown);
      const lines = pdf.splitTextToSize(plainText, 180);
      let y = 30;
      for (const line of lines) {
        if (y > 270) { pdf.addPage(); y = 20; }
        pdf.text(line, 14, y);
        y += 5;
      }
    } catch (e) {
      console.warn('PDF: failed to render AI narrative page', e);
    }
  }

  // ─── EDA Report page ────────────────────────────────────────────────────
  if (includeEda && ds.edaReport) {
    try {
      pdf.addPage();
      pdf.setFontSize(18);
      pdf.setTextColor(0, 0, 0);
      pdf.text('EDA Report', 14, 20);

      // Narrative text
      if (ds.edaReport.fullMarkdown) {
        pdf.setFontSize(10);
        pdf.setTextColor(60, 60, 60);
        const plainText = stripMarkdown(ds.edaReport.fullMarkdown);
        const lines = pdf.splitTextToSize(plainText, 180);
        let y = 30;
        for (const line of lines) {
          if (y > 270) { pdf.addPage(); y = 20; }
          pdf.text(line, 14, y);
          y += 5;
        }
      }

      // Plot images
      if (ds.edaReport.plots) {
        for (const [key, dataUri] of Object.entries(ds.edaReport.plots)) {
          try {
            if (!dataUri || typeof dataUri !== 'string') continue;
            // Extract format from data URI (default PNG)
            const formatMatch = dataUri.match(/^data:image\/(\w+);base64,/);
            const format = formatMatch ? formatMatch[1].toUpperCase() : 'PNG';
            pdf.addPage();
            pdf.setFontSize(11);
            pdf.setTextColor(80, 80, 80);
            pdf.text(key.replace(/_/g, ' '), 14, 14);
            // Max width 160mm, positioned at x=14, y=20
            pdf.addImage(dataUri, format, 14, 20, 160, 0);
          } catch (imgErr) {
            console.warn(`PDF: failed to add plot image "${key}"`, imgErr);
          }
        }
      }
    } catch (e) {
      console.warn('PDF: failed to render EDA report page', e);
    }
  }

  // Final Output Execution
  pdf.save(filename);
}

/**
 * Strip markdown syntax to produce plain text suitable for PDF rendering.
 * Removes headings markers, bold/italic markers, code fences, links, etc.
 */
function stripMarkdown(md) {
  if (!md) return '';
  return md
    // Remove code fences
    .replace(/```[\s\S]*?```/g, '')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove headings markers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
    // Remove links — keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove blockquote markers
    .replace(/^>\s+/gm, '')
    // Remove list markers
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    // Collapse multiple blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
