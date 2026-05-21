# DataLens

Browser-native data intelligence platform for turning CSV and Excel files into statistics, quality checks, visualizations, AI-powered insights, and exportable reports.

DataLens is an integrated React + Node.js + Python application. Users sign in before uploading datasets, and files are saved to MongoDB so authenticated users can continue working with their data across sessions.

## Core Features

### Analytics Engine
- Automatic column type detection for IDs, numbers, categories, dates, and text
- Descriptive statistics including mean, median, standard deviation, variance, IQR, skewness, and coefficient of variation
- Outlier detection using Z-score and IQR methods
- Correlation matrix and plain-English relationship summaries
- Time-series summaries with trend, peak, and trough detection

### Statistical Tests & Data Quality
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

### Analysis Engine (ML + Forecasting)
Production-grade analytical algorithms running in-memory on Node.js:

| Algorithm | Capabilities |
|-----------|-------------|
| **K-Means Clustering** | K-Means++ initialization, WCSS, auto-K via elbow method, cluster centroids and labeling |
| **Linear + Polynomial Regression** | Simple, multiple, and polynomial (degree 2–5) with R², RMSE, residuals |
| **Decision Tree Feature Importance** | Gini/entropy/variance reduction, feature ranking, split path explanation |
| **Isolation Forest Anomaly Detection** | Random isolation trees, path-length scoring, configurable contamination threshold |
| **Holt-Winters Forecasting** | Additive trend, multiplicative seasonality, confidence intervals |
| **FFT Seasonality Detection** | Cooley-Tukey radix-2 FFT, Hanning window, dominant frequency extraction |

### Intelligence Layer (LLM-Powered)
AI capabilities powered by Google Gemini:

- **Natural Language Queries** — ask questions in plain English (e.g. "show me the correlation between price and rating") and get structured analysis results with narrative explanations
- **Auto-Generated Report Narratives** — executive or technical summaries auto-written from dataset stats, rendered as markdown and exportable to PDF
- **Text Column NLP** — sentiment analysis (VADER), topic modeling (LDA), and keyword extraction (TF-IDF) for free-text columns via the Python service
- **Automated EDA Reports** — one-click exploratory data analysis using ydata-profiling with LLM-authored narrative overlay and inline plots

Privacy posture: only schema, column profiles, pre-computed stats, and at most 10 redacted sample rows are sent to the LLM. Raw row data is never sent in bulk. PII columns (email, phone, credit card) are automatically redacted before any external call.

### Data Quality and Cleaning
- Dataset health score on a 0–100 scale
- Quality flags for missing values, duplicate rows, mixed types, skewness, and other data issues
- One-click data standardization for common spreadsheet problems
- Cleaned CSV export for downstream use

### Collaboration
- Real-time collaboration via WebSockets (Socket.IO)
- Dataset comparison across uploaded files
- Shared report links

### Product Experience
- Login/signup and Google OAuth support
- MongoDB-backed dataset persistence for logged-in users
- Dashboard, Data Explorer, Visualizer, Reports, AI Insights, Analysis Lab, Data Quality, Statistical Tests, and Dataset Comparison pages
- PDF report export with schema, numeric analysis, insights, narratives, and quality checks
- Analysis Playground with parameter tuning, results visualization, and debug panel

## Supported Files

- `.csv`
- `.xlsx`
- `.xls`

Uploads are limited to 500 MB per file in both the browser client and the Node backend.

## Technology Stack

- **Frontend**: React 19, Vite 8, React Router 7
- **Styling**: Tailwind CSS v4 (custom design tokens)
- **Charts**: Recharts
- **Animations**: Framer Motion
- **Data parsing**: SheetJS for Excel, native CSV parsing
- **Analytics**: Custom JavaScript stats engine + Node.js analysis engine
- **Backend**: Node.js, Express, MongoDB, Mongoose
- **Python Service**: FastAPI, scikit-learn, statsmodels, NLTK, ydata-profiling (ML, NLP, EDA)
- **LLM**: Google Gemini (configurable model, default gemini-2.5-flash)
- **Auth**: JWT, bcrypt, Google OAuth
- **Real-time**: Socket.IO
- **Job Queue / Caching**: Redis, BullMQ
- **Exports**: jsPDF + jspdf-autotable
- **Validation**: Zod (backend schemas and tool registry)
- **Testing**: Vitest (backend + frontend)
- **Infrastructure**: Docker Compose (MongoDB, Redis, Node backend, Python service, React frontend)

## Project Structure

```text
data_backend/
  config/             # Redis, storage, intelligence layer config
  middleware/         # Auth middleware
  models/             # Mongoose schemas (User, Dataset with narrative/EDA sub-schemas)
  routes/             # auth, datasets, analysis, analysisEngine, intelligence, collaboration, advancedMl
  services/           # statsEngine, analysisEngine, dataQuality, statisticalTests,
                      #   geminiClient, nlQueryService, narrativeService, datasetContext,
                      #   redactor, toolRegistry, promptTemplates, intelligenceLogger,
                      #   llmRateLimiter, pythonBridge, fileParser, jobQueue
  storage/            # Uploads and parsed JSONL files
  tests/              # Vitest unit tests
  server.js

data_frontend/
  src/
    components/       # Layout, Sidebar, charts, analysis panels, UI components
      analysis/       # K-Means, Regression, Anomaly, Forecast, FFT, Feature Importance panels
      intelligence/   # NLQueryBox, NarrativePanel, EDAReportPanel, TextNlpPanel, ErrorBanner
    context/          # Auth, Dataset, Signup contexts
    lib/              # API client, stats engine, CSV tools, PDF export, intelligence markdown
    pages/            # Dashboard, Explorer, Visualizer, Tests, Quality, Reports,
                      #   AI Insights, Analysis Lab, Dataset Comparison, Workspace, Shared Report

python_service/
  intelligence/       # NLP routes + pipeline, EDA routes + pipeline
  main.py             # FastAPI service (imputation, clustering, PCA, feature importance, NLP, EDA)
  requirements.txt

test_data/            # Sample CSV datasets for testing
docker-compose.yml    # Full stack orchestration (production)
docker-compose.dev.yml # Development overrides
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- MongoDB running locally or a MongoDB Atlas connection string
- (Optional) Python 3.12+ for the ML/NLP/EDA service
- (Optional) Redis for job queue and caching
- (Optional) Docker for full-stack deployment
- (Optional) Google Gemini API key for Intelligence Layer features

### Backend Setup

```bash
cd data_backend
npm install
```

Create `data_backend/.env` (see `.env.example`):

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/datalens
JWT_SECRET=replace_with_a_strong_secret
GOOGLE_CLIENT_ID=your_google_client_id_optional
REDIS_URL=redis://127.0.0.1:6379
PYTHON_SERVICE_URL=http://127.0.0.1:8000
INTELLIGENCE_LAYER_ENABLED=true
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL_ID=gemini-2.5-flash
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

Required for: advanced ML validation, text NLP analysis, and automated EDA reports.

### Docker (Full Stack)

```bash
docker-compose up --build
```

This starts MongoDB, Redis, the Node.js backend, the Python service, and the React frontend together.

For development with hot-reload:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

## Running Tests

```bash
# Backend tests
cd data_backend
npm test

# Frontend tests
cd data_frontend
npm test
```

## Available Scripts

Backend:

| Command | Description |
|---------|-------------|
| `npm run dev` | Development with nodemon |
| `npm start` | Production |
| `npm test` | Run vitest |

Frontend:

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run preview` | Preview production build |
| `npm test` | Run vitest |

## Intelligence Layer

The Intelligence Layer adds AI-powered capabilities on top of the analytics platform. It requires a Gemini API key (`GEMINI_API_KEY`) to function. When credentials are missing, the app gracefully disables AI features without affecting core functionality.

### Natural Language Queries

Navigate to **AI Insights** and type a question like:
- "What's the correlation between age and income?"
- "Run anomaly detection on the sales column"
- "Forecast the next 12 months of revenue"

The system translates your question into a structured analysis intent, runs the matching algorithm, and returns results with a plain-English narrative.

### Report Narratives

On the **Reports** page, click "Generate Narrative" to get an executive or technical summary auto-written from your dataset's statistics. Toggle between tones and regenerate as needed. Narratives are included in PDF exports.

### Text NLP

On the **AI Insights** page, text columns show an "Analyze text" action. This runs sentiment analysis, topic modeling, and keyword extraction through the Python service — no LLM required for this feature.

### Automated EDA

On the **Reports** page, click "Generate EDA Report" for a one-click exploratory analysis powered by ydata-profiling with an LLM narrative overlay and inline plots.

## Analysis Lab

Navigate to **Analysis Lab** in the sidebar after uploading a dataset. The playground provides:

- **Algorithm selector** — K-Means, Regression, Feature Importance, Anomaly Detection, Forecasting, FFT
- **Parameter tuning** — Adjust K, polynomial degree, contamination threshold, season length, etc.
- **Results visualization** — Metric cards, bar charts, tables, and forecast plots
- **Debug panel** — Server execution time, client round-trip, parameters sent, timestamps

## License

MIT
