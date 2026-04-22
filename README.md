# 💎 Obsidian Analytics — Advanced Analytics Engine (Eval 1)

**Obsidian Analytics** is a high-performance, browser-native analytics platform designed to transform raw tabular data (CSV, XLSX, XLS) into professional-grade intelligence. Built with an "Obsidian" dark design aesthetic, it provides 13+ statistical computation layers, automated quality scoring, and interactive visualizations.

![Status: Evaluation 1 Ready](https://img.shields.io/badge/Status-Eval_1_Ready-success?style=for-the-badge&logo=react)
![Theme: Obsidian Dark](https://img.shields.io/badge/Theme-Obsidian_Dark-blue?style=for-the-badge&logo=tailwindcss)

## 🎥 Core Features

### 1. High-Performance Stats Engine
*   **Column Type Detection**: Automatic heuristic-based classification (ID, Numeric, Categorical, Date, Text).
*   **Comprehensive Metrics**: Mean, Median, StdDev, IQR, Skewness, Variance, and CV% computed instantly.
*   **Numeric Distribution**: 7-bin histograms with automated skew detection.

### 2. Time-Series & Trend Analysis
*   **Linear Regression**: Automated trend line projection through temporal data.
*   **Peak/Trough Detection**: Instant identification of historical highs and lows.
*   **Aggregations**: Monthly/Quarterly rollups with Month-over-Month (MoM) change metrics.

### 3. Data Quality & Anomaly Detection
*   **Quality Score (0-100)**: Composite metric based on nulls, duplicates, and mixed types.
*   **Z-Score vs IQR**: Side-by-side outlier detection comparison across all numeric fields.
*   **Pattern Matching**: Detects constant/near-constant columns and suspicious monotonic sequences.
*   **11+ Quality Flags**: Automatic flagging of data hygiene issues (Empty rows, duplicate keys, skewness alerts).

### 4. Relational Insights
*   **Correlation Heatmap**: Full Pearson r correlation matrix with purple↔red heatmap.
*   **Categorical Analysis**: Top-K frequency distributions and category share donut charts.
*   **Plain English Insights**: Auto-generated text summaries of key data findings.

## 🛠️ Technology Stack

*   **Frontend**: React (Vite)
*   **Styling**: Tailwind CSS v4 (Obsidian Design System)
*   **Visualization**: Recharts + Custom SVG Components
*   **Data Processing**: Dedicated JavaScript Stats Engine (`statsEngine.js`)
*   **File Parsing**: SheetJS (XLSX/XLS) + Native CSV Parsing

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18+)
*   npm or yarn

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/obsidian-analytics.git
   ```
2. Navigate to the frontend directory:
   ```bash
   cd obsidian-analytics/data_frontend
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## 📂 Project Structure

```text
data_frontend/
├── src/
│   ├── components/       # UI Components & Custom Charts
│   ├── context/          # State Management (DatasetContext.jsx)
│   ├── lib/              # The statsEngine.js heart
│   ├── pages/            # Dashboard, Explorer, Visualizer, Reports
│   └── index.css         # Tailwind v4 Design Tokens
└── README.md             # Implementation Details
```

## 🛡️ License
MIT - Developed for Advanced Coding Evaluation 1.
