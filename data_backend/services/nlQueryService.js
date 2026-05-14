/**
 * NL Query Service — Intelligence Layer (5a)
 *
 * Translates a plain-English question into a structured AnalysisIntent,
 * dispatches it to the appropriate analysis handler, and returns the result
 * with a short plain-English narrative.
 */

import { buildDatasetContext } from './datasetContext.js';
import { invokeModel } from './bedrockClient.js';
import { dispatch, catalogue } from './toolRegistry.js';
import { checkLlmBudget } from './llmRateLimiter.js';
import { nlQueryMessages, nlQueryNarrative } from './promptTemplates.js';
import { withCode } from './intelligenceLogger.js';

const MIN_QUESTION_LENGTH = 3;
const MAX_QUESTION_LENGTH = 500;

/**
 * Strip JSON code fences that some models add despite instructions.
 * e.g. ```json\n{...}\n``` → {...}
 */
function stripJsonFences(text) {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
}

/**
 * Build a compact result summary for the narrative prompt.
 * Avoids sending huge arrays (e.g. all cluster labels) to Bedrock.
 */
function summariseResult(result) {
  if (!result || typeof result !== 'object') return result;
  const summary = {};
  for (const [key, value] of Object.entries(result)) {
    if (Array.isArray(value) && value.length > 20) {
      summary[key] = `[${value.length} items — truncated]`;
    } else {
      summary[key] = value;
    }
  }
  return summary;
}

/**
 * Handle a natural language query against a dataset.
 *
 * @param {{ dataset: object, userId: string, question: string }}
 * @returns {Promise<
 *   { intent: object, result: unknown, narrative: string, executionTimeMs: number } |
 *   { intent: null, suggestion: string, supportedTools: string[] }
 * >}
 */
export async function handleNlQuery({ dataset, userId, question }) {
  // ── Validate question length ──────────────────────────────────────────────
  if (
    typeof question !== 'string' ||
    question.length < MIN_QUESTION_LENGTH ||
    question.length > MAX_QUESTION_LENGTH
  ) {
    throw withCode(
      'INVALID_QUESTION_LENGTH',
      `Question must be between ${MIN_QUESTION_LENGTH} and ${MAX_QUESTION_LENGTH} characters`,
      { retryable: false }
    );
  }

  // ── Rate limit check ──────────────────────────────────────────────────────
  await checkLlmBudget(userId);

  const t0 = Date.now();

  // ── Build context ─────────────────────────────────────────────────────────
  const context = await buildDatasetContext(dataset, { sampleRows: 5 });

  // ── Intent extraction ─────────────────────────────────────────────────────
  const cat = catalogue();
  const messages = nlQueryMessages(context, question, cat);

  const { text: rawText } = await invokeModel({
    feature: 'nl_query',
    messages,
    datasetId: String(dataset._id || ''),
    userId,
  });

  // Parse the LLM response as JSON.
  let intent;
  try {
    intent = JSON.parse(stripJsonFences(rawText));
  } catch {
    throw withCode(
      'INTENT_PARSE_ERROR',
      'The AI returned a response that could not be parsed as JSON. Please try rephrasing your question.',
      { retryable: true }
    );
  }

  // ── Refusal path ──────────────────────────────────────────────────────────
  if (intent === null) {
    return {
      intent: null,
      suggestion: 'I could not map your question to a supported analysis. Try asking about correlations, trends, clusters, anomalies, or statistical tests.',
      supportedTools: cat.map(t => t.tool),
    };
  }

  // ── Dispatch to handler ───────────────────────────────────────────────────
  const { result } = await dispatch(intent, dataset, userId);

  // ── Narrative ─────────────────────────────────────────────────────────────
  const narrativeMessages = nlQueryNarrative(intent, summariseResult(result));
  const { text: narrativeText } = await invokeModel({
    feature: 'nl_query_narrative',
    messages: narrativeMessages,
    datasetId: String(dataset._id || ''),
    userId,
  });

  const executionTimeMs = Date.now() - t0;

  return {
    intent,
    result,
    narrative: narrativeText.trim(),
    executionTimeMs,
  };
}
