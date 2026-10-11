/**
 * Audit ring buffer: stores the last 50 redacted verdict summaries.
 * Sensitive data (amounts, account numbers) is partially masked.
 */

const MAX_ENTRIES = 50;

// In-memory ring buffer implemented with an array + pointer
const buffer = [];

/** Mask groups of 4+ consecutive digits (amounts, account numbers) */
function maskDigits(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/\d{4,}/g, (m) => {
    // Keep first 2 and last 2 digits; mask the middle
    if (m.length <= 4) return m.slice(0, 1) + '***' + m.slice(-1);
    return m.slice(0, 2) + '***' + m.slice(-2);
  });
}

/**
 * Records a verdict into the ring buffer.
 * @param {object} verdict - A VerdictSchema-conforming object.
 */
export function recordAudit(verdict) {
  if (!verdict || typeof verdict !== 'object') return;

  const rawPreview = typeof verdict.instruction_preview === 'string'
    ? verdict.instruction_preview
    : '';

  // Extract first 60 chars of the instruction from the verdict or fall back to empty
  const instructionRaw = verdict._instruction || '';
  const preview = maskDigits((instructionRaw || rawPreview).slice(0, 60));

  const layersFlagged = (verdict.trace || [])
    .filter((t) => t.status === 'flag' || t.status === 'block' || t.status === 'error')
    .map((t) => t.layer);

  const entry = {
    request_id: verdict.request_id || '',
    time: new Date().toISOString(),
    decision: verdict.decision || 'BLOCKED',
    threat_category: verdict.threat_category || 'MALFORMED_INPUT',
    risk_level: verdict.risk_level || 'HIGH',
    instruction_preview: preview,
    layers_flagged: [...new Set(layersFlagged)]
  };

  if (buffer.length >= MAX_ENTRIES) {
    buffer.shift();
  }
  buffer.push(entry);
}

/**
 * Returns the last 50 audit entries (most recent last).
 */
export function getAuditLog() {
  return buffer.slice();
}

/**
 * Clears the audit buffer (for testing).
 */
export function clearAuditLog() {
  buffer.length = 0;
}
