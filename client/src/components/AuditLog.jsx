import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext.jsx';
import * as api from '../api/client.js';
import { getThreatCategoryLabel } from '../lib/format.js';

const LAYER_LABELS = {
  input_validation: 'Input Validation',
  normalization: 'Normalization',
  deterministic: 'Deterministic Rules',
  llm_extractor: 'AI Extractor',
  llm_judge: 'AI Judge',
  grounding: 'Intent Grounding',
  policy: 'Policy Engine'
};

function formatLayerLabel(layer) {
  return LAYER_LABELS[layer] || layer.replace(/_/g, ' ');
}

function formatTime(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  } catch {
    return isoString;
  }
}

function formatDate(isoString) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString([], {
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return '';
  }
}

export default function AuditLog() {
  const { activeTab } = useApp();
  const isActive = !activeTab || activeTab.toLowerCase() === 'audit';

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const fetchAuditLog = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    setError(null);

    try {
      const res = await api.getAudit();
      if (res.ok && Array.isArray(res.data)) {
        // Entries in buffer are ordered chronologically; reverse so most recent appear first
        setEntries([...res.data].reverse());
        setLastRefreshed(new Date());
      } else {
        setError(res.error || 'Failed to load audit records');
      }
    } catch (err) {
      setError(err.message || 'Network error fetching audit records');
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, []);

  // Initial fetch and auto-refresh every 10s while tab is active
  useEffect(() => {
    if (!isActive) return;

    fetchAuditLog(false);

    const intervalId = setInterval(() => {
      fetchAuditLog(true);
    }, 10000);

    return () => clearInterval(intervalId);
  }, [isActive, fetchAuditLog]);

  return (
    <div className="space-y-6" data-testid="audit-log">
      {/* Top Header Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6 shadow-xl backdrop-blur-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="inline-flex items-center gap-2 rounded-md bg-sky-500/10 px-2.5 py-1 text-xs font-mono font-medium text-sky-400 border border-sky-500/20 mb-2">
              Tamper-Evident Ring Buffer • Last 50 Events
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-100 font-mono">
              Security Audit Ledger
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Chronological log of transactions evaluated by the multi-layer intent firewall.
              Auto-refreshes every 10 seconds.
            </p>
          </div>

          {/* Action / Refresh Bar */}
          <div className="flex items-center gap-3 self-start sm:self-auto">
            {lastRefreshed && (
              <span className="text-[11px] font-mono text-slate-400">
                Synced {formatTime(lastRefreshed.toISOString())}
              </span>
            )}

            <button
              type="button"
              data-testid="audit-refresh-button"
              onClick={() => fetchAuditLog(false)}
              disabled={loading}
              aria-label="Refresh security audit log"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors disabled:opacity-50"
            >
              <svg
                className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : 'text-slate-400'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Security Privacy Notice */}
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs font-mono text-slate-400">
          <span className="text-sky-400 font-semibold select-none">🔒 Privacy Notice:</span>
          <span>Only redacted previews are stored in memory.</span>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-xl border border-rose-500/50 bg-rose-950/40 p-4 text-xs font-mono text-rose-200 flex items-center gap-3">
          <span className="text-lg">⚠️</span>
          <div>
            <p className="font-semibold text-sm">Failed to retrieve audit log</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && entries.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-slate-800 text-sky-400 animate-spin mb-3">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
          <p className="text-xs font-mono text-slate-400">Loading audit records...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && entries.length === 0 && !error && (
        <div
          data-testid="audit-empty"
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-12 text-center shadow-xl backdrop-blur-sm"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-800 text-slate-400 border border-slate-700 mb-3 shadow-inner">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-slate-200">No Audit Records Yet</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
            Transaction requests analyzed by the firewall will appear here in the circular ring buffer.
          </p>
          <p className="text-[11px] text-slate-500 font-mono mt-3">
            Only redacted previews are stored in memory.
          </p>
        </div>
      )}

      {/* Audit Log Table */}
      {entries.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 shadow-xl overflow-hidden backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono" data-testid="audit-table">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400">
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Time</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Decision</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Category</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Risk</th>
                  <th className="py-3 px-4 font-semibold">Instruction Preview</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Layers Flagged</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {entries.map((entry, idx) => {
                  const isApproved = entry.decision === 'APPROVED';
                  const riskLevel = entry.risk_level || 'UNKNOWN';

                  let riskColor = 'text-slate-400 bg-slate-800 border-slate-700';
                  if (riskLevel === 'LOW') {
                    riskColor = 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30';
                  } else if (riskLevel === 'MEDIUM') {
                    riskColor = 'text-amber-400 bg-amber-950/40 border-amber-500/30';
                  } else if (riskLevel === 'HIGH') {
                    riskColor = 'text-rose-400 bg-rose-950/40 border-rose-500/30';
                  } else if (riskLevel === 'CRITICAL') {
                    riskColor = 'text-red-300 bg-red-950/60 border-red-500/50';
                  }

                  const layers = Array.isArray(entry.layers_flagged) ? entry.layers_flagged : [];

                  return (
                    <tr
                      key={entry.request_id || `audit-${idx}`}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Time */}
                      <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                        <div className="font-semibold text-slate-200">
                          {formatTime(entry.time)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-sans">
                          {formatDate(entry.time)}
                        </div>
                      </td>

                      {/* Decision Chip */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border tracking-wider uppercase ${
                            isApproved
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                              : 'bg-rose-950/60 text-rose-300 border-rose-500/40'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isApproved ? 'bg-emerald-400' : 'bg-rose-400'
                            }`}
                          />
                          <span>{entry.decision}</span>
                        </span>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-sans text-slate-200 text-xs">
                          {getThreatCategoryLabel(entry.threat_category)}
                        </span>
                        <div className="text-[10px] text-slate-400 uppercase">
                          {entry.threat_category}
                        </div>
                      </td>

                      {/* Risk */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border tracking-wider uppercase ${riskColor}`}
                        >
                          {riskLevel}
                        </span>
                      </td>

                      {/* Instruction Preview */}
                      <td className="py-3 px-4 max-w-xs md:max-w-md lg:max-w-lg">
                        <div
                          className="text-slate-300 truncate font-mono text-xs bg-slate-950/40 px-2 py-1 rounded border border-slate-800/80"
                          title={entry.instruction_preview || 'No preview available'}
                        >
                          {entry.instruction_preview || '—'}
                        </div>
                      </td>

                      {/* Layers Flagged */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {layers.length === 0 ? (
                          <span className="text-slate-400 text-[11px] italic">
                            None (all passed)
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {layers.map((layer) => (
                              <span
                                key={layer}
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-rose-950/30 text-rose-300 border border-rose-500/20"
                              >
                                {formatLayerLabel(layer)}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="px-4 py-2.5 bg-slate-950/80 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
            <div>
              Displaying {entries.length} recent audit {entries.length === 1 ? 'event' : 'events'} (max 50)
            </div>
            <div className="font-mono text-slate-400">
              Only redacted previews are stored in memory.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
