import { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import localforage from 'localforage';
import { computeAllStats } from '../lib/statsEngine';

const API_URL = 'http://127.0.0.1:5000/api/datasets';

function getToken() {
  return localStorage.getItem('datalens_token');
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error('CSV has no data rows');
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
  const rows = lines.slice(1).map(line => {
    const vals = line.match(/(\".*?\"|[^,]+|(?<=,)(?=,)|(?<=,)$|^(?=,))/g) || [];
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

function baseReducer(state, action) {
  switch (action.type) {
    case 'SET_ALL':
      return { 
        ...state, 
        datasets: action.payload,
        activeId: action.activeId !== undefined ? action.activeId : (state.activeId || (action.payload.length > 0 ? action.payload[0].id : null))
      };
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

function reducer(state, action) {
  const nextState = baseReducer(state, action);
  // Persist to localForage for offline/guest capability
  if (['ADD_DATASET', 'UPDATE_DATASET', 'DELETE_DATASET', 'SET_ACTIVE'].includes(action.type) || 
      (action.type === 'SET_ALL' && action.payload.length > 0)) {
     localforage.setItem('datalens_datasets', nextState.datasets).catch(() => {});
     localforage.setItem('datalens_activeId', nextState.activeId).catch(() => {});
  }
  return nextState;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const DatasetContext = createContext(null);

export function DatasetProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // On app load — fetch saved datasets from localForage, then backend
  useEffect(() => {
    let isMounted = true;
    
    const init = async () => {
      // 1. Load local datasets instantly (for guests & offline)
      try {
        const localDatasets = await localforage.getItem('datalens_datasets');
        const localActiveId = await localforage.getItem('datalens_activeId');
        if (isMounted && localDatasets && localDatasets.length > 0) {
          dispatch({ type: 'SET_ALL', payload: localDatasets, activeId: localActiveId });
        }
      } catch (err) {
        // ignore
      }

      // 2. Fetch from backend if logged in
      const token = getToken();
      if (!token || !isMounted) return;

      fetch(API_URL, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => res.ok ? res.json() : Promise.reject())
        .then(data => {
          if (!isMounted) return;
          const loaded = data.datasets.map(d => ({
            id: d._id,
            name: d.name,
            size: d.size,
            ext: d.ext,
            rowCount: d.rowCount,
            headers: d.headers,
            stats: d.stats,
            parseTime: d.parseTime,
            createdAt: new Date(d.createdAt),
            status: d.rows && d.rows.length > 0 ? 'ready' : 'saved',
            rows: d.rows || [],
          }));
          if (loaded.length > 0) {
            dispatch({ type: 'SET_ALL', payload: loaded });
          }
        })
        .catch(() => {});
    };

    init();
    return () => { isMounted = false; };
  }, []);

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

      // Save data to backend if logged in
      const token = getToken();
      if (token) {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name,
            size,
            ext,
            rowCount: parsed.rowCount,
            headers: parsed.headers,
            stats,
            parseTime,
            rows: parsed.rows,
          }),
        });

        if (res.ok) {
          const saved = await res.json();
          dispatch({
            type: 'UPDATE_DATASET',
            payload: { id, dbId: saved.dataset._id },
          });
        }
      }

    } catch (err) {
      dispatch({ type: 'UPDATE_DATASET', payload: { id, status: 'error', error: err.message } });
    }
    return id;
  }, []);

  const deleteDataset = useCallback(async (id) => {
    const ds = state.datasets.find(d => d.id === id);
    const dbId = ds?.dbId || (ds?.status === 'saved' ? id : null);

    dispatch({ type: 'DELETE_DATASET', payload: id });

    const token = getToken();
    if (token && dbId) {
      fetch(`${API_URL}/${dbId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  }, [state.datasets]);

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