import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as xlsx from "../data_backend/node_modules/xlsx/xlsx.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CSV_TARGET_BYTES = 105 * 1024 * 1024;
const EXCEL_TARGET_MIN_BYTES = 5 * 1024 * 1024;
const EXCEL_TARGET_MAX_BYTES = 10 * 1024 * 1024;

const roles = [
  {
    key: "sales_marketing_growth",
    owner: "Sales and Marketing",
    csv: "sales_marketing_growth_analytics_100mb.csv",
    xlsx: "sales_marketing_growth_dashboard.xlsx",
    headers: [
      "event_id",
      "event_date",
      "region",
      "sales_rep",
      "channel",
      "campaign",
      "product_line",
      "impressions",
      "clicks",
      "conversions",
      "ad_spend_usd",
      "discount_pct",
      "revenue_usd",
      "customer_tier",
      "lead_score",
      "nps_score",
      "sentiment_score",
      "customer_email",
      "phone",
      "landing_page",
      "review_text",
      "data_quality_flag",
    ],
  },
  {
    key: "finance_revenue",
    owner: "Finance",
    csv: "finance_revenue_transactions_100mb.csv",
    xlsx: "finance_revenue_dashboard.xlsx",
    headers: [
      "transaction_id",
      "posting_date",
      "business_unit",
      "region",
      "account_code",
      "cost_center",
      "vendor",
      "customer_segment",
      "invoice_amount_usd",
      "tax_amount_usd",
      "payment_terms_days",
      "days_to_pay",
      "gross_margin_pct",
      "forecast_amount_usd",
      "actual_amount_usd",
      "currency",
      "approval_status",
      "analyst_note",
      "data_quality_flag",
    ],
  },
  {
    key: "operations_supply_chain",
    owner: "Operations",
    csv: "operations_supply_chain_100mb.csv",
    xlsx: "operations_supply_chain_dashboard.xlsx",
    headers: [
      "shipment_id",
      "ship_date",
      "origin",
      "destination",
      "carrier",
      "warehouse",
      "product_line",
      "units_ordered",
      "units_shipped",
      "unit_weight_kg",
      "freight_cost_usd",
      "lead_time_days",
      "delay_days",
      "temperature_c",
      "damage_rate_pct",
      "stockout_risk_score",
      "priority",
      "customer_region",
      "incident_summary",
      "data_quality_flag",
    ],
  },
  {
    key: "customer_support",
    owner: "Customer Support",
    csv: "customer_support_tickets_100mb.csv",
    xlsx: "customer_support_dashboard.xlsx",
    headers: [
      "ticket_id",
      "created_at",
      "resolved_at",
      "queue",
      "agent",
      "customer_tier",
      "issue_category",
      "product_line",
      "first_response_minutes",
      "resolution_hours",
      "reopen_count",
      "csat_score",
      "sentiment_score",
      "escalated",
      "refund_usd",
      "customer_email",
      "summary_text",
      "data_quality_flag",
    ],
  },
  {
    key: "hr_workforce",
    owner: "HR and People Ops",
    csv: "hr_workforce_analytics_100mb.csv",
    xlsx: "hr_workforce_dashboard.xlsx",
    headers: [
      "employee_id",
      "snapshot_date",
      "department",
      "location",
      "job_level",
      "manager_id",
      "tenure_months",
      "performance_rating",
      "training_hours",
      "engagement_score",
      "overtime_hours",
      "absences",
      "salary_band",
      "attrition_risk_score",
      "promotion_eligible",
      "exit_flag",
      "employee_email",
      "manager_note",
      "data_quality_flag",
    ],
  },
];

const regions = ["North", "South", "East", "West", "Central", "APAC", "EMEA", "LATAM"];
const channels = ["Paid Search", "Organic", "Partner", "Field Sales", "Email", "Social", "Marketplace"];
const products = ["DataLens Core", "DataLens Pro", "DataLens Enterprise", "Quality Module", "AI Insights", "Forecast Lab"];
const campaigns = ["Q1 Expansion", "Renewal Push", "Upsell Motion", "Launch Wave", "Webinar Series", "Executive Briefing"];
const names = ["Aarav", "Maya", "Ishaan", "Priya", "Neha", "Kabir", "Anika", "Rohan", "Tara", "Dev"];
const departments = ["Engineering", "Sales", "Marketing", "Finance", "Operations", "Support", "People", "Product"];
const queues = ["Billing", "Technical", "Onboarding", "Renewals", "Bug Reports", "Data Imports", "Account Access"];
const issueCategories = ["CSV upload", "Excel parsing", "Dashboard filter", "PDF export", "Forecasting", "Authentication", "Report sharing"];
const carriers = ["BlueDart", "DHL", "FedEx", "Delhivery", "Maersk", "UPS", "Shiprocket"];
const cities = ["Mumbai", "Delhi", "Bengaluru", "Chennai", "Pune", "Hyderabad", "Ahmedabad", "Kolkata"];

function pick(values, i, offset = 0) {
  return values[(i + offset) % values.length];
}

function number(seed, min, max, decimals = 0) {
  const raw = Math.sin(seed * 12.9898) * 43758.5453;
  const unit = raw - Math.floor(raw);
  const value = min + unit * (max - min);
  return decimals ? value.toFixed(decimals) : Math.round(value);
}

function dateFromDay(base, i) {
  const date = new Date(base);
  date.setUTCDate(date.getUTCDate() + (i % 900));
  return date.toISOString().slice(0, 10);
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function textBlob(roleKey, i) {
  const tokens = [
    `dataset=${roleKey}`,
    `pattern=${pick(["seasonal", "outlier", "steady", "spiky", "correlated", "missing-prone"], i)}`,
    `note=${pick(["review before board meeting", "good for clustering", "contains noisy text", "tests PII redaction", "use for forecasting demo"], i, 2)}`,
    `trace=${(i * 7919).toString(36)}-${(i * 104729).toString(36)}-${number(i, 10000, 99999)}`,
  ];
  return tokens.join(" ");
}

function buildRow(role, i) {
  const flag = i % 997 === 0 ? "missing_value_candidate" : i % 613 === 0 ? "duplicate_candidate" : i % 431 === 0 ? "outlier_candidate" : "ok";
  const email = `${role.key}.${i}@demo-datalens.test`;
  const phone = `+91-9${String(100000000 + (i * 37) % 899999999).padStart(9, "0")}`;

  if (role.key === "sales_marketing_growth") {
    const impressions = number(i, 1200, 85000);
    const clicks = Math.round(impressions * Number(number(i + 10, 0.012, 0.19, 4)));
    const conversions = Math.round(clicks * Number(number(i + 20, 0.015, 0.22, 4)));
    const spend = Number(number(i + 30, 125, 5200, 2));
    const revenue = conversions * Number(number(i + 40, 48, 410, 2));
    return [
      `EVT-${String(i).padStart(9, "0")}`,
      dateFromDay("2024-01-01T00:00:00Z", i),
      pick(regions, i),
      `${pick(names, i)} ${pick(["Shah", "Mehta", "Rao", "Iyer", "Nair"], i)}`,
      pick(channels, i),
      pick(campaigns, i),
      pick(products, i),
      impressions,
      clicks,
      conversions,
      spend.toFixed(2),
      number(i + 50, 0, 35, 1),
      revenue.toFixed(2),
      pick(["SMB", "Mid-Market", "Enterprise", "Strategic"], i),
      number(i + 60, 1, 100),
      number(i + 70, 0, 10),
      number(i + 80, -0.95, 0.98, 3),
      email,
      phone,
      `https://demo-datalens.test/${pick(["pricing", "reports", "ai-insights", "quality"], i)}`,
      textBlob(role.key, i),
      flag,
    ];
  }

  if (role.key === "finance_revenue") {
    const forecast = Number(number(i + 90, 900, 175000, 2));
    const actual = forecast * Number(number(i + 100, 0.72, 1.28, 4));
    return [
      `TXN-${String(i).padStart(9, "0")}`,
      dateFromDay("2023-04-01T00:00:00Z", i),
      pick(["SaaS", "Services", "Support", "Marketplace"], i),
      pick(regions, i),
      `${number(i, 4000, 8999)}-${pick(["REV", "COGS", "OPEX", "AR"], i)}`,
      `CC-${number(i, 100, 999)}`,
      pick(["Northstar Analytics", "CloudWorks", "LedgerPro", "Inventa", "BrightOps"], i),
      pick(["SMB", "Mid-Market", "Enterprise", "Strategic"], i),
      actual.toFixed(2),
      (actual * 0.18).toFixed(2),
      pick([15, 30, 45, 60, 90], i),
      number(i + 120, 4, 105),
      number(i + 130, -8, 74, 2),
      forecast.toFixed(2),
      actual.toFixed(2),
      pick(["USD", "INR", "EUR", "GBP", "SGD"], i),
      pick(["Approved", "Pending", "Rejected", "Needs Review"], i),
      textBlob(role.key, i),
      flag,
    ];
  }

  if (role.key === "operations_supply_chain") {
    const ordered = number(i + 140, 20, 12000);
    const shipped = Math.max(0, ordered - number(i + 150, 0, 180));
    return [
      `SHP-${String(i).padStart(9, "0")}`,
      dateFromDay("2024-02-01T00:00:00Z", i),
      pick(cities, i),
      pick(cities, i, 3),
      pick(carriers, i),
      `WH-${pick(["A", "B", "C", "D", "E"], i)}-${number(i, 10, 99)}`,
      pick(products, i),
      ordered,
      shipped,
      number(i + 160, 0.2, 22, 2),
      number(i + 170, 55, 12500, 2),
      number(i + 180, 1, 34),
      number(i + 190, -2, 18),
      number(i + 200, 2, 34, 1),
      number(i + 210, 0, 7.5, 2),
      number(i + 220, 0, 100, 1),
      pick(["Low", "Normal", "High", "Critical"], i),
      pick(regions, i),
      textBlob(role.key, i),
      flag,
    ];
  }

  if (role.key === "customer_support") {
    const created = dateFromDay("2024-05-01T00:00:00Z", i);
    return [
      `TKT-${String(i).padStart(9, "0")}`,
      `${created} ${String(i % 24).padStart(2, "0")}:${String((i * 7) % 60).padStart(2, "0")}:00`,
      dateFromDay("2024-05-02T00:00:00Z", i),
      pick(queues, i),
      `${pick(names, i)} ${pick(["Verma", "Das", "Kapoor", "Menon", "Patel"], i)}`,
      pick(["Free", "Team", "Business", "Enterprise"], i),
      pick(issueCategories, i),
      pick(products, i),
      number(i + 230, 2, 980),
      number(i + 240, 0.4, 168, 2),
      number(i + 250, 0, 5),
      number(i + 260, 1, 5),
      number(i + 270, -0.99, 0.99, 3),
      i % 11 === 0 ? "Yes" : "No",
      number(i + 280, 0, 1200, 2),
      email,
      textBlob(role.key, i),
      flag,
    ];
  }

  return [
    `EMP-${String(i).padStart(8, "0")}`,
    dateFromDay("2024-01-01T00:00:00Z", i),
    pick(departments, i),
    pick(cities, i),
    pick(["L1", "L2", "L3", "L4", "L5", "Director"], i),
    `MGR-${String(number(i + 290, 1000, 9999)).padStart(4, "0")}`,
    number(i + 300, 1, 132),
    number(i + 310, 1, 5, 1),
    number(i + 320, 0, 120, 1),
    number(i + 330, 1, 100),
    number(i + 340, 0, 44, 1),
    number(i + 350, 0, 18),
    pick(["A", "B", "C", "D", "E", "F"], i),
    number(i + 360, 0, 100, 1),
    i % 7 === 0 ? "Yes" : "No",
    i % 29 === 0 ? "Yes" : "No",
    email,
    textBlob(role.key, i),
    flag,
  ];
}

async function writeCsv(role) {
  const outPath = path.join(__dirname, role.csv);
  const stream = fs.createWriteStream(outPath, { encoding: "utf8" });
  let bytes = stream.write(`${role.headers.join(",")}\n`) ? Buffer.byteLength(`${role.headers.join(",")}\n`) : 0;
  let rows = 0;

  while (bytes < CSV_TARGET_BYTES) {
    rows += 1;
    const line = `${buildRow(role, rows).map(csvEscape).join(",")}\n`;
    bytes += Buffer.byteLength(line);
    if (!stream.write(line)) {
      await new Promise((resolve) => stream.once("drain", resolve));
    }
  }

  await new Promise((resolve, reject) => {
    stream.end(resolve);
    stream.on("error", reject);
  });

  return { outPath, rows, bytes: (await fsp.stat(outPath)).size };
}

function metricRows(role, rowCount) {
  const rows = [];
  for (let i = 1; i <= rowCount; i += 1) {
    const base = buildRow(role, i * 3);
    rows.push(base);
  }
  return rows;
}

function addSummarySheet(workbook, role, dataRows) {
  const ws = xlsx.utils.aoa_to_sheet([
    ["DataLens Demo Workbook", role.owner],
    ["Role", role.owner],
    ["Source CSV", role.csv],
    ["Rows in workbook sample", dataRows.length],
    ["Purpose", "Upload to DataLens to demo profiling, data quality, statistics, ML, forecasting, NLP, and report export."],
    [],
    ["Suggested demo questions"],
    ["Find outliers and missing value candidates."],
    ["Show trends over time and identify peak periods."],
    ["Run correlations across numeric columns."],
    ["Generate a narrative report for an executive audience."],
    ["Analyze text/sentiment fields when available."],
  ]);
  ws["!cols"] = [{ wch: 28 }, { wch: 115 }];
  xlsx.utils.book_append_sheet(workbook, ws, "README");
}

function addDictionarySheet(workbook, role) {
  const rows = [["column", "demo_use"]];
  for (const header of role.headers) {
    let use = "Categorical or descriptive field for filtering and grouping.";
    if (/date|created|resolved/.test(header)) use = "Date/time field for trend and forecasting demos.";
    if (/amount|revenue|cost|spend|margin|score|hours|days|rate|units|clicks|conversions|impressions|absences|refund/.test(header)) {
      use = "Numeric field for descriptive stats, outliers, correlations, regression, and charts.";
    }
    if (/email|phone/.test(header)) use = "PII-like field to demonstrate semantic detection and redaction posture.";
    if (/text|note|summary/.test(header)) use = "Free-text field for NLP, keyword extraction, and sentiment demos.";
    if (/quality/.test(header)) use = "Intentional quality flag for filtering bad rows and explaining health score behavior.";
    rows.push([header, use]);
  }
  const ws = xlsx.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 32 }, { wch: 95 }];
  xlsx.utils.book_append_sheet(workbook, ws, "Data Dictionary");
}

function createWorkbook(role, rowCount) {
  const workbook = xlsx.utils.book_new();
  const rows = metricRows(role, rowCount);
  addSummarySheet(workbook, role, rows);
  const sample = [role.headers, ...rows];
  const ws = xlsx.utils.aoa_to_sheet(sample);
  ws["!autofilter"] = { ref: xlsx.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: role.headers.length - 1 } }) };
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  ws["!cols"] = role.headers.map((header) => ({ wch: Math.min(Math.max(header.length + 4, 14), 32) }));
  xlsx.utils.book_append_sheet(workbook, ws, "Upload Sample");
  addDictionarySheet(workbook, role);
  return workbook;
}

async function writeWorkbook(role) {
  let rowCount = 18000;
  let outPath = path.join(__dirname, role.xlsx);
  let bytes = 0;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const workbook = createWorkbook(role, rowCount);
    const buffer = xlsx.write(workbook, { compression: true, bookType: "xlsx", type: "buffer" });
    await fsp.writeFile(outPath, buffer);
    bytes = (await fsp.stat(outPath)).size;
    if (bytes >= EXCEL_TARGET_MIN_BYTES && bytes <= EXCEL_TARGET_MAX_BYTES) break;
    rowCount = bytes < EXCEL_TARGET_MIN_BYTES ? Math.ceil(rowCount * 1.45) : Math.floor(rowCount * 0.82);
  }

  return { outPath, rows: rowCount, bytes: (await fsp.stat(outPath)).size };
}

async function main() {
  const manifest = {
    generatedAt: new Date().toISOString(),
    csvTargetBytes: CSV_TARGET_BYTES,
    excelTargetRangeBytes: [EXCEL_TARGET_MIN_BYTES, EXCEL_TARGET_MAX_BYTES],
    files: [],
  };

  for (const role of roles) {
    console.log(`Generating ${role.owner} CSV...`);
    const csv = await writeCsv(role);
    console.log(`Generating ${role.owner} Excel workbook...`);
    const workbook = await writeWorkbook(role);
    manifest.files.push({
      role: role.owner,
      csv: path.basename(csv.outPath),
      csvRows: csv.rows,
      csvBytes: csv.bytes,
      xlsx: path.basename(workbook.outPath),
      xlsxRows: workbook.rows,
      xlsxBytes: workbook.bytes,
    });
  }

  await fsp.writeFile(path.join(__dirname, "role_test_data_manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
