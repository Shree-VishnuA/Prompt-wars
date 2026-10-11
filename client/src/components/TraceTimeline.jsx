import React, { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';

export const LAYER_NAMES = {
  validation: 'Input validation',
  normalization: 'Normalization',
  deterministic: 'Deterministic rules',
  llm_extractor: 'AI extractor',
  llm_judge: 'AI judge',
  grounding: 'Intent grounding',
  policy: 'Policy engine'
};

function getLayerTitle(layerKey) {
  if (!layerKey) return 'Unknown Layer';
  return LAYER_NAMES[layerKey] || layerKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatusIcon({ status }) {
  switch (status) {
    case 'pass':
      return (
        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'flag':
      return (
        <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    case 'block':
      return (
        <svg className="w-3.5 h-3.5 text-rose-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    case 'error':
      return (
        <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'skipped':
    default:
      return (
        <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
        </svg>
      );
  }
}

function getStatusStyles(status) {
  switch (status) {
    case 'pass':
      return {
        badgeBg: 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30',
        dotBorder: 'border-emerald-500/40 bg-emerald-950/80',
        line: 'bg-emerald-500/30'
      };
    case 'flag':
      return {
        badgeBg: 'bg-amber-950/40 text-amber-300 border-amber-500/30',
        dotBorder: 'border-amber-500/40 bg-amber-950/80',
        line: 'bg-amber-500/30'
      };
    case 'block':
      return {
        badgeBg: 'bg-rose-950/40 text-rose-300 border-rose-500/30',
        dotBorder: 'border-rose-500/50 bg-rose-950/80',
        line: 'bg-rose-500/30'
      };
    case 'error':
      return {
        badgeBg: 'bg-red-950/40 text-red-300 border-red-500/30',
        dotBorder: 'border-red-500/50 bg-red-950/80',
        line: 'bg-red-500/30'
      };
    case 'skipped':
    default:
      return {
        badgeBg: 'bg-slate-900 text-slate-400 border-slate-800',
        dotBorder: 'border-slate-700 bg-slate-900',
        line: 'bg-slate-800'
      };
  }
}

function TraceRow({ step, isFirstBlock, isLast }) {
  const [expanded, setExpanded] = useState(isFirstBlock || (step.findings && step.findings.length > 0));
  const styles = getStatusStyles(step.status);
  const layerTitle = getLayerTitle(step.layer);
  const hasFindings = Array.isArray(step.findings) && step.findings.length > 0;

  return (
    <div className="relative flex items-start gap-4 pb-6 last:pb-2 group">
      {/* Vertical Timeline Connector Line */}
      {!isLast && (
        <span
          className={`absolute left-[15px] top-7 bottom-0 w-0.5 ${styles.line}`}
          aria-hidden="true"
        />
      )}

      {/* Status Node Icon */}
      <div
        className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border shadow-sm shrink-0 transition-transform ${styles.dotBorder}`}
      >
        <StatusIcon status={step.status} />
      </div>

      {/* Layer Content Card */}
      <div className="flex-1 min-w-0 rounded-lg bg-slate-950/70 border border-slate-800/80 p-3.5 transition-colors hover:border-slate-700/90">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-sm font-semibold text-slate-100">
              {layerTitle}
            </span>

            {/* Status Badge */}
            <span
              className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border font-medium ${styles.badgeBg}`}
            >
              {step.status}
            </span>

            {/* FIRST BLOCKING LAYER HIGHLIGHT */}
            {isFirstBlock && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500 text-slate-950 uppercase shadow-md shadow-rose-950/50 animate-pulse">
                <span>🛡️</span>
                <span>Caught here</span>
              </span>
            )}
          </div>

          {/* Duration Badge */}
          <div className="text-xs font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 shrink-0">
            {step.duration_ms !== undefined ? `${step.duration_ms} ms` : '—'}
          </div>
        </div>

        {/* Summary text */}
        <p className="text-xs text-slate-300 mt-1.5 font-sans leading-relaxed">
          {step.summary || 'No summary reported for this layer.'}
        </p>

        {/* Expandable Findings List */}
        {hasFindings && (
          <div className="mt-3 pt-2.5 border-t border-slate-900">
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-1.5 text-[11px] font-mono text-slate-400 hover:text-slate-200 transition-colors"
            >
              <svg
                className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span>Findings ({step.findings.length})</span>
            </button>

            {expanded && (
              <ul className="mt-2 space-y-1 pl-2 border-l border-slate-800 text-xs font-mono text-slate-300">
                {step.findings.map((f, i) => (
                  <li key={i} className="text-[11px] text-rose-300/90 break-words py-0.5">
                    • {typeof f === 'string' ? f : JSON.stringify(f)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TraceTimeline({ verdict: propVerdict } = {}) {
  const { verdict: contextVerdict } = useApp();
  const verdict = propVerdict !== undefined ? propVerdict : contextVerdict;
  const trace = verdict?.trace || [];

  if (!verdict || trace.length === 0) {
    return (
      <div
        data-testid="trace-list"
        className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-sm text-center"
      >
        <div className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">
          Pipeline Execution Trace
        </div>
        <p className="text-xs text-slate-500">
          No defense layers evaluated yet. Run an analysis above to see chronological layer inspection.
        </p>
      </div>
    );
  }

  // Find the FIRST blocking layer
  const firstBlockIndex = trace.findIndex((t) => t.status === 'block');

  return (
    <div
      data-testid="trace-list"
      className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6 shadow-xl backdrop-blur-sm"
    >
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800/80">
        <div>
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <span>Defense Pipeline Trace</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              {trace.length} LAYERS
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Step-by-step audit of input sanitization, heuristic checks, AI validators, and policy logic.
          </p>
        </div>

        {verdict.latency_ms !== undefined && (
          <div className="text-xs font-mono text-emerald-400 bg-slate-950 px-2.5 py-1 rounded border border-slate-800 shrink-0">
            Total {verdict.latency_ms} ms
          </div>
        )}
      </div>

      <div className="space-y-1">
        {trace.map((step, idx) => (
          <TraceRow
            key={idx}
            step={step}
            isFirstBlock={idx === firstBlockIndex}
            isLast={idx === trace.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
