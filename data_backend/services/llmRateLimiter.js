/**
 * LLM Rate Limiter — per-user Bedrock invocation budget.
 *
 * Allows at most 30 LLM invocations per user per rolling hour.
 * Implemented with a Redis Lua script for atomic check-and-increment,
 * eliminating race conditions between concurrent requests.
 *
 * Fail-open: if Redis is unreachable the call is allowed through with a
 * warning log, consistent with how the existing job queue handles Redis
 * outages.
 */

import { getRedisConnection } from '../config/redis.js';
import { logEvent, withCode } from './intelligenceLogger.js';

const MAX_INVOCATIONS_PER_HOUR = 30;
const WINDOW_SECONDS = 3600;

const RATE_LIMIT_SCRIPT = `
local key = KEYS[1]
local max = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local current = tonumber(redis.call('GET', key) or '0')
if current >= max then
  return -1
end
local newCount = redis.call('INCR', key)
if newCount == 1 then
  redis.call('EXPIRE', key, window)
end
if newCount > max then
  redis.call('DECR', key)
  return -1
end
return newCount
`;

/**
 * Check whether the user has remaining LLM budget for this hour.
 *
 * Uses an atomic Lua script to check the current count and increment
 * in a single Redis operation, preventing race conditions.
 *
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

    const result = await conn.eval(
      RATE_LIMIT_SCRIPT,
      1,
      key,
      MAX_INVOCATIONS_PER_HOUR,
      WINDOW_SECONDS
    );

    if (result === -1) {
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
