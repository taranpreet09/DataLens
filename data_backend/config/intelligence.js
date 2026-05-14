// Configuration loader for the Intelligence Layer.
//
// Reads relevant environment variables on every call so tests (and operators
// changing the environment at runtime) see the latest values. The values are
// intentionally not cached at module load time.

const DEFAULT_MODEL_ID = 'anthropic.claude-sonnet-4-20250514-v1:0';
const DEFAULT_REGION = 'us-east-1';
const DEFAULT_TOKEN_BUDGET = 12000;
const DEFAULT_TIMEOUT_MS = 60000;

/**
 * Returns true when an env var holds a real, non-placeholder value.
 *
 * The repo's `.env.example` ships placeholder strings such as
 * `your_aws_access_key_id_here`. Treat any value that is empty or that
 * starts with `your_` as "not set" so we don't believe credentials are
 * configured when an operator has only copied the example file.
 */
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

  const region = isRealValue(env.AWS_REGION) ? env.AWS_REGION.trim() : DEFAULT_REGION;
  const modelId = isRealValue(env.BEDROCK_MODEL_ID)
    ? env.BEDROCK_MODEL_ID.trim()
    : DEFAULT_MODEL_ID;

  const tokenBudget = parsePositiveInt(env.BEDROCK_TOKEN_BUDGET, DEFAULT_TOKEN_BUDGET);
  const timeoutMs = parsePositiveInt(env.BEDROCK_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);

  const hasAccessKeyPair =
    isRealValue(env.AWS_ACCESS_KEY_ID) && isRealValue(env.AWS_SECRET_ACCESS_KEY);
  const hasProfile = isRealValue(env.AWS_PROFILE);
  const hasRoleArn = isRealValue(env.AWS_ROLE_ARN);

  const credentialsResolved = hasAccessKeyPair || hasProfile || hasRoleArn;

  return {
    enabled,
    region,
    modelId,
    tokenBudget,
    timeoutMs,
    credentialsResolved,
  };
}
