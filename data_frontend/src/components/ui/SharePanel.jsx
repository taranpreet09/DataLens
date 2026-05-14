import { useState, useCallback } from 'react';
import { collaborationApi } from '../../lib/api';

/**
 * Share panel — generates and manages shareable report links.
 * Props:
 *  - datasetId: the backend dataset ID (dbId)
 */
export default function SharePanel({ datasetId }) {
  const [shareUrl, setShareUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  const generateLink = useCallback(async () => {
    if (!datasetId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await collaborationApi.createShareLink(datasetId);
      const fullUrl = `${window.location.origin}/shared/${result.shareToken}`;
      setShareUrl(fullUrl);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [datasetId]);

  const revokeLink = useCallback(async () => {
    if (!datasetId) return;
    setLoading(true);
    try {
      await collaborationApi.revokeShareLink(datasetId);
      setShareUrl(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [datasetId]);

  const copyToClipboard = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!datasetId) return null;

  return (
    <div className="bg-surface-container-low rounded-xl border border-outline-variant/10 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-lg">share</span>
        <h4 className="text-sm font-semibold">Share Report</h4>
      </div>

      {error && (
        <p className="text-xs text-error">{error}</p>
      )}

      {!shareUrl ? (
        <div className="space-y-2">
          <p className="text-xs text-on-surface-variant">
            Generate a public link anyone can use to view this report (read-only, no raw data).
          </p>
          <button
            onClick={generateLink}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-fixed-dim text-on-primary-container font-medium rounded-lg text-sm transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">link</span>
            {loading ? 'Generating...' : 'Generate Share Link'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 px-3 py-2 bg-surface-container border border-outline-variant/20 rounded-lg text-xs text-on-surface font-mono truncate"
              aria-label="Share URL"
            />
            <button
              onClick={copyToClipboard}
              className="shrink-0 px-3 py-2 bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/20 rounded-lg text-xs font-medium transition-colors"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Link active
            </span>
            <button
              onClick={revokeLink}
              disabled={loading}
              className="text-xs text-error hover:text-red-300 transition-colors disabled:opacity-50"
            >
              Revoke access
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
