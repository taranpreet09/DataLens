/**
 * Gemini Client — drop-in replacement for bedrockClient.
 *
 * Uses Google's Generative AI SDK (Gemini) instead of AWS Bedrock.
 * Maintains the same `invokeModel` interface so all callers work unchanged.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { logEvent, withCode } from './intelligenceLogger.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_PAYLOAD_BYTES = 200_000;
const RETRY_BASE_MS = 500;
const MAX_ATTEMPTS = 3;

// ─── Singleton ────────────────────────────────────────────────────────────────

let _genAI = null;
let _model = null;

function getModel() {
  if (_model) return _model;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.startsWith('your_')) {
    throw withCode(
      'LLM_NOT_CONFIGURED',
      'Gemini API key is not configured. Set GEMINI_API_KEY in your .env file.',
      { retryable: false }
    );
  }

  const modelId = process.env.GEMINI_MODEL_ID || 'gemini-2.0-flash';
  _genAI = new GoogleGenerativeAI(apiKey);
  _model = _genAI.getGenerativeModel({ model: modelId });
  return _model;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(err) {
  const msg = err.message || '';
  if (msg.includes('429') || msg.includes('quota') || msg.includes('rate')) return true;
  if (msg.includes('500') || msg.includes('503') || msg.includes('unavailable')) return true;
  return false;
}

/**
 * Convert Anthropic-style messages [{role, content}] to a single Gemini prompt.
 * Gemini uses a different format but for simple use cases we can concatenate.
 */
function messagesToGeminiContent(messages) {
  const parts = [];
  for (const msg of messages) {
    const text = typeof msg.content === 'string'
      ? msg.content
      : Array.isArray(msg.content)
        ? msg.content.map(b => b.text || '').join('\n')
        : JSON.stringify(msg.content);

    if (msg.role === 'system' || msg.role === 'user') {
      parts.push(text);
    } else if (msg.role === 'assistant') {
      parts.push(`Assistant: ${text}`);
    }
  }
  return parts.join('\n\n');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Invoke Gemini with the same interface as bedrockClient's invokeModel.
 */
export async function invokeModel({
  feature,
  messages,
  datasetId = null,
  userId = null,
  modelOverride = null,
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelId = modelOverride || process.env.GEMINI_MODEL_ID || 'gemini-2.0-flash';

  // ── Credential check ──────────────────────────────────────────────────────
  if (!apiKey || apiKey.startsWith('your_')) {
    logEvent({
      event: 'llm.invoke',
      feature,
      userId,
      datasetId,
      model: modelId,
      outcome: 'not_configured',
    });
    throw withCode(
      'LLM_NOT_CONFIGURED',
      'Gemini API key is not configured. Set GEMINI_API_KEY in your .env file.',
      { retryable: false }
    );
  }

  // ── Build prompt ──────────────────────────────────────────────────────────
  const prompt = messagesToGeminiContent(messages);

  // ── Payload size guard ────────────────────────────────────────────────────
  if (prompt.length > MAX_PAYLOAD_BYTES) {
    logEvent({
      event: 'llm.invoke',
      feature,
      userId,
      datasetId,
      model: modelId,
      outcome: 'payload_too_large',
      payloadBytes: prompt.length,
    });
    throw withCode(
      'PAYLOAD_TOO_LARGE',
      `Prompt is ${prompt.length} bytes, exceeding the 200 KB limit`,
      { retryable: false }
    );
  }

  // ── Retry loop ────────────────────────────────────────────────────────────
  const model = getModel();
  const start = Date.now();
  let lastErr = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      const latencyMs = Date.now() - start;

      const inputTokensEstimate = Math.ceil(prompt.length / 4);
      const outputTokensEstimate = Math.ceil(text.length / 4);

      logEvent({
        event: 'llm.invoke',
        feature,
        userId,
        datasetId,
        model: modelId,
        inputTokensEstimate,
        outputTokensEstimate,
        latencyMs,
        attempts: attempt + 1,
        outcome: 'success',
      });

      return { text, model: modelId, latencyMs, inputTokensEstimate, outputTokensEstimate };
    } catch (err) {
      lastErr = err;

      if (!isRetryable(err)) break;

      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(RETRY_BASE_MS * 2 ** attempt);
      }
    }
  }

  // All attempts exhausted
  const latencyMs = Date.now() - start;
  logEvent({
    event: 'llm.invoke',
    feature,
    userId,
    datasetId,
    model: modelId,
    latencyMs,
    attempts: MAX_ATTEMPTS,
    outcome: 'error',
    errorName: lastErr?.message?.slice(0, 100),
  });

  throw withCode(
    'LLM_ERROR',
    lastErr?.message || 'Gemini invocation failed after retries',
    { retryable: false }
  );
}

export function _resetClient() {
  _genAI = null;
  _model = null;
}
