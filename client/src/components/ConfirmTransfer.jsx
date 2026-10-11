import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { formatPaise } from '../lib/format.js';
import * as api from '../api/client.js';

export default function ConfirmTransfer({ verdict: propVerdict } = {}) {
  const { verdict: contextVerdict, refreshAccount } = useApp();
  const verdict = propVerdict !== undefined ? propVerdict : contextVerdict;

  const [executing, setExecuting] = useState(false);
  const [used, setUsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);

  // 120-second countdown calculation
  const verdictTimestamp = verdict?.timestamp || Date.now();
  const [secondsRemaining, setSecondsRemaining] = useState(() => {
    const elapsed = Math.floor((Date.now() - verdictTimestamp) / 1000);
    return Math.max(0, 120 - elapsed);
  });

  useEffect(() => {
    if (!verdict?.intent_token || dismissed) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - verdictTimestamp) / 1000);
      const remaining = Math.max(0, 120 - elapsed);
      setSecondsRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [verdictTimestamp, verdict?.intent_token, dismissed]);

  // Don't render if condition not met or user dismissed
  if (
    dismissed ||
    !verdict ||
    verdict.decision !== 'APPROVED' ||
    !verdict.intent_token
  ) {
    return null;
  }

  const isExpired = secondsRemaining <= 0;
  const isActionDisabled = used || isExpired || executing;

  const intent = (verdict && typeof verdict.extracted_intent === 'object' && verdict.extracted_intent) || {};
  const recipientName = intent.recipient_name || intent.recipient_id || 'Verified Counterparty';
  const amountPaise = intent.amount_paise || 0;

  const handleConfirmAndSend = async () => {
    if (isActionDisabled) return;

    setExecuting(true);
    setUsed(true);

    try {
      // Execute using ONLY the intent token
      const res = await api.execute(verdict.intent_token);

      if (res.data?.status === 'executed') {
        setExecutionResult({
          status: 'executed',
          receipt: res.data.receipt,
          balance_paise: res.data.balance_paise
        });
      } else {
        const reason = res.status === 429
          ? 'Too many requests, wait a moment'
          : res.data?.reason || res.error || 'Execution rejected';
        setExecutionResult({
          status: 'rejected',
          reason
        });
      }

      // Refresh ledger account state after execution attempt
      if (refreshAccount) {
        await refreshAccount();
      }
    } catch (err) {
      setExecutionResult({
        status: 'rejected',
        reason: err?.message || 'Transfer failed'
      });
      if (refreshAccount) {
        await refreshAccount();
      }
    } finally {
      setExecuting(false);
    }
  };

  const handleCancel = () => {
    setDismissed(true);
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
      {/* Header and Locked Intent Badge */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span>🔒</span>
            <span>Intent locked</span>
          </span>
          <span className="text-xs text-slate-500 font-mono">HMAC-SHA256</span>
        </div>

        {/* 120s Countdown timer */}
        <div
          className={`text-xs font-mono px-2 py-0.5 rounded border ${
            isExpired
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : secondsRemaining <= 30
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : 'bg-slate-50 text-slate-700 border-slate-200'
          }`}
        >
          {isExpired ? 'Token Expired' : `${secondsRemaining}s remaining`}
        </div>
      </div>

      {/* Locked Intent Breakdown */}
      <div className="rounded-md bg-slate-50 border border-slate-200 p-3.5 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 font-mono">RECIPIENT</span>
          <span className="text-slate-900 font-medium">{recipientName}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 font-mono">AMOUNT</span>
          <span className="text-slate-900 font-mono font-semibold text-sm">
            {formatPaise(amountPaise)}
          </span>
        </div>
        {intent.action && (
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
            <span className="text-slate-500 font-mono">ACTION</span>
            <span className="text-slate-700 font-mono">{intent.action}</span>
          </div>
        )}
      </div>

      {/* Execution Result Feedback */}
      {executionResult && (
        <div
          className={`rounded-md p-3.5 border text-xs ${
            executionResult.status === 'executed'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          {executionResult.status === 'executed' ? (
            <div className="space-y-1">
              <div className="font-semibold flex items-center gap-1.5 text-emerald-800">
                <svg className="w-4 h-4 text-emerald-700 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>Transfer Executed Successfully</span>
              </div>
              {executionResult.receipt && (
                <div className="font-mono text-[11px] text-slate-700 pt-1 space-y-0.5">
                  <p>Receipt ID: {executionResult.receipt.id}</p>
                  <p>Updated Balance: {formatPaise(executionResult.balance_paise)}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <div className="font-semibold flex items-center gap-1.5 text-rose-800">
                <svg className="w-4 h-4 text-rose-700 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Transfer Rejected</span>
              </div>
              <p className="font-mono text-[11px] text-rose-800">
                Reason: {executionResult.reason}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Expired Message */}
      {isExpired && !executionResult && (
        <p className="text-xs text-rose-600 font-mono text-center">
          Intent token has expired (120s limit). Please re-run analysis to mint a fresh token.
        </p>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleConfirmAndSend}
          disabled={isActionDisabled}
          className={`flex-1 py-2 px-3 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
            isActionDisabled
              ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              : 'bg-slate-900 hover:bg-slate-800 text-white'
          }`}
        >
          {executing ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Executing...</span>
            </>
          ) : (
            <span>Confirm & send</span>
          )}
        </button>

        <button
          type="button"
          onClick={handleCancel}
          disabled={executing}
          className="py-2 px-3 rounded-md text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
