import { createContext, useContext, useReducer, useCallback } from 'react';
import { computeAllStats } from '../lib/statsEngine';

// ─── Parsing ──────────────────────────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error('CSV has no data rows');
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
  const rows = lines.slice(1).map(line => {
    const vals = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$|^(?=,))/g) || [];
    const row = {};
    headers.forEach((h, i) => {
      const raw = (vals[i] || '').replace(/^"|"$/g, '').trim();
      const num = Number(raw);
      row[h] = raw === '' ? null : isNaN(num) ? raw : num;
    });
    return row;
  }).filter(row => Object.values(row).some(v => v !== null && v !== ''));
  return { headers, rows, rowCount: rows.length };
}

async function parseExcel(buffer) {
  try {
    const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs');
    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (raw.length < 2) throw new Error('Sheet has no data');
    const headers = raw[0].map(h => String(h).trim());
    const rows = raw.slice(1).map(r => {
      const row = {};
      headers.forEach((h, i) => {
        const val = r[i] === undefined || r[i] === '' ? null : r[i];
        row[h] = val;
      });
      return row;
    }).filter(row => Object.values(row).some(v => v !== null && v !== ''));
    return { headers, rows, rowCount: rows.length };
  } catch {
    throw new Error('Could not parse Excel file. Try converting to CSV.');
  }
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

const initialState = { datasets: [], activeId: null };

function reducer(state, action) {
  switch (action.type) {
    case 'ADD_DATASET':
      return { ...state, datasets: [...state.datasets, action.payload], activeId: action.payload.id };
    case 'SET_ACTIVE':
      return { ...state, activeId: action.payload };
    case 'UPDATE_DATASET':
      return {
        ...state,
        datasets: state.datasets.map(d => d.id === action.payload.id ? { ...d, ...action.payload } : d),
      };
    case 'DELETE_DATASET': {
      const remaining = state.datasets.filter(d => d.id !== action.payload);
      return { datasets: remaining, activeId: remaining[0]?.id ?? null };
    }
    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const DatasetContext = createContext(null);

export function DatasetProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const uploadDataset = useCallback(async (file) => {
    const id = `ds-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const name = file.name;
    const size = file.size;
    const ext = name.split('.').pop().toLowerCase();

    dispatch({
      type: 'ADD_DATASET',
      payload: { id, name, size, ext, status: 'processing', createdAt: new Date(), rows: [], headers: [], stats: null },
    });

    try {
      const t0 = performance.now();
      let parsed;
      if (ext === 'csv') {
        const text = await file.text();
        parsed = parseCSV(text);
      } else if (ext === 'xlsx' || ext === 'xls') {
        const buffer = await file.arrayBuffer();
        parsed = await parseExcel(buffer);
      } else {
        throw new Error('Unsupported file type. Use CSV or Excel.');
      }

      const stats = computeAllStats(parsed.headers, parsed.rows);
      const parseTime = Math.round(performance.now() - t0);

      dispatch({
        type: 'UPDATE_DATASET',
        payload: {
          id,
          status: 'ready',
          headers: parsed.headers,
          rows: parsed.rows,
          rowCount: parsed.rowCount,
          stats,
          parseTime,
        },
      });
    } catch (err) {
      dispatch({ type: 'UPDATE_DATASET', payload: { id, status: 'error', error: err.message } });
    }
    return id;
  }, []);

  const deleteDataset = useCallback((id) => dispatch({ type: 'DELETE_DATASET', payload: id }), []);
  const setActive = useCallback((id) => dispatch({ type: 'SET_ACTIVE', payload: id }), []);
  const activeDataset = state.datasets.find(d => d.id === state.activeId) ?? null;

  return (
    <DatasetContext.Provider value={{ ...state, activeDataset, uploadDataset, deleteDataset, setActive }}>
      {children}
    </DatasetContext.Provider>
  );
}

export function useDataset() {
  const ctx = useContext(DatasetContext);
  if (!ctx) throw new Error('useDataset must be used inside DatasetProvider');
  return ctx;
}