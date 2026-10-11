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
      <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-mono font-medium text-slate-700 border border-slate-200 mb-2">
              Tamper-Evident Ring Buffer • Last 50 Events
            </div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900 font-sans">
              Security Audit Ledger
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Chronological log of transactions evaluated by the multi-layer intent firewall.
              Auto-refreshes every 10 seconds.
            </p>
          </div>

          {/* Action / Refresh Bar */}
          <div className="flex items-center gap-3 self-start sm:self-auto">
            {lastRefreshed && (
              <span className="text-[11px] font-mono text-slate-500">
                Synced {formatTime(lastRefreshed.toISOString())}
              </span>
            )}

            <button
              type="button"
              data-testid="audit-refresh-button"
              onClick={() => fetchAuditLog(false)}
              disabled={loading}
              aria-label="Refresh security audit log"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors disabled:opacity-50"
            >
              <svg
                className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-slate-900' : 'text-slate-500'}`}
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
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-md bg-slate-50 border border-slate-200 text-xs font-mono text-slate-600">
          <span className="text-slate-900 font-semibold select-none">🔒 Privacy Notice:</span>
          <span>Only redacted previews are stored in memory.</span>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-xs font-mono text-rose-800 flex items-center gap-3">
          <span className="text-lg">⚠️</span>
          <div>
            <p className="font-semibold text-sm">Failed to retrieve audit log</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && entries.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-slate-100 text-slate-700 animate-spin mb-3">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
          <p className="text-xs font-mono text-slate-500">Loading audit records...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && entries.length === 0 && !error && (
        <div
          data-testid="audit-empty"
          className="rounded-lg border border-slate-200 bg-white p-12 text-center"
        >
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-slate-50 text-slate-400 border border-slate-200 mb-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-slate-900">No Audit Records Yet</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Transaction requests analyzed by the firewall will appear here in the circular ring buffer.
          </p>
          <p className="text-[11px] text-slate-500 font-mono mt-3">
            Only redacted previews are stored in memory.
          </p>
        </div>
      )}

      {/* Audit Log Table */}
      {entries.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono" data-testid="audit-table">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Time</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Decision</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Category</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Risk</th>
                  <th className="py-3 px-4 font-semibold">Instruction Preview</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Layers Flagged</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((entry, idx) => {
                  const isApproved = entry.decision === 'APPROVED';
                  const riskLevel = entry.risk_level || 'UNKNOWN';

                  let riskColor = 'text-slate-700 bg-slate-100 border-slate-200';
                  if (riskLevel === 'LOW') {
                    riskColor = 'text-emerald-800 bg-emerald-50 border-emerald-200';
                  } else if (riskLevel === 'MEDIUM') {
                    riskColor = 'text-amber-800 bg-amber-50 border-amber-200';
                  } else if (riskLevel === 'HIGH') {
                    riskColor = 'text-rose-800 bg-rose-50 border-rose-200';
                  } else if (riskLevel === 'CRITICAL') {
                    riskColor = 'text-rose-900 bg-rose-100 border-rose-300';
                  }

                  const layers = Array.isArray(entry.layers_flagged) ? entry.layers_flagged : [];

                  return (
                    <tr
                      key={entry.request_id || `audit-${idx}`}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      {/* Time */}
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">
                          {formatTime(entry.time)}
                        </div>
                        <div className="text-[10px] text-slate-500 font-sans">
                          {formatDate(entry.time)}
                        </div>
                      </td>

                      {/* Decision Chip */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold border tracking-wider uppercase ${
                            isApproved
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isApproved ? 'bg-emerald-600' : 'bg-rose-600'
                            }`}
                          />
                          <span>{entry.decision}</span>
                        </span>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-sans text-slate-900 text-xs">
                          {getThreatCategoryLabel(entry.threat_category)}
                        </span>
                        <div className="text-[10px] text-slate-500 uppercase">
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
                          className="text-slate-800 truncate font-mono text-xs bg-slate-50 px-2 py-1 rounded border border-slate-200"
                          title={entry.instruction_preview || 'No preview available'}
                        >
                          {entry.instruction_preview || '—'}
                        </div>
                      </td>

                      {/* Layers Flagged */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {layers.length === 0 ? (
                          <span className="text-slate-500 text-[11px] italic">
                            None (all passed)
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {layers.map((layer) => (
                              <span
                                key={layer}
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-rose-50 text-rose-800 border border-rose-200"
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
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
            <div>
              Displaying {entries.length} recent audit {entries.length === 1 ? 'event' : 'events'} (max 50)
            </div>
            <div className="font-mono text-slate-500">
              Only redacted previews are stored in memory.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
