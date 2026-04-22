import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Generates a professional, text-selectable, formal business PDF Report 
 * computationally populated by the dataset stats logic natively.
 *
 * @param {Object} ds - The Obsidian Analytics activeDataset object containing .stats
 * @param {string} filename - Output filename
 */
export async function exportReportToPDF(ds, filename = 'Obsidian Analytics-Report.pdf') {
  if (!ds || !ds.stats) throw new Error('Invalid dataset or missing stats data.');
  
  const stats = ds.stats;
  // Professional A4 format (Portrait)
  const pdf = new jsPDF('p', 'mm', 'a4');
  
  // Theme constants
  const primaryColor = [148, 170, 255]; // Represents the Obsidian Analytics brand blueish-violet
  const errorColor = [220, 53, 69];

  // ─── PAGE 1: Executive Summary ──────────────────────────────────────────
  pdf.setFontSize(26);
  pdf.setTextColor(20, 20, 24); 
  pdf.text('Obsidian Analytics Analytical Report', 14, 24);
  
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
        s ? s.skewness.toFixed(2) : 'NA'
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
  if (stats.qualityFlags && stats.qualityFlags.length > 0) {
    pdf.addPage();
    pdf.setFontSize(18);
    pdf.text('Detected Anomalies & Quality Flags', 14, 20);
    
    const qBody = stats.qualityFlags.map(q => {
      return [
        q.column || 'Global (Cross-column)', 
        q.issue, 
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

  // Final Output Execution
  pdf.save(filename);
}
