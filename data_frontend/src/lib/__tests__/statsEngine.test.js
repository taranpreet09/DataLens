import { describe, it, expect } from 'vitest';
import { computeAllStats } from '../statsEngine';

describe('computeAllStats', () => {
  const headers = ['Name', 'Age', 'Score', 'Grade'];
  const rows = [
    { Name: 'Alice', Age: 25, Score: 88, Grade: 'A' },
    { Name: 'Bob', Age: 30, Score: 72, Grade: 'B' },
    { Name: 'Charlie', Age: 22, Score: 95, Grade: 'A' },
    { Name: 'Diana', Age: 28, Score: 60, Grade: 'C' },
    { Name: 'Eve', Age: 35, Score: 85, Grade: 'B' },
  ];

  it('returns an object with expected top-level keys', () => {
    const stats = computeAllStats(headers, rows);
    expect(stats).toHaveProperty('rowCount', 5);
    expect(stats).toHaveProperty('columnTypes');
    expect(stats).toHaveProperty('columnBasics');
    expect(stats).toHaveProperty('numericStats');
    expect(stats).toHaveProperty('categoricalStats');
    expect(stats).toHaveProperty('qualityScore');
    expect(stats).toHaveProperty('qualityFlags');
    expect(stats).toHaveProperty('headers');
  });

  it('detects column types correctly', () => {
    const stats = computeAllStats(headers, rows);
    expect(stats.columnTypes.Age).toBe('numeric');
    expect(stats.columnTypes.Score).toBe('numeric');
    expect(stats.columnTypes.Grade).toBe('categorical');
    // Name could be text or categorical depending on uniqueness
    expect(['text', 'categorical']).toContain(stats.columnTypes.Name);
  });

  it('computes numeric stats for numeric columns', () => {
    const stats = computeAllStats(headers, rows);
    const ageStats = stats.numericStats.Age;
    expect(ageStats).toBeDefined();
    expect(ageStats.mean).toBeCloseTo(28, 0);
    expect(ageStats.min).toBe(22);
    expect(ageStats.max).toBe(35);
  });

  it('computes categorical stats for categorical columns', () => {
    const stats = computeAllStats(headers, rows);
    const gradeStats = stats.categoricalStats.Grade;
    expect(gradeStats).toBeDefined();
    expect(gradeStats.cardinality).toBe(3); // A, B, C
  });

  it('tracks null counts in columnBasics', () => {
    const rowsWithNulls = [
      { Name: 'Alice', Age: 25, Score: 88, Grade: 'A' },
      { Name: 'Bob', Age: null, Score: 72, Grade: 'B' },
      { Name: null, Age: 22, Score: null, Grade: 'A' },
      { Name: 'Diana', Age: 28, Score: 60, Grade: null },
      { Name: 'Eve', Age: 35, Score: 85, Grade: 'B' },
    ];
    const stats = computeAllStats(headers, rowsWithNulls);
    expect(stats.columnBasics.Age.nullCount).toBe(1);
    expect(stats.columnBasics.Score.nullCount).toBe(1);
    expect(stats.columnBasics.Grade.nullCount).toBe(1);
  });

  it('produces a quality score between 0 and 100', () => {
    const stats = computeAllStats(headers, rows);
    expect(stats.qualityScore).toBeGreaterThanOrEqual(0);
    expect(stats.qualityScore).toBeLessThanOrEqual(100);
  });

  it('handles empty dataset gracefully', () => {
    const stats = computeAllStats(headers, []);
    expect(stats.rowCount).toBe(0);
  });

  it('handles single-row dataset', () => {
    const stats = computeAllStats(headers, [rows[0]]);
    expect(stats.rowCount).toBe(1);
    // With only 1 row, numericStats skips columns (needs >= 2 values)
    expect(stats.numericColumns).toContain('Age');
  });

  it('computes correlation matrix for numeric columns', () => {
    const stats = computeAllStats(headers, rows);
    expect(stats.correlationMatrix).toBeDefined();
    // correlationMatrix is an object keyed by column names
    expect(typeof stats.correlationMatrix).toBe('object');
  });

  it('identifies numeric columns', () => {
    const stats = computeAllStats(headers, rows);
    expect(stats.numericColumns).toContain('Age');
    expect(stats.numericColumns).toContain('Score');
    expect(stats.numericColumns).not.toContain('Grade');
  });
});
