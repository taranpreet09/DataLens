/**
 * Bedrock Client — single gateway for all Intelligence Layer LLM calls.
 *
 * Wraps the AWS Bedrock Runtime SDK with:
 *   - Credential check (BEDROCK_NOT_CONFIGURED)
 *   - Payload size guard (PAYLOAD_TOO_LARGE, 200 KB)
 *   - Token budget guard (TOKEN_BUDGET_EXCEEDED, default 12 000 tokens)
 *   - Hard timeout via AbortController (BEDROCK_TIMEOUT, default 60 s)
 *   - Exponential-backoff retry on throttling / 5xx (up to 3 attempts)
 *   - Structured log per call — prompt/response bodies are NEVER logged
 *
 * Default model: anthropic.claude-sonnet-4-20250514-v1:0
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { intelligenceConfig } from '../config/intelligence.js';
import { logEvent, withCode } from './intelligenceLogger.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_PAYLOAD_BYTES = 200_000;   // 200 KB hard cap
const RETRY_BASE_MS = 500;           // 500 ms, 1 000 ms, 2 000 ms
const MAX_ATTEMPTS = 3;

// Error names / codes that indicate a retryable Bedrock condition.
const RETRYABLE_ERROR_NAMES = new Set([
  'ThrottlingException',
  'ServiceUnavailableException',
  'InternalServerException',
  'ModelTimeoutException',
]);

// ─── Singleton client ─────────────────────────────────────────────────────────

let _client = null;

function getClient() {
  if (_client) return _client;

  const cfg = intelligenceConfig();
  if (!cfg.credentialsResolved) {
    throw withCode(
      'BEDROCK_NOT_CONFIGURED',
      'AWS credentials are not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY (or AWS_PROFILE / AWS_ROLE_ARN / AWS_BEARER_TOKEN_BEDROCK).',
      { retryable: false }
    );
  }

  const clientOpts = { region: cfg.region };

  // If using Bedrock API key (bearer token), configure token-based auth
  if (cfg.hasBearerToken) {
    clientOpts.token = { token: cfg.bearerToken };
  }

  _client = new BedrockRuntimeClient(clientOpts);
  return _client;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(err) {
  if (RETRYABLE_ERROR_NAMES.has(err.name)) return true;
  const status = err.$metadata?.httpStatusCode;
  if (status === 429 || (status >= 500 && status < 600)) return true;
  return false;
}

/**
 * Decode the Anthropic text response from the raw Bedrock response body.
 * The body is a Uint8Array containing a JSON string.
 */
function decodeAnthropicText(rawBody) {
  const json = JSON.parse(Buffer.from(rawBody).toString('utf8'));
  // Anthropic Messages API: { content: [{ type: 'text', text: '...' }] }
  if (Array.isArray(json.content)) {
    const textBlock = json.content.find((b) => b.type === 'text');
    if (textBlock) return textBlock.text;
  }
  // Fallback: return the whole JSON string so callers can inspect it.
  return JSON.stringify(json);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Invoke a Bedrock model with the Anthropic Messages API.
 *
 * @param {object} params
 * @param {string}   params.feature       - Logical feature name for logging
 * @param {Array}    params.messages      - Role-tagged message array
 * @param {string}   [params.datasetId]   - For logging only
 * @param {string}   [params.userId]      - For logging only
 * @param {string}   [params.modelOverride] - Override the configured model
 * @returns {Promise<{ text, model, latencyMs, inputTokensEstimate, outputTokensEstimate }>}
 */
export async function invokeModel({
  feature,
  messages,
  datasetId = null,
  userId = null,
  modelOverride = null,
}) {
  const cfg = intelligenceConfig();
  const model = modelOverride || cfg.modelId;

  // ── Credential check (synchronous, before any network call) ──────────────
  if (!cfg.credentialsResolved) {
    logEvent({
      event: 'llm.invoke',
      feature,
      userId,
      datasetId,
      model,
      outcome: 'not_configured',
    });
    throw withCode(
      'BEDROCK_NOT_CONFIGURED',
      'AWS credentials are not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY (or AWS_PROFILE / AWS_ROLE_ARN).',
      { retryable: false }
    );
  }

  // ── Build request body ────────────────────────────────────────────────────
  const body = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 2000,
    temperature: 0.2,
    messages,
  };

  const serialized = JSON.stringify(body);

  // ── Payload size guard ────────────────────────────────────────────────────
  if (serialized.length > MAX_PAYLOAD_BYTES) {
    logEvent({
      event: 'llm.invoke',
      feature,
      userId,
      datasetId,
      model,
      outcome: 'payload_too_large',
      payloadBytes: serialized.length,
    });
    throw withCode(
      'PAYLOAD_TOO_LARGE',
      `Serialised request body is ${serialized.length} bytes, exceeding the 200 KB limit`,
      { retryable: false }
    );
  }

  // ── Token budget guard ────────────────────────────────────────────────────
  const inputTokensEstimate = Math.ceil(serialized.length / 4);
  if (inputTokensEstimate > cfg.tokenBudget) {
    logEvent({
      event: 'llm.invoke',
      feature,
      userId,
      datasetId,
      model,
      inputTokensEstimate,
      outcome: 'budget_exceeded',
    });
    throw withCode(
      'TOKEN_BUDGET_EXCEEDED',
      `Estimated ${inputTokensEstimate} input tokens exceeds the configured budget of ${cfg.tokenBudget}`,
      { retryable: false }
    );
  }

  // ── Retry loop ────────────────────────────────────────────────────────────
  const client = getClient();
  const start = Date.now();
  let lastErr = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), cfg.timeoutMs);

    try {
      const response = await client.send(
        new InvokeModelCommand({
          modelId: model,
          contentType: 'application/json',
          accept: 'application/json',
          body: serialized,
        }),
        { abortSignal: ac.signal }
      );

      clearTimeout(timer);

      const text = decodeAnthropicText(response.body);
      const latencyMs = Date.now() - start;

      // Estimate output tokens from response length.
      const outputTokensEstimate = Math.ceil(text.length / 4);

      logEvent({
        event: 'llm.invoke',
        feature,
        userId,
        datasetId,
        model,
        inputTokensEstimate,
        outputTokensEstimate,
        latencyMs,
        attempts: attempt + 1,
        outcome: 'success',
      });

      return { text, model, latencyMs, inputTokensEstimate, outputTokensEstimate };
    } catch (err) {
      clearTimeout(timer);

      // Timeout (AbortController fired).
      if (ac.signal.aborted || err.name === 'AbortError') {
        const latencyMs = Date.now() - start;
        logEvent({
          event: 'llm.invoke',
          feature,
          userId,
          datasetId,
          model,
          latencyMs,
          attempts: attempt + 1,
          outcome: 'timeout',
        });
        throw withCode(
          'BEDROCK_TIMEOUT',
          `Bedrock request exceeded the ${cfg.timeoutMs} ms timeout`,
          { retryable: true }
        );
      }

      lastErr = err;

      if (!isRetryable(err)) break;

      // Exponential backoff before next attempt.
      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(RETRY_BASE_MS * 2 ** attempt);
      }
    }
  }

  // All attempts exhausted.
  const latencyMs = Date.now() - start;
  logEvent({
    event: 'llm.invoke',
    feature,
    userId,
    datasetId,
    model,
    latencyMs,
    attempts: MAX_ATTEMPTS,
    outcome: 'non_retryable_error',
    errorName: lastErr?.name,
  });

  throw withCode(
    'BEDROCK_ERROR',
    lastErr?.message || 'Bedrock invocation failed after retries',
    { retryable: false }
  );
}

// Allow tests to reset the singleton client (e.g. after mocking).
export function _resetClient() {
  _client = null;
}
