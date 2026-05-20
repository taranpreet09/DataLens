// Structured logger and error helper for the Intelligence Layer.
//
// Two responsibilities:
//   1. Emit JSON log lines to stdout, with a defensive recursive scrub that
//      strips known prompt/response payload fields at any depth so they
//      cannot leak into operator logs even if a caller forgets.
//   2. Build `Error` objects tagged with the catalogue codes documented in
//      `design.md` § Error Envelope, with a sane default `retryable` flag
//      that callers may override.
//
// The module is intentionally side-effect free at import time and has no
// external dependencies.

const FORBIDDEN_KEYS = new Set([
  'prompt',
  'messages',
  'responseBody',
  'text',
  'body',
]);

const REDACTED_PLACEHOLDER = '[redacted]';

/**
 * Error codes whose default `retryable` flag is `true`. Aligned with
 * design.md § Error Envelope. Callers may override the flag by passing
 * `retryable` in the `extra` argument to `withCode`.
 */
const RETRYABLE_CODES = new Set([
  'LLM_TIMEOUT',
  'INTENT_PARSE_ERROR',
  'INCOMPLETE_NARRATIVE',
  'LLM_RATE_LIMITED',
  'PYTHON_UNAVAILABLE',
]);

/**
 * Recursively scrub forbidden keys from a value, returning a new value of
 * the same shape with every value at a forbidden key replaced by the
 * string `'[redacted]'`.
 *
 * - Plain objects are walked key-by-key.
 * - Arrays are walked element-by-element.
 * - Primitives, Dates, and other non-plain values are returned unchanged.
 * - Circular references are broken by replacing the second visit with
 *   `'[circular]'`, so the scrubbed value is always JSON-safe.
 */
function scrub(value, seen) {
  if (value === null || typeof value !== 'object') return value;

  if (seen.has(value)) return '[circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => scrub(item, seen));
  }

  // Leave non-plain objects (Date, Buffer, etc.) alone — JSON.stringify will
  // serialize them as it sees fit. Walking only plain objects keeps the
  // scrubber predictable.
  const proto = Object.getPrototypeOf(value);
  if (proto !== null && proto !== Object.prototype) {
    return value;
  }

  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) {
      out[key] = REDACTED_PLACEHOLDER;
    } else {
      out[key] = scrub(child, seen);
    }
  }
  return out;
}

/**
 * Emit a single structured log line for the Intelligence Layer.
 *
 * The record is recursively scrubbed of prompt/response payload fields,
 * stamped with a current ISO timestamp and `service: 'intelligence'`, then
 * written via `console.log(JSON.stringify(...))`.
 */
export function logEvent(record) {
  const safe = scrub(record ?? {}, new WeakSet());
  const payload = {
    ts: new Date().toISOString(),
    service: 'intelligence',
    ...(safe && typeof safe === 'object' && !Array.isArray(safe) ? safe : { record: safe }),
  };
  console.log(JSON.stringify(payload));
}

/**
 * Build an `Error` carrying an Intelligence Layer error code.
 *
 * The default `retryable` flag is derived from the catalogue in
 * `design.md`. Callers can override it (or attach any other field) by
 * passing the value in the `extra` argument.
 */
export function withCode(code, message, extra = {}) {
  const err = new Error(message);
  err.code = code;
  err.retryable = RETRYABLE_CODES.has(code);
  if (extra && typeof extra === 'object') {
    for (const [key, value] of Object.entries(extra)) {
      err[key] = value;
    }
  }
  return err;
}
