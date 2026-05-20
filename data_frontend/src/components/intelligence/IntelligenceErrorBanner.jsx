import { useState, useEffect } from 'react';

/**
 * Maps structured intelligence-layer error envelopes to friendly banners.
 *
 * Props:
 *   error — { code, message, retryable, retryAfterSeconds? }
 *           OR a plain Error object
 */
export default function IntelligenceErrorBanner({ error }) {
  if (!error) return null;

  // Normalise plain Error objects
  const code = error.code ?? null;
  const retryable = error.retryable ?? false;
  const retryAfterSeconds = error.retryAfterSeconds ?? null;
  const rawMessage = error.message ?? 'An unexpected error occurred.';

  return (
    <BannerContent
      code={code}
      retryable={retryable}
      retryAfterSeconds={retryAfterSeconds}
      rawMessage={rawMessage}
    />
  );
}

function BannerContent({ code, retryable, retryAfterSeconds, rawMessage }) {
  const [countdown, setCountdown] = useState(retryAfterSeconds ?? 0);

  // Tick down the countdown when retryAfterSeconds is present
  useEffect(() => {
    if (!retryAfterSeconds) return;
    setCountdown(retryAfterSeconds);
    const id = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(id); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [retryAfterSeconds]);

  // ── Resolve friendly copy and style ──────────────────────────────────────
  let message;
  let hideRegenerate = false;

  if (code === 'LLM_NOT_CONFIGURED' || code === 'INTELLIGENCE_DISABLED' || code === 'BEDROCK_NOT_CONFIGURED') {
    message = 'AI features are not configured for this environment.';
    hideRegenerate = true;
  } else if (code === 'LLM_RATE_LIMITED') {
    const secs = countdown > 0 ? countdown : retryAfterSeconds ?? 0;
    message = `You've reached the AI request limit. Please wait ${secs}s before trying again.`;
  } else if (code === 'PAYLOAD_TOO_LARGE' || code === 'TOKEN_BUDGET_EXCEEDED') {
    message = 'This dataset is too large for AI analysis. Try with a smaller sample.';
  } else {
    // Unknown code — show raw message or generic fallback
    message = rawMessage || 'An unexpected error occurred. Please try again.';
  }

  // Yellow/amber for retryable, red for non-retryable
  const isRetryable = retryable || code === 'LLM_RATE_LIMITED';
  const containerClass = isRetryable
    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
    : 'bg-error/10 border-error/30 text-error';
  const iconName = isRetryable ? 'warning' : 'error';

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${containerClass}`}
    >
      <span
        className="material-symbols-outlined text-lg shrink-0 mt-0.5"
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        {iconName}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold leading-snug">{message}</p>
        {hideRegenerate && (
          <p className="text-xs mt-1 opacity-70">Regenerate controls are hidden until AI is configured.</p>
        )}
        {code === 'LLM_RATE_LIMITED' && countdown > 0 && (
          <p className="text-xs mt-1 opacity-70">Controls will re-enable automatically.</p>
        )}
      </div>
    </div>
  );
}
