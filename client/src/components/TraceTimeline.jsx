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
        <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'flag':
      return (
        <svg className="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    case 'block':
      return (
        <svg className="w-3.5 h-3.5 text-rose-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    case 'error':
      return (
        <svg className="w-3.5 h-3.5 text-red-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'skipped':
    default:
      return (
        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
        </svg>
      );
  }
}

function getStatusStyles(status) {
  switch (status) {
    case 'pass':
      return {
        badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        dotBorder: 'border-emerald-300 bg-white',
        line: 'bg-slate-200'
      };
    case 'flag':
      return {
        badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
        dotBorder: 'border-amber-300 bg-white',
        line: 'bg-slate-200'
      };
    case 'block':
      return {
        badgeBg: 'bg-rose-50 text-rose-800 border-rose-200',
        dotBorder: 'border-rose-300 bg-white',
        line: 'bg-slate-200'
      };
    case 'error':
      return {
        badgeBg: 'bg-red-50 text-red-800 border-red-200',
        dotBorder: 'border-red-300 bg-white',
        line: 'bg-slate-200'
      };
    case 'skipped':
    default:
      return {
        badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
        dotBorder: 'border-slate-300 bg-white',
        line: 'bg-slate-200'
      };
  }
}

function TraceRow({ step = {}, isFirstBlock, isLast }) {
  const [expanded, setExpanded] = useState(isFirstBlock || (step?.findings && step.findings.length > 0));
  const styles = getStatusStyles(step?.status);
  const layerTitle = getLayerTitle(step?.layer);
  const hasFindings = Array.isArray(step?.findings) && step.findings.length > 0;

  return (
    <div className="relative flex items-start gap-4 pb-5 last:pb-1 group">
      {/* Vertical Timeline Connector Line */}
      {!isLast && (
        <span
          className={`absolute left-[15px] top-7 bottom-0 w-0.5 ${styles.line}`}
          aria-hidden="true"
        />
      )}

      {/* Status Node Icon */}
      <div
        className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border shrink-0 ${styles.dotBorder}`}
      >
        <StatusIcon status={step.status} />
      </div>

      {/* Layer Content Card */}
      <div className="flex-1 min-w-0 rounded-md bg-slate-50 border border-slate-200 p-3.5 transition-colors hover:border-slate-300">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-sm font-semibold text-slate-900">
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
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-rose-100 text-rose-800 border border-rose-200 uppercase">
                <span>🛡️</span>
                <span>Caught here</span>
              </span>
            )}
          </div>

          {/* Duration Badge */}
          <div className="text-xs font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0">
            {step.duration_ms !== undefined ? `${step.duration_ms} ms` : '—'}
          </div>
        </div>

        {/* Summary text */}
        <p className="text-xs text-slate-600 mt-1.5 font-sans leading-relaxed">
          {step.summary || 'No summary reported for this layer.'}
        </p>

        {/* Expandable Findings List */}
        {hasFindings && (
          <div className="mt-2.5 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              aria-label={`Toggle findings for ${layerTitle}`}
              className="inline-flex items-center gap-1.5 text-[11px] font-mono text-slate-600 hover:text-slate-900 transition-colors"
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
              <ul className="mt-2 space-y-1 pl-2 border-l border-slate-300 text-xs font-mono text-slate-700">
                {step.findings.map((f, i) => (
                  <li key={i} className="text-[11px] text-rose-700 break-words py-0.5">
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
  const trace = Array.isArray(verdict?.trace) ? verdict.trace : [];

  if (!verdict || trace.length === 0) {
    return (
      <div
        data-testid="trace-list"
        className="rounded-lg border border-slate-200 bg-white p-6 text-center"
      >
        <div className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">
          Pipeline Execution Trace
        </div>
        <p className="text-sm text-slate-500">
          No defense layers evaluated yet. Run an analysis above to see chronological layer inspection.
        </p>
      </div>
    );
  }

  // Find the FIRST blocking layer
  const firstBlockIndex = trace.findIndex((t) => t?.status === 'block');

  return (
    <div
      data-testid="trace-list"
      className="rounded-lg border border-slate-200 bg-white p-6"
    >
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <span>Defense Pipeline Trace</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
              {trace.length} LAYERS
            </span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Step-by-step audit of input sanitization, heuristic checks, AI validators, and policy logic.
          </p>
        </div>

        {verdict.latency_ms !== undefined && (
          <div className="text-xs font-mono text-slate-700 bg-slate-50 px-2.5 py-1 rounded border border-slate-200 shrink-0">
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
