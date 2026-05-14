/**
 * LLM Rate Limiter — per-user Bedrock invocation budget.
 *
 * Allows at most 30 LLM invocations per user per rolling hour.
 * Implemented with Redis INCR + EXPIRE so the counter is shared across
 * all Node processes (e.g. when running behind a load balancer).
 *
 * Fail-open: if Redis is unreachable the call is allowed through with a
 * warning log, consistent with how the existing job queue handles Redis
 * outages.
 */

import { getRedisConnection } from '../config/redis.js';
import { logEvent, withCode } from './intelligenceLogger.js';

const MAX_INVOCATIONS_PER_HOUR = 30;
const WINDOW_SECONDS = 3600;

/**
 * Check whether the user has remaining LLM budget for this hour.
 *
 * Increments the counter and sets a 1-hour TTL on first use.
 * Throws `LLM_RATE_LIMITED` (with `retryAfterSeconds`) when the budget
 * is exhausted.
 *
 * @param {string} userId
 * @returns {Promise<void>}
 */
export async function checkLlmBudget(userId) {
  const key = `intelligence:llm:budget:${userId}`;

  try {
    const conn = getRedisConnection();

    // INCR is atomic; if the key doesn't exist Redis creates it at 0 first.
    const count = await conn.incr(key);

    // Set TTL only on the first increment so the window is anchored to the
    // first call, not reset on every call.
    if (count === 1) {
      await conn.expire(key, WINDOW_SECONDS);
    }

    if (count > MAX_INVOCATIONS_PER_HOUR) {
      // Decrement so the over-limit call doesn't consume a slot.
      await conn.decr(key).catch(() => {});

      const ttl = await conn.ttl(key).catch(() => WINDOW_SECONDS);
      const retryAfterSeconds = ttl > 0 ? ttl : WINDOW_SECONDS;

      throw withCode(
        'LLM_RATE_LIMITED',
        `Per-user LLM budget of ${MAX_INVOCATIONS_PER_HOUR} invocations/hour exceeded`,
        { retryAfterSeconds }
      );
    }
  } catch (err) {
    // Re-throw known rate-limit errors.
    if (err.code === 'LLM_RATE_LIMITED') throw err;

    // Redis is unavailable — fail open with a warning.
    logEvent({
      event: 'llm.rate_limiter.redis_unavailable',
      userId,
      error: err.message,
      action: 'fail_open',
    });
  }
}
