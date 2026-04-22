import { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import localforage from 'localforage';
import { computeAllStats } from '../lib/statsEngine';
import { cleanseDataset } from '../lib/dataCleaner';
import { downloadCSV } from '../lib/csvExport';
import { preprocessCSV, parseCSVLine } from '../lib/csvPreprocessor';

const API_URL = 'http://127.0.0.1:5000/api/datasets';

function getToken() {
  return localStorage.getItem('datalens_token');
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

function parseCSV(text) {
  // Step 1: Pre-process raw text to fix structural column shifting
  // (e.g., unquoted commas in "4,500" or "$95,000" causing row misalignment)
  const fixedText = preprocessCSV(text);

  const lines = fixedText.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error('CSV has no data rows');

  // Step 2: Parse header using robust quoted-field parser
  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());

  // Step 3: Parse data rows
  const rows = lines.slice(1).map(line => {
    const vals = parseCSVLine(line);
    const row = {};
    headers.forEach((h, i) => {
      const raw = (vals[i] ?? '').replace(/^"|"$/g, '').trim();
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
  if (['ADD_DATASET', 'UPDATE_DATASET', 'DELETE_DATASET', 'SET_ACTIVE'].includes(action.type) || 
      (action.type === 'SET_ALL' && action.payload.length > 0)) {
     localforage.setItem('datalens_datasets', nextState.datasets).catch(() => {});
     localforage.setItem('datalens_activeId', nextState.activeId).catch(() => {});
  }
  return nextState;
}

// ─── Context ──────────────────────────────────────────────────────────────────

import { useAuth } from './AuthContext';

const DatasetContext = createContext(null);

export function DatasetProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      // 1. Load local datasets instantly (for guests & offline)
      let localDatasets = [];
      try {
        localDatasets = (await localforage.getItem('datalens_datasets')) || [];
        const localActiveId = await localforage.getItem('datalens_activeId');
        if (isMounted && localDatasets.length > 0) {
          dispatch({ type: 'SET_ALL', payload: localDatasets, activeId: localActiveId });
        }
      } catch { /* ignore */ }

      // 2. Fetch from backend if logged in
      const token = getToken();
      if (!token || !isMounted || !isAuthenticated) return;

      try {
        const res = await fetch(API_URL, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const data = await res.json();

        const remoteDatasets = data.datasets.map(d => ({
          id: d._id, name: d.name, size: d.size, ext: d.ext,
          rowCount: d.rowCount, headers: d.headers, stats: d.stats,
          parseTime: d.parseTime, createdAt: new Date(d.createdAt),
          status: d.rows && d.rows.length > 0 ? 'ready' : 'saved',
          rows: d.rows || [], dbId: d._id,
        }));

        // 3. Sync local-only datasets to backend (uploaded as guest)
        const unsyncedLocal = localDatasets.filter(d => d.status === 'ready' && !d.dbId && d.rows?.length > 0);
        for (const ld of unsyncedLocal) {
          try {
            console.log(`🔄 Syncing local dataset "${ld.name}" to backend...`);
            const syncRes = await fetch(API_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                name: ld.name, size: ld.size, ext: ld.ext,
                rowCount: ld.rowCount, headers: ld.headers,
                stats: ld.stats, parseTime: ld.parseTime, rows: ld.rows,
              }),
            });
            if (syncRes.ok) {
              const saved = await syncRes.json();
              console.log(`✅ Synced "${ld.name}" → ${saved.dataset._id}`);
              // Add it to remoteDatasets so it appears in the final merged list
              remoteDatasets.push({
                ...ld, id: saved.dataset._id, dbId: saved.dataset._id,
              });
            } else {
              console.error(`❌ Failed to sync "${ld.name}":`, await syncRes.text());
              // Keep local version
              remoteDatasets.push(ld);
            }
          } catch (syncErr) {
            console.error(`❌ Network error syncing "${ld.name}":`, syncErr.message);
            remoteDatasets.push(ld);
          }
        }

        if (isMounted && remoteDatasets.length > 0) {
          dispatch({ type: 'SET_ALL', payload: remoteDatasets });
        }
      } catch { /* network error, stick with local */ }
    };
    init();
    return () => { isMounted = false; };
  }, [isAuthenticated]);

  const uploadDataset = useCallback(async (file) => {
    const token = getToken();
    if (!isAuthenticated || !token) {
      throw new Error('Please sign in before uploading datasets.');
    }

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
        parsed = parseCSV(await file.text());
      } else if (ext === 'xlsx' || ext === 'xls') {
        parsed = await parseExcel(await file.arrayBuffer());
      } else {
        throw new Error('Unsupported file type. Use CSV or Excel.');
      }

      const stats = computeAllStats(parsed.headers, parsed.rows);
      const parseTime = Math.round(performance.now() - t0);

      dispatch({
        type: 'UPDATE_DATASET',
        payload: { id, status: 'ready', headers: parsed.headers, rows: parsed.rows, rowCount: parsed.rowCount, stats, parseTime },
      });

      if (token) {
        console.log(`📤 Saving dataset "${name}" to backend (${parsed.rowCount} rows)...`);
        try {
          const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ name, size, ext, rowCount: parsed.rowCount, headers: parsed.headers, stats, parseTime, rows: parsed.rows }),
          });
          if (res.ok) {
            const saved = await res.json();
            console.log(`✅ Dataset saved to DB: ${saved.dataset._id}`);
            dispatch({ type: 'UPDATE_DATASET', payload: { id, dbId: saved.dataset._id } });
          } else {
            const errBody = await res.text();
            console.error(`❌ Backend save failed (${res.status}):`, errBody);
          }
        } catch (fetchErr) {
          console.error('❌ Network error saving dataset:', fetchErr.message);
        }
      }
    } catch (err) {
      dispatch({ type: 'UPDATE_DATASET', payload: { id, status: 'error', error: err.message } });
    }
    return id;
  }, [isAuthenticated]);

  // ─── 1-Click Clean: Standardize the active dataset ────────────────────
  const cleanDataset = useCallback((datasetId) => {
    const ds = state.datasets.find(d => d.id === datasetId);
    if (!ds || !ds.stats || !ds.rows?.length) return null;

    const { cleanedRows, report } = cleanseDataset(ds.headers, ds.rows, ds.stats.columnTypes);
    if (report.totalChanges === 0) return report;

    const newStats = computeAllStats(ds.headers, cleanedRows);
    dispatch({
      type: 'UPDATE_DATASET',
      payload: { id: datasetId, rows: cleanedRows, rowCount: cleanedRows.length, stats: newStats, cleaned: true },
    });
    return report;
  }, [state.datasets]);

  // ─── Export current dataset as CSV ────────────────────────────────────
  const exportDatasetCSV = useCallback((datasetId) => {
    const ds = state.datasets.find(d => d.id === datasetId);
    if (!ds || !ds.rows?.length) return;
    const baseName = ds.name.replace(/\.[^.]+$/, '');
    downloadCSV(ds.headers, ds.rows, `${baseName}-cleaned.csv`);
  }, [state.datasets]);

  const deleteDataset = useCallback(async (id) => {
    const ds = state.datasets.find(d => d.id === id);
    const dbId = ds?.dbId || (ds?.status === 'saved' ? id : null);
    dispatch({ type: 'DELETE_DATASET', payload: id });
    const token = getToken();
    if (token && dbId) {
      fetch(`${API_URL}/${dbId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    }
  }, [state.datasets]);

  const setActive = useCallback((id) => dispatch({ type: 'SET_ACTIVE', payload: id }), []);
  const activeDataset = state.datasets.find(d => d.id === state.activeId) ?? null;

  return (
    <DatasetContext.Provider value={{ ...state, activeDataset, uploadDataset, deleteDataset, setActive, cleanDataset, exportDatasetCSV }}>
      {children}
    </DatasetContext.Provider>
  );
}

export function useDataset() {
  const ctx = useContext(DatasetContext);
  if (!ctx) throw new Error('useDataset must be used inside DatasetProvider');
  return ctx;
}
