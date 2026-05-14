import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logEvent, withCode } from '../services/intelligenceLogger.js';

describe('intelligenceLogger.logEvent', () => {
  let logSpy;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  function emittedPayload() {
    expect(logSpy).toHaveBeenCalledTimes(1);
    return JSON.parse(logSpy.mock.calls[0][0]);
  }

  it('writes a JSON line with ts and service prefix', () => {
    logEvent({ event: 'llm.invoke', outcome: 'success' });
    const payload = emittedPayload();
    expect(payload.service).toBe('intelligence');
    expect(typeof payload.ts).toBe('string');
    expect(() => new Date(payload.ts).toISOString()).not.toThrow();
    expect(payload.event).toBe('llm.invoke');
    expect(payload.outcome).toBe('success');
  });

  it('redacts forbidden keys at the top level', () => {
    logEvent({
      event: 'llm.invoke',
      prompt: 'secret prompt',
      messages: [{ role: 'user', content: 'hi' }],
      responseBody: { text: 'oops' },
      text: 'leaky',
      body: 'also leaky',
    });
    const payload = emittedPayload();
    expect(payload.prompt).toBe('[redacted]');
    expect(payload.messages).toBe('[redacted]');
    expect(payload.responseBody).toBe('[redacted]');
    expect(payload.text).toBe('[redacted]');
    expect(payload.body).toBe('[redacted]');
  });

  it('redacts forbidden keys recursively at any depth', () => {
    logEvent({
      event: 'llm.invoke',
      meta: {
        request: {
          payload: {
            prompt: 'do not leak',
            nested: { messages: ['h', 'i'] },
          },
        },
        list: [{ body: 'still leaky' }, { ok: true }],
      },
    });
    const payload = emittedPayload();
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('do not leak');
    expect(serialized).not.toContain('still leaky');
    expect(payload.meta.request.payload.prompt).toBe('[redacted]');
    expect(payload.meta.request.payload.nested.messages).toBe('[redacted]');
    expect(payload.meta.list[0].body).toBe('[redacted]');
    expect(payload.meta.list[1].ok).toBe(true);
  });

  it('handles circular references without throwing', () => {
    const record = { event: 'llm.invoke' };
    record.self = record;
    expect(() => logEvent(record)).not.toThrow();
    const payload = emittedPayload();
    expect(payload.event).toBe('llm.invoke');
  });

  it('accepts an empty or undefined record', () => {
    logEvent();
    const payload = emittedPayload();
    expect(payload.service).toBe('intelligence');
    expect(typeof payload.ts).toBe('string');
  });
});

describe('intelligenceLogger.withCode', () => {
  it('returns an Error with code and message', () => {
    const err = withCode('BEDROCK_ERROR', 'something failed');
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('BEDROCK_ERROR');
    expect(err.message).toBe('something failed');
  });

  it.each([
    ['BEDROCK_TIMEOUT'],
    ['INTENT_PARSE_ERROR'],
    ['INCOMPLETE_NARRATIVE'],
    ['LLM_RATE_LIMITED'],
    ['PYTHON_UNAVAILABLE'],
  ])('marks %s as retryable=true by default', (code) => {
    expect(withCode(code, 'msg').retryable).toBe(true);
  });

  it.each([
    ['BEDROCK_NOT_CONFIGURED'],
    ['BEDROCK_ERROR'],
    ['TOKEN_BUDGET_EXCEEDED'],
    ['PAYLOAD_TOO_LARGE'],
    ['INVALID_QUESTION_LENGTH'],
    ['UNKNOWN_TOOL'],
    ['INVALID_PARAMETERS'],
    ['UNKNOWN_COLUMN'],
    ['INSUFFICIENT_TEXT_DATA'],
    ['INTELLIGENCE_DISABLED'],
  ])('marks %s as retryable=false by default', (code) => {
    expect(withCode(code, 'msg').retryable).toBe(false);
  });

  it('attaches extra fields to the error', () => {
    const err = withCode('LLM_RATE_LIMITED', 'too many', {
      retryAfterSeconds: 42,
    });
    expect(err.retryAfterSeconds).toBe(42);
    expect(err.retryable).toBe(true);
  });

  it('allows extra to override retryable explicitly', () => {
    const err = withCode('BEDROCK_TIMEOUT', 'timed out', { retryable: false });
    expect(err.retryable).toBe(false);
  });
});
