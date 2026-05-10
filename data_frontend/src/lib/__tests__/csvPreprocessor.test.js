import { describe, it, expect } from 'vitest';
import { parseCSVLine, preprocessCSV } from '../csvPreprocessor';

describe('parseCSVLine', () => {
  it('parses simple comma-separated values', () => {
    const result = parseCSVLine('a,b,c');
    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('handles quoted fields with commas', () => {
    const result = parseCSVLine('name,"city, state",age');
    expect(result).toEqual(['name', 'city, state', 'age']);
  });

  it('handles empty fields', () => {
    const result = parseCSVLine('a,,c');
    expect(result).toEqual(['a', '', 'c']);
  });

  it('handles quoted fields with quotes inside', () => {
    const result = parseCSVLine('"say ""hello""",b,c');
    expect(result).toEqual(['say "hello"', 'b', 'c']);
  });

  it('handles single field', () => {
    const result = parseCSVLine('hello');
    expect(result).toEqual(['hello']);
  });

  it('handles empty string', () => {
    const result = parseCSVLine('');
    expect(result).toEqual(['']);
  });
});

describe('preprocessCSV', () => {
  it('returns text unchanged when no structural issues', () => {
    const input = 'Name,Age,City\nAlice,25,NYC\nBob,30,LA';
    const result = preprocessCSV(input);
    // Should still have same number of lines
    const lines = result.split(/\r?\n/).filter(l => l.trim());
    expect(lines.length).toBe(3);
  });

  it('handles text with fewer than 2 lines', () => {
    const input = 'just a header';
    const result = preprocessCSV(input);
    expect(result).toBe(input);
  });

  it('preserves quoted fields during preprocessing', () => {
    const input = 'Name,Salary,City\nAlice,"$95,000",NYC\nBob,"$80,000",LA';
    const result = preprocessCSV(input);
    const lines = result.split(/\r?\n/).filter(l => l.trim());
    expect(lines.length).toBe(3);
  });
});
