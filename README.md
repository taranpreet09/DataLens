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

### Data Quality and Cleaning
- Dataset health score on a 0-100 scale
- Quality flags for missing values, duplicate rows, mixed types, skewness, and other data issues
- One-click data standardization for common spreadsheet problems
- Cleaned CSV export for downstream use

### Product Experience
- Login/signup and Google OAuth support
- MongoDB-backed dataset persistence for logged-in users
- Dashboard, Data Explorer, Visualizer, Reports, and AI Insights pages
- PDF report export with dataset schema, numeric analysis, insights, and quality checks

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
- Analytics: Dedicated JavaScript stats engine
- Backend: Node.js, Express, MongoDB, Mongoose
- Auth: JWT, bcrypt, Google OAuth
- Exports: jsPDF and jspdf-autotable

## Project Structure

```text
data_backend/
  middleware/
  models/
  routes/
  server.js

data_frontend/
  src/
    components/
    context/
    lib/
    pages/
  index.css
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- MongoDB running locally, or a MongoDB Atlas connection string

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
```

Start the backend:

```bash
npm run dev
```

The API runs at:

```text
http://127.0.0.1:5000
```

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

The app runs at:

```text
http://localhost:5173
```

## Available Scripts

Backend:

```bash
npm run dev
npm start
```

Frontend:

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

## Current Notes

- Uploading datasets requires authentication.
- Authenticated datasets are stored in MongoDB with rows, headers, stats, and metadata.
- The frontend production build passes.
- Lint currently reports existing project issues unrelated to the latest auth/branding changes.

## License

MIT - Developed for Advanced Coding Evaluation 1.
