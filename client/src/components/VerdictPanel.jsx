import React from 'react';
import { useApp } from '../context/AppContext.jsx';
import { formatPaise, getThreatCategoryLabel } from '../lib/format.js';

function RiskBadge({ score = 0, level = 'LOW' }) {
  const safeScore = Math.max(0, Math.min(100, Number(score) || 0));

  let barColor = 'bg-emerald-500';
  let badgeColor = 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30';

  if (safeScore >= 80 || level === 'CRITICAL') {
    barColor = 'bg-rose-500';
    badgeColor = 'bg-rose-950/40 text-rose-300 border-rose-500/30';
  } else if (safeScore >= 50 || level === 'HIGH') {
    barColor = 'bg-orange-500';
    badgeColor = 'bg-orange-950/40 text-orange-300 border-orange-500/30';
  } else if (safeScore >= 25 || level === 'MEDIUM') {
    barColor = 'bg-amber-500';
    badgeColor = 'bg-amber-950/40 text-amber-300 border-amber-500/30';
  }

  return (
    <div
      data-testid="verdict-risk"
      className="rounded-lg bg-slate-950/80 border border-slate-800 p-3.5 flex flex-col justify-between"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
          Risk Assessment
        </span>
        <span
          className={`text-xs font-mono font-semibold px-2 py-0.5 rounded border ${badgeColor}`}
        >
          {String(level || 'LOW').toUpperCase()} ({safeScore}/100)
        </span>
      </div>

      {/* 0-100 Gauge Bar */}
      <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${safeScore}%` }}
        />
      </div>

      <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1.5">
        <span>0 (Safe)</span>
        <span>25</span>
        <span>50</span>
        <span>75</span>
        <span>100 (Hostile)</span>
      </div>
    </div>
  );
}

function SimulatedResultView({ result }) {
  if (!result || typeof result !== 'object') return null;

  // Case 1: Balance inquiry read result
  if (result.balance_paise !== undefined && result.balance_paise !== null) {
    return (
      <div className="mt-4 rounded-lg bg-slate-950 border border-slate-800 p-4">
        <div className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-1">
          Account Balance Result
        </div>
        <div className="text-2xl font-bold font-mono text-emerald-400">
          {formatPaise(result.balance_paise)}
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Simulated read from bank ledger for verified balance inquiry.
        </p>
      </div>
    );
  }

  // Case 2: Transaction history read result
  if (Array.isArray(result.transactions)) {
    return (
      <div className="mt-4 rounded-lg bg-slate-950 border border-slate-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">
            Simulated Ledger Transactions ({result.transactions.length})
          </div>
        </div>

        {result.transactions.length === 0 ? (
          <p className="text-xs text-slate-500 font-mono">No recent transactions found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Counterparty</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium text-right">Amount</th>
                  <th className="pb-2 font-medium pl-4">Memo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900 font-mono">
                {result.transactions.map((tx, idx) => {
                  const isCredit = tx.type === 'CREDIT';
                  return (
                    <tr key={tx.id || idx} className="hover:bg-slate-900/50">
                      <td className="py-2 text-slate-400 whitespace-nowrap">
                        {tx.date ? new Date(tx.date).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="py-2 text-slate-200 font-sans font-medium whitespace-nowrap">
                        {tx.counterparty || 'Unknown'}
                      </td>
                      <td className="py-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] ${
                            isCredit
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-900'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {tx.type}
                        </span>
                      </td>
                      <td
                        className={`py-2 text-right font-semibold whitespace-nowrap ${
                          isCredit ? 'text-emerald-400' : 'text-slate-200'
                        }`}
                      >
                        {isCredit ? '+' : '-'}
                        {formatPaise(tx.amount_paise)}
                      </td>
                      <td className="py-2 pl-4 text-slate-400 truncate max-w-xs font-sans">
                        {tx.memo || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // Fallback generic object display
  return (
    <div className="mt-4 rounded-lg bg-slate-950 border border-slate-800 p-4">
      <div className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">
        Simulated Read Output
      </div>
      <pre className="text-xs font-mono text-slate-300 overflow-x-auto p-2 bg-slate-900 rounded">
        {JSON.stringify(result, null, 2)}
      </pre>
    </div>
  );
}

export default function VerdictPanel({ verdict: propVerdict } = {}) {
  const { verdict: contextVerdict } = useApp();
  const verdict = propVerdict !== undefined ? propVerdict : contextVerdict;

  // Empty State when no verdict has been evaluated yet
  if (!verdict) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl backdrop-blur-sm text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700/80 text-slate-400 mb-3 shadow-inner">
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
            />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-slate-200">
          Awaiting Transaction Input
        </h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
          Submit an instruction or pick a sample from above to evaluate the request
          through our 7-layer defense firewall.
        </p>
      </div>
    );
  }

  const decision = verdict.decision || 'BLOCKED';
  const isApproved = decision === 'APPROVED';
  const threatCategory = verdict.threat_category || (isApproved ? 'BENIGN' : 'UNKNOWN');
  const categoryLabel = getThreatCategoryLabel(threatCategory);
  const truncatedRationale = (verdict.rationale || '').slice(0, 300);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6 shadow-xl backdrop-blur-sm space-y-5"
    >
      {/* Top Bar: Decision Banner & Metadata */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Large Decision Banner */}
        <div
          data-testid="verdict-decision"
          className={`inline-flex items-center gap-3 px-5 py-2.5 rounded-xl border text-lg font-bold font-mono tracking-wide shadow-md transition-colors ${
            isApproved
              ? 'bg-emerald-950/50 text-emerald-300 border-emerald-500/40 shadow-emerald-950/40'
              : 'bg-rose-950/50 text-rose-300 border-rose-500/40 shadow-rose-950/40'
          }`}
        >
          {isApproved ? (
            <svg
              className="w-6 h-6 text-emerald-400 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg
              className="w-6 h-6 text-rose-400 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <span>{decision}</span>
        </div>

        {/* Threat Category Chip */}
        <div className="flex items-center flex-wrap gap-2">
          <span className="text-xs text-slate-400 font-mono">CATEGORY:</span>
          <div
            data-testid="verdict-category"
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold font-mono border ${
              isApproved
                ? 'bg-emerald-950/30 text-emerald-300 border-emerald-800/40'
                : 'bg-rose-950/30 text-rose-300 border-rose-800/40'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isApproved ? 'bg-emerald-400' : 'bg-rose-400'
              }`}
            />
            <span>{categoryLabel}</span>
          </div>
        </div>
      </div>

      {/* Grid: Risk Score Gauge & Request Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* RiskBadge Gauge */}
        <RiskBadge score={verdict.risk_score ?? 0} level={verdict.risk_level || 'LOW'} />

        {/* Request Execution Meta */}
        <div className="rounded-lg bg-slate-950/80 border border-slate-800 p-3.5 flex flex-col justify-between text-xs font-mono">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
            <span className="text-slate-400">REQUEST ID</span>
            <span className="text-slate-200 truncate max-w-[180px]">
              {verdict.request_id || '—'}
            </span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-400">LATENCY</span>
            <span className="text-slate-200">
              {verdict.latency_ms !== undefined ? `${verdict.latency_ms} ms` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="text-slate-400">POLICY VERSION</span>
            <span className="text-slate-200">v{verdict.policy_version || '1.0.0'}</span>
          </div>
        </div>
      </div>

      {/* Rationale Text (Plain React Text, never dangerouslySetInnerHTML) */}
      <div className="rounded-lg bg-slate-950/70 border border-slate-800/80 p-4">
        <div className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-1.5">
          Policy Rationale
        </div>
        <p
          data-testid="verdict-rationale"
          className="text-sm text-slate-200 leading-relaxed font-sans"
        >
          {truncatedRationale}
        </p>
      </div>

      {/* Degraded Warning if verdict.degraded */}
      {verdict.degraded && (
        <div className="rounded-lg bg-amber-950/30 border border-amber-500/40 p-3.5 flex items-start gap-3 text-amber-200 text-xs">
          <svg
            className="w-5 h-5 text-amber-400 shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <span className="font-semibold block mb-0.5">Degraded Defense Mode Active</span>
            <span>
              The LLM safety evaluation was unavailable or timed out. Deterministic rules
              fail-closed defense was enforced to ensure strict banking security.
            </span>
          </div>
        </div>
      )}

      {/* requires_confirmation Notice */}
      {verdict.requires_confirmation && (
        <div className="rounded-lg bg-emerald-950/30 border border-emerald-500/40 p-3.5 flex items-start gap-3 text-emerald-200 text-xs">
          <svg
            className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
          <div>
            <span className="font-semibold block mb-0.5">Explicit Confirmation Required</span>
            <span>
              An authorized intent token was minted for this transfer. Review the recipient
              and amount before triggering irreversible fund execution.
            </span>
          </div>
        </div>
      )}

      {/* Simulated Result for APPROVED Reads */}
      {isApproved && verdict.simulated_result && (
        <SimulatedResultView result={verdict.simulated_result} />
      )}
    </div>
  );
}
