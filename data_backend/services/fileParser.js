import fs from 'fs';
import { parse } from 'csv-parse';
import path from 'path';
import { PARSED_DIR } from '../config/storage.js';

/**
 * Stream-parse a CSV file. Handles files of any size without loading into memory.
 * Returns headers, rowCount, and writes parsed rows to a JSON Lines file on disk.
 *
 * @param {string} filePath - Path to the uploaded CSV file
 * @param {string} datasetId - Unique dataset ID for naming the output file
 * @param {function} onProgress - Callback (rowsProcessed) for progress updates
 * @returns {{ headers, rowCount, parsedFilePath, sampleRows }}
 */
export async function streamParseCSV(filePath, datasetId, onProgress = null) {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(PARSED_DIR, `${datasetId}.jsonl`);
    const writeStream = fs.createWriteStream(outputPath);

    let headers = null;
    let rowCount = 0;
    const sampleRows = []; // Keep first 1000 rows in memory for instant preview
    const SAMPLE_SIZE = 1000;

    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      cast: (value) => {
        if (value === '') return null;
        const num = Number(value);
        return isNaN(num) ? value : num;
      },
    });

    parser.on('readable', () => {
      let record;
      while ((record = parser.read()) !== null) {
        if (!headers) {
          headers = Object.keys(record);
        }

        // Write to disk as JSON Lines
        writeStream.write(JSON.stringify(record) + '\n');

        // Keep sample in memory
        if (rowCount < SAMPLE_SIZE) {
          sampleRows.push(record);
        }

        rowCount++;

        // Progress callback every 5000 rows
        if (onProgress && rowCount % 5000 === 0) {
          onProgress(rowCount);
        }
      }
    });

    parser.on('error', (err) => {
      writeStream.end();
      reject(new Error(`CSV parse error: ${err.message}`));
    });

    parser.on('end', () => {
      writeStream.end(() => {
        resolve({
          headers,
          rowCount,
          parsedFilePath: outputPath,
          sampleRows,
        });
      });
    });

    // Pipe the file through the parser with backpressure handling
    const readStream = fs.createReadStream(filePath, { highWaterMark: 64 * 1024 });
    readStream.pipe(parser);

    readStream.on('error', (err) => {
      reject(new Error(`File read error: ${err.message}`));
    });
  });
}

/**
 * Read a page of rows from a parsed JSONL file.
 * Efficient for large datasets — only reads the lines needed.
 *
 * @param {string} parsedFilePath - Path to the .jsonl file
 * @param {number} page - 1-indexed page number
 * @param {number} limit - Rows per page
 * @param {object} options - { filter, sort }
 * @returns {{ rows, page, limit, total }}
 */
export async function readRowsPage(parsedFilePath, page = 1, limit = 50, options = {}) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(parsedFilePath)) {
      return reject(new Error('Parsed data file not found'));
    }

    const skip = (page - 1) * limit;
    const rows = [];
    let lineIndex = 0;
    let total = 0;

    const rl = fs.createReadStream(parsedFilePath, { encoding: 'utf-8' });
    let buffer = '';

    rl.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete last line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;
        total++;

        if (lineIndex >= skip && rows.length < limit) {
          try {
            rows.push(JSON.parse(line));
          } catch {
            // Skip malformed lines
          }
        }
        lineIndex++;
      }
    });

    rl.on('end', () => {
      // Process remaining buffer
      if (buffer.trim()) {
        total++;
        if (lineIndex >= skip && rows.length < limit) {
          try {
            rows.push(JSON.parse(buffer));
          } catch {
            // Skip
          }
        }
      }
      resolve({ rows, page, limit, total });
    });

    rl.on('error', reject);
  });
}

/**
 * Read ALL rows from a parsed JSONL file (for stats computation).
 * For very large files, use sampling instead.
 *
 * @param {string} parsedFilePath
 * @param {number} maxRows - Maximum rows to read (0 = all)
 * @returns {Array}
 */
export async function readAllRows(parsedFilePath, maxRows = 0) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(parsedFilePath)) {
      return reject(new Error('Parsed data file not found'));
    }

    const rows = [];
    let buffer = '';

    const rl = fs.createReadStream(parsedFilePath, { encoding: 'utf-8' });

    rl.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        if (maxRows > 0 && rows.length >= maxRows) {
          rl.destroy();
          return;
        }
        try {
          rows.push(JSON.parse(line));
        } catch {
          // Skip
        }
      }
    });

    rl.on('end', () => {
      if (buffer.trim() && (maxRows === 0 || rows.length < maxRows)) {
        try {
          rows.push(JSON.parse(buffer));
        } catch {
          // Skip
        }
      }
      resolve(rows);
    });

    rl.on('close', () => resolve(rows));
    rl.on('error', reject);
  });
}

/**
 * Stratified sampling: pick evenly-spaced rows from a JSONL file.
 * Useful for getting a representative sample of very large datasets.
 *
 * @param {string} parsedFilePath
 * @param {number} sampleSize - Number of rows to sample
 * @param {number} totalRows - Total row count (from metadata)
 * @returns {Array}
 */
export async function stratifiedSample(parsedFilePath, sampleSize = 5000, totalRows = 0) {
  if (!totalRows || totalRows <= sampleSize) {
    return readAllRows(parsedFilePath, sampleSize);
  }

  const step = Math.floor(totalRows / sampleSize);
  const targetIndices = new Set();
  for (let i = 0; i < sampleSize; i++) {
    targetIndices.add(i * step);
  }

  return new Promise((resolve, reject) => {
    const rows = [];
    let lineIndex = 0;
    let buffer = '';

    const rl = fs.createReadStream(parsedFilePath, { encoding: 'utf-8' });

    rl.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) { continue; }
        if (targetIndices.has(lineIndex)) {
          try {
            rows.push(JSON.parse(line));
          } catch {
            // Skip
          }
        }
        lineIndex++;
        if (rows.length >= sampleSize) {
          rl.destroy();
          return;
        }
      }
    });

    rl.on('end', () => resolve(rows));
    rl.on('close', () => resolve(rows));
    rl.on('error', reject);
  });
}

/**
 * Delete parsed data file when a dataset is removed.
 */
export function deleteParsedFile(datasetId) {
  const filePath = path.join(PARSED_DIR, `${datasetId}.jsonl`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
