/**
 * Tests for services/datasetContext.js
 *
 * fileParser.js is stubbed so tests run without touching the filesystem.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock fileParser before importing the module under test ---
vi.mock('../services/fileParser.js', () => ({
  stratifiedSample: vi.fn(),
}));

import { stratifiedSample } from '../services/fileParser.js';
import { buildDatasetContext } from '../services/datasetContext.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal dataset object with no stats. */
function makeDataset(overrides = {}) {
  return {
    _id: 'ds-001',
    headers: ['id', 'name', 'value'],
    columnTypes: { id: 'number', name: 'string', value: 'number' },
    rowCount: 100,
    semanticTypes: {},
    stats: null,
    ...overrides,
  };
}

/** Build a dataset that has `rows` in memory (no parsedFilePath). */
function makeInMemoryDataset(rows, overrides = {}) {
  return makeDataset({ rows, ...overrides });
}

/** Build a dataset backed by a parsedFilePath. */
function makeFileDataset(parsedFilePath, rowCount = 100, overrides = {}) {
  return makeDataset({ parsedFilePath, rowCount, ...overrides });
}

// ---------------------------------------------------------------------------
// 1. Sample row count never exceeds 10
// ---------------------------------------------------------------------------

describe('buildDatasetContext — sample row count cap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('never returns more than 10 rows even when options request more', async () => {
    // Simulate a file-backed dataset; stratifiedSample returns 50 rows.
    const fakeRows = Array.from({ length: 50 }, (_, i) => ({ id: i }));
    stratifiedSample.mockResolvedValue(fakeRows.slice(0, 10)); // file path enforces cap

    const dataset = makeFileDataset('/some/path.jsonl', 1000);
    const ctx = await buildDatasetContext(dataset, {
      sampleRows: 50,
      maxSampleRows: 50,
    });

    // The hard cap is enforced: n = Math.min(50, 50, 10) = 10
    expect(stratifiedSample).toHaveBeenCalledWith('/some/path.jsonl', 10, 1000);
    expect(ctx.sampleRows.length).toBeLessThanOrEqual(10);
  });

  it('passes n=10 to stratifiedSample when sampleRows and maxSampleRows both exceed 10', async () => {
    stratifiedSample.mockResolvedValue([]);
    const dataset = makeFileDataset('/path.jsonl', 500);
    await buildDatasetContext(dataset, { sampleRows: 100, maxSampleRows: 100 });
    expect(stratifiedSample).toHaveBeenCalledWith('/path.jsonl', 10, 500);
  });

  it('slices in-memory rows to at most 10', async () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ id: i }));
    const dataset = makeInMemoryDataset(rows);
    const ctx = await buildDatasetContext(dataset, {
      sampleRows: 50,
      maxSampleRows: 50,
    });
    expect(ctx.sampleRows.length).toBeLessThanOrEqual(10);
  });

  it('returns empty sampleRows when dataset has neither parsedFilePath nor rows', async () => {
    const dataset = makeDataset({ rows: null, parsedFilePath: undefined });
    const ctx = await buildDatasetContext(dataset);
    expect(ctx.sampleRows).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2. Numeric stats trimmed to top 12 by ascending nullPct
// ---------------------------------------------------------------------------

describe('buildDatasetContext — numeric stats trimming', () => {
  it('keeps only the 12 columns with the lowest nullPct', async () => {
    // Build 15 numeric columns with distinct nullPct values.
    const numericStats = {};
    for (let i = 0; i < 15; i++) {
      numericStats[`col${i}`] = {
        mean: i,
        median: i,
        stdDev: 1,
        min: 0,
        max: i * 2,
        nullPct: i * 0.05, // col0 = 0%, col1 = 5%, ..., col14 = 70%
      };
    }

    const dataset = makeInMemoryDataset([], {
      stats: { numericStats },
    });
    const ctx = await buildDatasetContext(dataset);

    const keys = Object.keys(ctx.numericStats);
    expect(keys.length).toBe(12);

    // The 12 kept columns should be col0..col11 (lowest nullPct).
    for (let i = 0; i < 12; i++) {
      expect(keys).toContain(`col${i}`);
    }
    // col12, col13, col14 should be excluded.
    expect(keys).not.toContain('col12');
    expect(keys).not.toContain('col13');
    expect(keys).not.toContain('col14');
  });

  it('keeps only the six summary fields per numeric column', async () => {
    const numericStats = {
      revenue: {
        mean: 100,
        median: 90,
        stdDev: 20,
        min: 10,
        max: 500,
        nullPct: 0.02,
        // Extra fields that should be stripped:
        histogram: [1, 2, 3],
        skewness: 0.5,
      },
    };
    const dataset = makeInMemoryDataset([], { stats: { numericStats } });
    const ctx = await buildDatasetContext(dataset);

    expect(ctx.numericStats.revenue).toEqual({
      mean: 100,
      median: 90,
      stdDev: 20,
      min: 10,
      max: 500,
      nullPct: 0.02,
    });
    expect(ctx.numericStats.revenue.histogram).toBeUndefined();
    expect(ctx.numericStats.revenue.skewness).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 3. Categorical stats trimmed to top 8 by descending cardinality
// ---------------------------------------------------------------------------

describe('buildDatasetContext — categorical stats trimming', () => {
  it('keeps only the 8 columns with the highest cardinality', async () => {
    // Build 10 categorical columns with distinct cardinality values.
    const categoricalStats = {};
    for (let i = 0; i < 10; i++) {
      categoricalStats[`cat${i}`] = {
        cardinality: i + 1, // cat0=1, cat1=2, ..., cat9=10
        topValues: [`v${i}`],
        nullPct: 0,
      };
    }

    const dataset = makeInMemoryDataset([], { stats: { categoricalStats } });
    const ctx = await buildDatasetContext(dataset);

    const keys = Object.keys(ctx.categoricalStats);
    expect(keys.length).toBe(8);

    // The 8 kept columns should be cat9..cat2 (highest cardinality).
    for (let i = 2; i < 10; i++) {
      expect(keys).toContain(`cat${i}`);
    }
    // cat0 (cardinality=1) and cat1 (cardinality=2) should be excluded.
    expect(keys).not.toContain('cat0');
    expect(keys).not.toContain('cat1');
  });

  it('keeps only cardinality, topValues, nullPct per categorical column', async () => {
    const categoricalStats = {
      status: {
        cardinality: 5,
        topValues: ['active', 'inactive'],
        nullPct: 0.01,
        // Extra fields that should be stripped:
        distribution: { active: 80, inactive: 20 },
      },
    };
    const dataset = makeInMemoryDataset([], { stats: { categoricalStats } });
    const ctx = await buildDatasetContext(dataset);

    expect(ctx.categoricalStats.status).toEqual({
      cardinality: 5,
      topValues: ['active', 'inactive'],
      nullPct: 0.01,
    });
    expect(ctx.categoricalStats.status.distribution).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 4. Correlation insights trimmed to top 8 by |r|, sorted descending
// ---------------------------------------------------------------------------

describe('buildDatasetContext — correlation insights', () => {
  it('returns top 8 pairs sorted by |r| descending', async () => {
    // Build a 5×5 correlation matrix → 10 off-diagonal pairs.
    const cols = ['a', 'b', 'c', 'd', 'e'];
    const correlationMatrix = {};
    // Assign r values: pair (a,b)=0.95, (a,c)=0.85, (a,d)=0.75, (a,e)=0.65,
    //                  (b,c)=0.55, (b,d)=0.45, (b,e)=0.35, (c,d)=0.25,
    //                  (c,e)=0.15, (d,e)=0.05
    const rValues = {
      'a-b': 0.95, 'a-c': 0.85, 'a-d': 0.75, 'a-e': 0.65,
      'b-c': 0.55, 'b-d': 0.45, 'b-e': 0.35, 'c-d': 0.25,
      'c-e': 0.15, 'd-e': 0.05,
    };

    for (const col of cols) {
      correlationMatrix[col] = {};
      for (const other of cols) {
        if (col === other) {
          correlationMatrix[col][other] = 1;
        } else {
          const key = [col, other].sort().join('-');
          correlationMatrix[col][other] = rValues[key] ?? 0;
        }
      }
    }

    const dataset = makeInMemoryDataset([], {
      stats: { correlationMatrix },
    });
    const ctx = await buildDatasetContext(dataset);

    expect(ctx.correlationInsights.length).toBe(8);

    // Verify sorted descending by |r|.
    for (let i = 1; i < ctx.correlationInsights.length; i++) {
      expect(Math.abs(ctx.correlationInsights[i - 1].r)).toBeGreaterThanOrEqual(
        Math.abs(ctx.correlationInsights[i].r)
      );
    }

    // The weakest pair (d,e) with r=0.05 should be excluded.
    const pairs = ctx.correlationInsights.map((ci) => ci.pair.join('-'));
    expect(pairs).not.toContain('d-e');

    // The strongest pair (a,b) with r=0.95 should be first.
    expect(ctx.correlationInsights[0].pair).toEqual(['a', 'b']);
    expect(ctx.correlationInsights[0].r).toBe(0.95);
  });

  it('labels correlations correctly', async () => {
    const correlationMatrix = {
      x: { x: 1, y: 0.8, z: -0.5, w: 0.2 },
      y: { x: 0.8, y: 1, z: -0.3, w: 0.1 },
      z: { x: -0.5, y: -0.3, z: 1, w: -0.6 },
      w: { x: 0.2, y: 0.1, z: -0.6, w: 1 },
    };
    const dataset = makeInMemoryDataset([], { stats: { correlationMatrix } });
    const ctx = await buildDatasetContext(dataset);

    const byPair = {};
    for (const ci of ctx.correlationInsights) {
      byPair[ci.pair.join('-')] = ci;
    }

    // |r|=0.8 → strong positive
    expect(byPair['x-y'].label).toBe('strong positive');
    // |r|=0.5 → moderate negative
    expect(byPair['x-z'].label).toBe('moderate negative');
    // |r|=0.6 → moderate negative
    expect(byPair['w-z'].label).toBe('moderate negative');
    // |r|=0.2 → weak positive
    expect(byPair['w-x'].label).toBe('weak positive');
  });

  it('returns empty array when correlationMatrix is absent', async () => {
    const dataset = makeInMemoryDataset([], { stats: {} });
    const ctx = await buildDatasetContext(dataset);
    expect(ctx.correlationInsights).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 5. PII columns are redacted in sampleRows
// ---------------------------------------------------------------------------

describe('buildDatasetContext — PII redaction', () => {
  it('redacts columns named "email" in sample rows', async () => {
    const rows = [
      { id: 1, email: 'alice@example.com', score: 42 },
      { id: 2, email: 'bob@example.com', score: 99 },
    ];
    const dataset = makeInMemoryDataset(rows, {
      semanticTypes: { email: { semanticType: 'email' } },
    });
    const ctx = await buildDatasetContext(dataset);

    for (const row of ctx.sampleRows) {
      expect(row.email).toBe('[REDACTED]');
    }
    // Non-PII columns pass through.
    expect(ctx.sampleRows[0].id).toBe(1);
    expect(ctx.sampleRows[0].score).toBe(42);
  });

  it('redacts via column-name heuristic (no semanticTypes needed)', async () => {
    const rows = [{ phone: '555-1234', name: 'Alice' }];
    const dataset = makeInMemoryDataset(rows, { semanticTypes: {} });
    const ctx = await buildDatasetContext(dataset);
    expect(ctx.sampleRows[0].phone).toBe('[REDACTED]');
    expect(ctx.sampleRows[0].name).toBe('Alice');
  });
});

// ---------------------------------------------------------------------------
// 6. Long strings truncated to 200 chars + ellipsis
// ---------------------------------------------------------------------------

describe('buildDatasetContext — string truncation', () => {
  it('truncates string cells longer than 200 characters', async () => {
    const longString = 'x'.repeat(300);
    const rows = [{ id: 1, notes: longString }];
    const dataset = makeInMemoryDataset(rows);
    const ctx = await buildDatasetContext(dataset);

    const notes = ctx.sampleRows[0].notes;
    expect(notes.length).toBe(201); // 200 chars + '…'
    expect(notes.endsWith('…')).toBe(true);
  });

  it('leaves strings at or below 200 characters unchanged', async () => {
    const exactString = 'y'.repeat(200);
    const rows = [{ id: 1, notes: exactString }];
    const dataset = makeInMemoryDataset(rows);
    const ctx = await buildDatasetContext(dataset);

    expect(ctx.sampleRows[0].notes).toBe(exactString);
    expect(ctx.sampleRows[0].notes.length).toBe(200);
  });

  it('does not truncate numeric or null values', async () => {
    const rows = [{ id: 1, value: 3.14, empty: null }];
    const dataset = makeInMemoryDataset(rows);
    const ctx = await buildDatasetContext(dataset);

    expect(ctx.sampleRows[0].value).toBe(3.14);
    expect(ctx.sampleRows[0].empty).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 7. Missing dataset.stats does not crash; returns safe defaults
// ---------------------------------------------------------------------------

describe('buildDatasetContext — missing stats safe defaults', () => {
  it('returns safe defaults when dataset.stats is null', async () => {
    const dataset = makeDataset({ stats: null });
    const ctx = await buildDatasetContext(dataset);

    expect(ctx.qualityFlags).toEqual({ qualityScore: 0, flags: [] });
    expect(ctx.numericStats).toEqual({});
    expect(ctx.categoricalStats).toEqual({});
    expect(ctx.timeSeries).toBeNull();
    expect(ctx.correlationInsights).toEqual([]);
    expect(ctx.sampleRows).toEqual([]);
  });

  it('returns safe defaults when dataset.stats is undefined', async () => {
    const dataset = makeDataset();
    delete dataset.stats;
    const ctx = await buildDatasetContext(dataset);

    expect(ctx.qualityFlags).toEqual({ qualityScore: 0, flags: [] });
    expect(ctx.numericStats).toEqual({});
    expect(ctx.categoricalStats).toEqual({});
    expect(ctx.timeSeries).toBeNull();
    expect(ctx.correlationInsights).toEqual([]);
  });

  it('returns safe defaults when dataset.stats is an empty object', async () => {
    const dataset = makeDataset({ stats: {} });
    const ctx = await buildDatasetContext(dataset);

    expect(ctx.qualityFlags).toEqual({ qualityScore: 0, flags: [] });
    expect(ctx.numericStats).toEqual({});
    expect(ctx.categoricalStats).toEqual({});
    expect(ctx.timeSeries).toBeNull();
    expect(ctx.correlationInsights).toEqual([]);
  });

  it('populates schema from dataset top-level fields', async () => {
    const dataset = makeDataset({
      headers: ['a', 'b'],
      columnTypes: { a: 'number', b: 'string' },
      rowCount: 42,
      stats: null,
    });
    const ctx = await buildDatasetContext(dataset);

    expect(ctx.schema).toEqual({
      columnTypes: { a: 'number', b: 'string' },
      headers: ['a', 'b'],
      rowCount: 42,
    });
  });

  it('includes meta with tokenBudget and datasetId', async () => {
    const dataset = makeDataset({ _id: 'abc123', stats: null });
    const ctx = await buildDatasetContext(dataset);

    expect(ctx.meta.datasetId).toBe('abc123');
    expect(typeof ctx.meta.tokenBudget).toBe('number');
    expect(ctx.meta.tokenBudget).toBeGreaterThan(0);
  });
});
