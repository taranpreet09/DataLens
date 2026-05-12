# Obsidian Analytics

Browser-native data intelligence platform for turning CSV and Excel files into statistics, quality checks, visualizations, plain-English insights, and exportable reports.

Obsidian Analytics is built as an integrated React + Node.js application. Users must sign in before uploading datasets, and uploaded files are saved to MongoDB so authenticated users can continue working with their data later.

## Core Features

### Analytics Engine
- Automatic column type detection for IDs, numbers, categories, dates, and text
- Descriptive statistics including mean, median, standard deviation, variance, IQR, skewness, and coefficient of variation
- Outlier detection using Z-score and IQR methods
- Correlation matrix and plain-English relationship summaries
- Time-series summaries with trend, peak, and trough detection

### Phase 2 — Statistical Tests & Data Quality
- Two-sample t-test (Welch's), one-sample t-test
- Chi-square test of independence with Cramér's V
- One-way ANOVA
- Normality testing (D'Agostino-Pearson)
- Correlation significance testing
- Confidence intervals
- Smart semantic type inference (email, phone, URL, currency, etc.)
- Fuzzy duplicate detection via Levenshtein distance
- Auto-generated validation rules
- Column dependency detection

### Phase 3 — Analysis Engine (ML + Forecasting)
Production-grade analytical algorithms running in-memory on Node.js:

| Algorithm | Capabilities |
|-----------|-------------|
| **K-Means Clustering** | K-Means++ initialization, WCSS, auto-K via elbow method, cluster centroids and labeling |
| **Linear + Polynomial Regression** | Simple, multiple, and polynomial (degree 2–5) with R², RMSE, residuals |
| **Decision Tree Feature Importance** | Gini/entropy/variance reduction, feature ranking, split path explanation |
| **Isolation Forest Anomaly Detection** | Random isolation trees, path-length scoring, configurable contamination threshold |
| **Holt-Winters Forecasting** | Additive trend, multiplicative seasonality, confidence intervals |
| **FFT Seasonality Detection** | Cooley-Tukey radix-2 FFT, Hanning window, dominant frequency extraction |

All algorithms are tested for mathematical correctness, edge cases, and performance (10k–100k rows).

### Data Quality and Cleaning
- Dataset health score on a 0-100 scale
- Quality flags for missing values, duplicate rows, mixed types, skewness, and other data issues
- One-click data standardization for common spreadsheet problems
- Cleaned CSV export for downstream use

### Product Experience
- Login/signup and Google OAuth support
- MongoDB-backed dataset persistence for logged-in users
- Dashboard, Data Explorer, Visualizer, Reports, AI Insights, and Analysis Lab pages
- PDF report export with dataset schema, numeric analysis, insights, and quality checks
- Analysis Playground with parameter tuning, results visualization, and debug panel

## Supported Files

- `.csv`
- `.xlsx`
- `.xls`

Uploads are limited in the frontend to 10 MB per file. The backend currently accepts JSON payloads up to 50 MB.

## Technology Stack

- Frontend: React 19, Vite, React Router
- Styling: Tailwind CSS v4
- Charts: Recharts and custom chart components
- Data parsing: SheetJS for Excel, native CSV parsing and preprocessing
- Analytics: Dedicated JavaScript stats engine + Phase 3 analysis engine
- Backend: Node.js, Express, MongoDB, Mongoose
- Python Service: FastAPI, scikit-learn, statsmodels (advanced ML + cross-validation)
- Auth: JWT, bcrypt, Google OAuth
- Exports: jsPDF and jspdf-autotable
- Testing: Vitest (42 unit tests for analysis engine, performance benchmarks)
- Infrastructure: Docker Compose (MongoDB, Redis, Node backend, Python service)

## Project Structure

```text
data_backend/
  middleware/       # Auth middleware
  models/           # Mongoose schemas (User, Dataset)
  routes/           # auth, datasets, analysis, phase3
  services/         # statsEngine, analysisEngine, dataQuality, statisticalTests, pythonBridge
  config/           # Redis, storage config
  tests/            # Vitest unit tests
  server.js

data_frontend/
  src/
    components/     # Layout, Sidebar, charts, analysis panels, UI components
    context/        # Auth, Dataset, Signup contexts
    lib/            # API client, stats engine, CSV tools, PDF export
    pages/          # Dashboard, Explorer, Visualizer, Tests, Quality, Reports, AI, Analysis Lab

python_service/
  main.py           # FastAPI service (imputation, clustering, PCA, feature importance, validation)
  requirements.txt

test_data/          # Sample CSV datasets for testing
docker-compose.yml  # Full stack orchestration
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- MongoDB running locally, or a MongoDB Atlas connection string
- (Optional) Python 3.12+ for the ML validation service
- (Optional) Redis for job queue and caching
- (Optional) Docker for full-stack deployment

### Backend Setup

```bash
cd data_backend
npm install
```

Create `data_backend/.env`:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/obsidian_analytics
JWT_SECRET=replace_with_a_strong_secret
GOOGLE_CLIENT_ID=your_google_client_id_optional
REDIS_URL=redis://127.0.0.1:6379
PYTHON_SERVICE_URL=http://127.0.0.1:8000
```

Start the backend:

```bash
npm run dev
```

The API runs at `http://127.0.0.1:5000`

### Frontend Setup

```bash
cd data_frontend
npm install
```

If using Google OAuth, create `data_frontend/.env`:

```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

Start the frontend:

```bash
npm run dev
```

The app runs at `http://localhost:5173`

### Python Service (Optional)

```bash
cd python_service
pip install -r requirements.txt
uvicorn main:app --port 8000
```

### Docker (Full Stack)

```bash
docker-compose up --build
```

This starts MongoDB, Redis, the Node.js backend, and the Python service together.

## Running Tests

```bash
# Backend analysis engine tests
cd data_backend
npm test

# Frontend tests
cd data_frontend
npm test
```

## Available Scripts

Backend:

```bash
npm run dev       # Development with nodemon
npm start         # Production
npm test          # Run vitest
```

Frontend:

```bash
npm run dev       # Vite dev server
npm run build     # Production build
npm run lint      # ESLint
npm run preview   # Preview production build
npm test          # Run vitest
```

## Phase 3 Analysis Lab

Navigate to **Analysis Lab** in the sidebar after uploading a dataset. The playground provides:

- **Algorithm selector** — Switch between K-Means, Regression, Feature Importance, Anomaly Detection, Forecasting, and FFT
- **Parameter tuning** — Adjust K, polynomial degree, contamination threshold, season length, etc.
- **Results visualization** — Metric cards, bar charts, tables, and forecast plots
- **Debug panel** — Server execution time, client round-trip, parameters sent, timestamps

### Recommended test datasets

| File | Best for |
|------|----------|
| `1_student_performance_messy.csv` | Regression, Feature Importance |
| `5_monthly_finance_timeseries.csv` | Holt-Winters, FFT |
| `6_customer_support_outliers.csv` | Anomaly Detection |
| `7_large_student_dataset_5k.csv` | K-Means, performance testing |

## License

MIT
