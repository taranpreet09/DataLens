# DataLens Frontend

React-based frontend for **DataLens**, a browser-native data intelligence platform. Implements interactive visualizations, a custom statistical computation engine, AI-powered insights, and PDF report exports.

## Key Components

### Stats Engine (`src/lib/statsEngine.js`)
A dependency-free computation engine running entirely in the browser:
- Column type detection (ID, numeric, categorical, date, text)
- Outlier analysis via Z-score and IQR
- Time series aggregation, trend lines, and peak/trough identification
- Correlation matrix (Pearson)
- Category aggregation with comparative insights

### Intelligence Components (`src/components/intelligence/`)
- **NLQueryBox** — chat-style natural language question input with structured result rendering
- **NarrativePanel** — markdown narrative display with tone toggle and regenerate
- **EDAReportPanel** — automated EDA report with profile tables, plots, and PDF export
- **TextNlpPanel** — sentiment donut, topic list, and keyword table for text columns
- **IntelligenceErrorBanner** — user-friendly error display for AI service issues

### Analysis Panels (`src/components/analysis/`)
- K-Means clustering visualization
- Regression analysis (linear, polynomial, multiple)
- Feature importance ranking
- Anomaly detection results
- Holt-Winters forecasting with confidence intervals
- FFT seasonality detection

### Visualization Layer
Built with **Recharts** and **Tailwind CSS v4**:
- Correlation heatmaps
- Multi-view histograms with skewness annotations
- Donut charts for category distributions
- Area charts with regression overlays and reference points
- Forecast plots with confidence bands

### State Management (`src/context/`)
- `DatasetContext` — useReducer-based store for dataset state, parsing, and stats caching
- `AuthContext` — JWT and Google OAuth session management
- Memory management: datasets parsed once, summarized as `stats` objects

## Tech Stack
- **Framework**: Vite 8 + React 19
- **Routing**: React Router 7
- **Styling**: Tailwind CSS v4
- **Charts**: Recharts
- **Animations**: Framer Motion
- **Icons**: Material Symbols Outlined
- **Parsing**: SheetJS (`XLSX`)
- **PDF Export**: jsPDF + jspdf-autotable
- **Real-time**: Socket.IO client
- **Auth**: Google OAuth (@react-oauth/google)

## Local Development

```bash
# Install dependencies
npm install

# Start development server (HMR enabled)
npm run dev

# Build for production
npm run build

# Lint
npm run lint

# Preview production build
npm run preview

# Run tests
npm test
```

## Folder Structure
- `/src/components` — Reusable UI atoms, chart wrappers, analysis panels, intelligence panels
- `/src/context` — Global stores (auth, dataset, signup)
- `/src/lib` — Core math engine, API client, PDF export, CSV tools
- `/src/pages` — Layout-specific views (Dashboard, Explorer, Visualizer, Reports, AI Insights, Analysis Lab, Quality, Tests, Comparison, Workspace)
- `/src/assets` — Design tokens and static media
- `/public` — Static assets (favicon, icons)

## Environment Variables

```env
VITE_API_URL=http://localhost:5000    # Backend API URL (defaults to localhost:5000)
VITE_GOOGLE_CLIENT_ID=                # Google OAuth client ID (optional)
```

## License

MIT
