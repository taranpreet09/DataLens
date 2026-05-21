// Web Worker for offloading heavy stats computation off the main thread.
// Usage: const worker = new Worker(new URL('./statsEngine.worker.js', import.meta.url), { type: 'module' });
//        worker.postMessage({ headers, rows });
//        worker.onmessage = (e) => { const stats = e.data; };

import { computeAllStats } from './statsEngine';

self.onmessage = function (e) {
  const { headers, rows, existingStats } = e.data;
  try {
    const stats = computeAllStats(headers, rows, existingStats);
    self.postMessage({ success: true, stats });
  } catch (err) {
    self.postMessage({ success: false, error: err.message });
  }
};
