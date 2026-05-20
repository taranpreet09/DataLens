// Configuration loader for the Intelligence Layer.
//
// Reads relevant environment variables on every call so tests (and operators
// changing the environment at runtime) see the latest values.

const DEFAULT_MODEL_ID = 'gemini-2.5-flash';
const DEFAULT_TOKEN_BUDGET = 12000;
const DEFAULT_TIMEOUT_MS = 60000;

function isRealValue(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.toLowerCase().startsWith('your_')) return false;
  return true;
}

function parsePositiveInt(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function intelligenceConfig() {
  const env = process.env;

  const enabled =
    (env.INTELLIGENCE_LAYER_ENABLED ?? 'true').toLowerCase() !== 'false';

  const modelId = isRealValue(env.GEMINI_MODEL_ID)
    ? env.GEMINI_MODEL_ID.trim()
    : DEFAULT_MODEL_ID;

  const tokenBudget = parsePositiveInt(env.GEMINI_TOKEN_BUDGET, DEFAULT_TOKEN_BUDGET);
  const timeoutMs = parsePositiveInt(env.GEMINI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);

  const credentialsResolved = isRealValue(env.GEMINI_API_KEY);

  return {
    enabled,
    modelId,
    tokenBudget,
    timeoutMs,
    credentialsResolved,
  };
}
