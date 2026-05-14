import { describe, it, expect } from 'vitest';
import {
  redact,
  truncateString,
  estimatePayloadBytes,
} from '../services/redactor.js';

describe('redactor.redact', () => {
  it('redacts columns whose semanticType is email, phone, or creditcard', () => {
    const rows = [
      { id: 1, contact: 'alice@example.com', mobile: '555-1234', card: '4111 1111 1111 1111', amount: 99.5 },
      { id: 2, contact: 'bob@example.com', mobile: '555-9999', card: '5500 0000 0000 0004', amount: 12.0 },
    ];
    const semanticTypes = {
      id: { semanticType: null },
      contact: { semanticType: 'email' },
      mobile: { semanticType: 'phone' },
      card: { semanticType: 'creditcard' },
      amount: { semanticType: null },
    };

    const out = redact(rows, semanticTypes);

    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      id: 1,
      contact: '[REDACTED]',
      mobile: '[REDACTED]',
      card: '[REDACTED]',
      amount: 99.5,
    });
    expect(out[1].contact).toBe('[REDACTED]');
    expect(out[1].mobile).toBe('[REDACTED]');
    expect(out[1].card).toBe('[REDACTED]');
    // Non-PII passes through.
    expect(out[1].id).toBe(2);
    expect(out[1].amount).toBe(12.0);
  });

  it('redacts via column-name heuristic regardless of semanticType confidence', () => {
    const rows = [
      {
        username: 'alice',
        email_address: 'alice@example.com',
        mobile_number: '555-1234',
        ssn: '123-45-6789',
        tax_id: 'TX-001',
        cvv: '123',
        account_no: 'ACC-9001',
        notes: 'hello',
      },
    ];
    // No semantic types provided — heuristic alone must trigger redaction.
    const out = redact(rows, {});

    expect(out[0].username).toBe('alice');
    expect(out[0].notes).toBe('hello');
    expect(out[0].email_address).toBe('[REDACTED]');
    expect(out[0].mobile_number).toBe('[REDACTED]');
    expect(out[0].ssn).toBe('[REDACTED]');
    expect(out[0].tax_id).toBe('[REDACTED]');
    expect(out[0].cvv).toBe('[REDACTED]');
    expect(out[0].account_no).toBe('[REDACTED]');
  });

  it('matches the heuristic case-insensitively and as a substring', () => {
    const rows = [{ CustomerEmail: 'a@b.co', CellPhone: '555', other: 'ok' }];
    const out = redact(rows, {});
    expect(out[0].CustomerEmail).toBe('[REDACTED]');
    expect(out[0].CellPhone).toBe('[REDACTED]');
    expect(out[0].other).toBe('ok');
  });

  it('passes non-PII columns through unchanged', () => {
    const rows = [
      { city: 'Seattle', population: 750000, isCapital: false },
      { city: 'Olympia', population: 55000, isCapital: true },
    ];
    const out = redact(rows, {
      city: { semanticType: null },
      population: { semanticType: null },
      isCapital: { semanticType: null },
    });
    expect(out).toEqual(rows);
    // New objects, not the same references.
    expect(out[0]).not.toBe(rows[0]);
  });

  it('replaces null and undefined cells in PII columns with [REDACTED]', () => {
    const rows = [
      { email: null, name: 'Alice' },
      { email: undefined, name: 'Bob' },
      { email: 'real@example.com', name: 'Carol' },
    ];
    const out = redact(rows, { email: { semanticType: 'email' } });
    expect(out[0].email).toBe('[REDACTED]');
    expect(out[1].email).toBe('[REDACTED]');
    expect(out[2].email).toBe('[REDACTED]');
    expect(out[0].name).toBe('Alice');
  });

  it('preserves number cells in non-PII columns', () => {
    const rows = [
      { age: 30, score: 0, ratio: -1.5 },
      { age: null, score: 42, ratio: 3.14 },
    ];
    const out = redact(rows, {});
    expect(out[0]).toEqual({ age: 30, score: 0, ratio: -1.5 });
    expect(out[1]).toEqual({ age: null, score: 42, ratio: 3.14 });
  });

  it('handles rows with inconsistent shapes by taking the union of all keys', () => {
    const rows = [
      { id: 1, name: 'Alice' },
      { id: 2, email: 'bob@example.com' }, // PII column appears only on the second row
      { id: 3, name: 'Carol', email: 'carol@example.com' },
    ];
    const out = redact(rows, { email: { semanticType: 'email' } });
    expect(out[0]).toEqual({ id: 1, name: 'Alice' });
    expect(out[1]).toEqual({ id: 2, email: '[REDACTED]' });
    expect(out[2]).toEqual({ id: 3, name: 'Carol', email: '[REDACTED]' });
  });

  it('does not mutate the input rows or semanticTypes', () => {
    const rows = [{ email: 'alice@example.com', name: 'Alice' }];
    const semanticTypes = { email: { semanticType: 'email' } };
    const rowsSnapshot = JSON.parse(JSON.stringify(rows));
    const typesSnapshot = JSON.parse(JSON.stringify(semanticTypes));

    const out = redact(rows, semanticTypes);

    expect(rows).toEqual(rowsSnapshot);
    expect(semanticTypes).toEqual(typesSnapshot);
    expect(out[0]).not.toBe(rows[0]);
  });

  it('returns an empty array when rows is not an array', () => {
    expect(redact(null, {})).toEqual([]);
    expect(redact(undefined, {})).toEqual([]);
  });

  it('treats missing semanticTypes argument as no semantic info', () => {
    const rows = [{ email: 'alice@example.com', name: 'Alice' }];
    // Heuristic still triggers on the `email` column name.
    const out = redact(rows);
    expect(out[0].email).toBe('[REDACTED]');
    expect(out[0].name).toBe('Alice');
  });
});

describe('redactor.truncateString', () => {
  it('returns the string unchanged when length is below max', () => {
    expect(truncateString('hello', 200)).toBe('hello');
  });

  it('returns the string unchanged at exactly the max boundary (200 chars)', () => {
    const s = 'a'.repeat(200);
    const out = truncateString(s, 200);
    expect(out).toBe(s);
    expect(out.length).toBe(200);
  });

  it('truncates and appends an ellipsis when above the boundary (201 chars)', () => {
    const s = 'a'.repeat(201);
    const out = truncateString(s, 200);
    expect(out).toBe('a'.repeat(200) + '…');
    expect(out.length).toBe(201);
    expect(out.endsWith('…')).toBe(true);
  });

  it('uses 200 as the default max', () => {
    const s = 'b'.repeat(250);
    expect(truncateString(s)).toBe('b'.repeat(200) + '…');
  });

  it('returns non-string values unchanged', () => {
    expect(truncateString(42)).toBe(42);
    expect(truncateString(null)).toBe(null);
    expect(truncateString(undefined)).toBe(undefined);
    const obj = { a: 1 };
    expect(truncateString(obj)).toBe(obj);
  });

  it('respects a custom max', () => {
    expect(truncateString('hello world', 5)).toBe('hello…');
    expect(truncateString('hi', 5)).toBe('hi');
  });
});

describe('redactor.estimatePayloadBytes', () => {
  it('returns the utf-8 byte size of JSON-stringified ASCII', () => {
    expect(estimatePayloadBytes({ a: 1 })).toBe(Buffer.byteLength('{"a":1}', 'utf8'));
    expect(estimatePayloadBytes('hello')).toBe(Buffer.byteLength('"hello"', 'utf8'));
  });

  it('counts multi-byte characters correctly for unicode strings', () => {
    // The ellipsis '…' is 3 bytes in utf-8; '🚀' is 4 bytes.
    const value = { msg: 'hi…', emoji: '🚀' };
    const expected = Buffer.byteLength(JSON.stringify(value), 'utf8');
    expect(estimatePayloadBytes(value)).toBe(expected);
    // Sanity: byte length exceeds character length for unicode content.
    expect(expected).toBeGreaterThan(JSON.stringify(value).length);
  });

  it('handles arrays and nested structures', () => {
    const value = [{ a: 1 }, { b: 'two' }, { c: [3, 4, 5] }];
    expect(estimatePayloadBytes(value)).toBe(
      Buffer.byteLength(JSON.stringify(value), 'utf8')
    );
  });
});
