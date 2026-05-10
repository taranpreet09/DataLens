import { useRef, useCallback } from 'react';

/**
 * Hook to compute stats in a Web Worker (off main thread).
 * Falls back to synchronous computation if Workers aren't available.
 *
 * Usage:
 *   const computeStats = useStatsWorker();
 *   const stats = await computeStats(headers, rows);
 */
export function useStatsWorker() {
  const workerRef = useRef(null);

  const computeStats = useCallback((headers, rows) => {
    return new Promise((resolve, reject) => {
      // For small datasets, compute synchronously to avoid Worker overhead
      if (rows.length < 500) {
        import('./statsEngine').then(({ computeAllStats }) => {
          try {
            resolve(computeAllStats(headers, rows));
          } catch (err) {
            reject(err);
          }
        });
        return;
      }

      try {
        // Terminate previous worker if still running
        if (workerRef.current) {
          workerRef.current.terminate();
        }

        const worker = new Worker(
          new URL('./statsEngine.worker.js', import.meta.url),
          { type: 'module' }
        );
        workerRef.current = worker;

        worker.onmessage = (e) => {
          worker.terminate();
          workerRef.current = null;
          if (e.data.success) {
            resolve(e.data.stats);
          } else {
            reject(new Error(e.data.error));
          }
        };

        worker.onerror = (err) => {
          worker.terminate();
          workerRef.current = null;
          // Fallback to synchronous
          import('./statsEngine').then(({ computeAllStats }) => {
            try {
              resolve(computeAllStats(headers, rows));
            } catch (syncErr) {
              reject(syncErr);
            }
          });
        };

        worker.postMessage({ headers, rows });
      } catch {
        // Workers not supported, fallback
        import('./statsEngine').then(({ computeAllStats }) => {
          try {
            resolve(computeAllStats(headers, rows));
          } catch (err) {
            reject(err);
          }
        });
      }
    });
  }, []);

  return computeStats;
}
