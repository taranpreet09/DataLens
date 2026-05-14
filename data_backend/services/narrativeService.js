/**
 * Narrative Service — Intelligence Layer (5b)
 *
 * Generates a multi-section markdown narrative from a dataset's pre-computed
 * stats using Amazon Bedrock. Results are cached in Redis (5 min TTL) and
 * persisted to the Dataset document.
 */

import crypto from 'crypto';
import { buildDatasetContext } from './datasetContext.js';
import { invokeModel } from './bedrockClient.js';
import { checkLlmBudget } from './llmRateLimiter.js';
import { narrativeMessages } from './promptTemplates.js';
import { withCode } from './intelligenceLogger.js';
import { cacheGet, cacheSet } from '../config/redis.js';
import Dataset from '../models/Dataset.js';

const DEFAULT_SECTIONS = [
  'overview',
  'quality',
  'trends',
  'correlations',
  'outliers',
  'recommendations',
];

const CACHE_TTL_SECONDS = 300; // 5 minutes

/**
 * Compute a deterministic cache key for a narrative request.
 * Sections are sorted so order doesn't matter.
 */
function cacheKey(datasetId, sections, tone) {
  const hash = crypto
    .createHash('sha1')
    .update(sections.slice().sort().join('|') + '|' + tone)
    .digest('hex');
  return `intelligence:narrative:${datasetId}:${hash}`;
}

/**
 * Capitalise the first letter of a string for use as a heading.
 */
function toHeading(name) {
  return name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' ');
}

/**
 * Generate (or return cached) a multi-section markdown narrative.
 *
 * @param {{ dataset: object, userId: string, sections?: string[], tone?: string }}
 * @returns {Promise<{ sections: object, fullMarkdown: string, model: string, generatedAt: string }>}
 */
export async function generateNarrative({ dataset, userId, sections, tone }) {
  const resolvedSections = sections && sections.length > 0 ? sections : DEFAULT_SECTIONS;
  const resolvedTone = tone === 'technical' ? 'technical' : 'executive';
  const datasetId = String(dataset._id || '');

  // ── Cache check ───────────────────────────────────────────────────────────
  const key = cacheKey(datasetId, resolvedSections, resolvedTone);
  const cached = await cacheGet(key);
  if (cached) return cached;

  // ── Ensure stats are available ────────────────────────────────────────────
  if (!dataset.stats) {
    // Trigger a lightweight recompute using the existing job queue pattern.
    // For now, we proceed without stats — the context builder handles missing stats gracefully.
    // A full recompute would require re-running the job queue which is async.
    // The context builder will return safe defaults.
  }

  // ── Rate limit ────────────────────────────────────────────────────────────
  await checkLlmBudget(userId);

  // ── Build context ─────────────────────────────────────────────────────────
  const context = await buildDatasetContext(dataset, { sampleRows: 5 });

  // ── Invoke Bedrock ────────────────────────────────────────────────────────
  const messages = narrativeMessages(context, resolvedSections, resolvedTone);
  const { text: rawText, model } = await invokeModel({
    feature: 'narrative',
    messages,
    datasetId,
    userId,
  });

  // ── Parse response ────────────────────────────────────────────────────────
  let parsed;
  try {
    const clean = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    parsed = JSON.parse(clean);
  } catch {
    throw withCode(
      'INCOMPLETE_NARRATIVE',
      'The AI returned a response that could not be parsed as JSON.',
      { retryable: true }
    );
  }

  const sectionMap = parsed?.sections || {};

  // Validate all requested sections are present.
  const missingSections = resolvedSections.filter(s => !sectionMap[s]);
  if (missingSections.length > 0) {
    throw withCode(
      'INCOMPLETE_NARRATIVE',
      `The AI response is missing sections: ${missingSections.join(', ')}`,
      { retryable: true }
    );
  }

  // ── Compose fullMarkdown ──────────────────────────────────────────────────
  const fullMarkdown = resolvedSections
    .map(s => `## ${toHeading(s)}\n\n${sectionMap[s]}`)
    .join('\n\n');

  const generatedAt = new Date().toISOString();

  const payload = {
    sections: sectionMap,
    fullMarkdown,
    model,
    generatedAt,
    tone: resolvedTone,
  };

  // ── Persist to dataset ────────────────────────────────────────────────────
  await Dataset.findByIdAndUpdate(datasetId, {
    narrative: { sections: sectionMap, fullMarkdown, tone: resolvedTone, model, generatedAt },
  }).catch(() => {}); // Non-critical — don't fail the request if Mongo is slow

  // ── Cache ─────────────────────────────────────────────────────────────────
  await cacheSet(key, payload, CACHE_TTL_SECONDS);

  return payload;
}
