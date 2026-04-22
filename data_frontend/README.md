# 🎨 Obsidian Analytics Frontend — Architect Alpha

This is the React-based frontend for **Obsidian Analytics**, an advanced analytics platform. It implements a full data science pipeline entirely in the client-side browser using a custom-built statistical computation engine.

## 🧱 Key Components & Architecture

### 🧠 The Stats Engine (`src/lib/statsEngine.js`)
A dependency-free computation engine that executes 13 distinct steps upon file upload:
*   **Column Type Detection**: Heuristic detection of ID, Numeric, Categorical, and Date fields.
*   **Outlier Analysis**: Z-score and Interquartile Range (IQR) detection.
*   **Time Series**: Monthly aggregation, trend-line calculation (Linear Regression), and peak/trough identification.
*   **Correlation Matrix**: Pearson Correlation coefficient computation for all numeric columns.
*   **Category Aggregation**: Deep-dives into categorical distributions with comparative insights.

### 📊 Visualization Layer
Built with **Recharts** for interactivity and **Tailwind CSS v4** for high-end "Glassmorphism" aesthetics.
*   **Correlation Heatmaps**: Purple-to-Red scale heatmap for relational analysis.
*   **Multi-View Histograms**: Histogram plots with automated skewness annotations.
*   **Donut Projections**: Share percentages for top categories with "Other" grouping.
*   **Dynamic Trends**: Area charts with dashed regression overlays and reference dots for peaks/troughs.

### 🛠️ State Management (`src/context/DatasetContext.jsx`)
*   Uses `useReducer` and `useCallback` for efficient data flow.
*   Memory Management: Large datasets are parsed once, summarized, and stored as `stats` objects to prevent browser lag.
*   Status Tracking: "Processing", "Ready", and "Error" states for all background uploads.

## 💻 Tech Stack
*   **Framework**: Vite + React
*   **Styling**: Tailwind CSS v4 (Custom Obsidian Tokens)
*   **Charts**: Recharts
*   **Icons**: Material Symbols Outlined
*   **Parsing**: SheetJS (`XLSX`)

## 🛠️ Local Development

```bash
# Install dependencies
npm install

# Start development server (HMR enabled)
npm run dev

# Build for production
npm run build
```

## 🏗️ Folder Structure
*   `/src/components`: Reusable UI atoms and chart wrappers.
*   `/src/context`: Global store and parsing logic.
*   `/src/lib`: Core math and analytics engine.
*   `/src/pages`: Layout-specific views (Visualizer, Explorer, Reports).
*   `/src/assets`: Design tokens and static media.
*   `/public`: Static assets.

---
© 2024 Architect Alpha - Project Obsidian Analytics
