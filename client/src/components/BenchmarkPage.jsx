import React, { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import * as api from '../api/client.js';
import { GROUP_LABELS } from './ReplayLab.jsx';

export default function BenchmarkPage() {
  const { setDraftInput, setActiveTab } = useApp();

  const [mode, setMode] = useState('deterministic');
  const [running, setRunning] = useState(false);
  const [benchmarkData, setBenchmarkData] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [is429, setIs429] = useState(false);

  // Cached lab cases for linking failure cases
  const [cachedCases, setCachedCases] = useState(null);

  const ensureCasesLoaded = async () => {
    if (cachedCases) return cachedCases;
    try {
      const res = await api.labCases();
      if (res.ok && Array.isArray(res.data)) {
        setCachedCases(res.data);
        return res.data;
      }
    } catch {
      // Fallback
    }
    return [];
  };

  const handleRunBenchmark = async () => {
    setRunning(true);
    setErrorMsg(null);
    setIs429(false);
    setBenchmarkData(null);

    try {
      const res = await api.labBenchmark(mode);

      if (res.ok && res.data) {
        setBenchmarkData(res.data);
      } else {
        if (res.status === 429) {
          setIs429(true);
          setErrorMsg(
            'Rate limit exceeded (HTTP 429). The benchmark suite is limited to 6 runs per minute to conserve resources. Please wait a moment before retrying.'
          );
        } else {
          setErrorMsg(res.error || 'Benchmark execution failed.');
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'Network error running benchmark');
    } finally {
      setRunning(false);
    }
  };

  const handleOpenInReplayLab = async (failure) => {
    const loadedCases = await ensureCasesLoaded();
    const matched = loadedCases.find((c) => c.id === failure.id);

    if (matched && setDraftInput) {
      setDraftInput({
        instruction: matched.instruction,
        memo: matched.memo || ''
      });
    }
    setActiveTab('Replay Lab');
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Header */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-mono font-medium text-slate-700 border border-slate-200 mb-2">
              Regression Harness • 60 Curated Cases
            </div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900 font-sans">
              Defense Benchmark Harness
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Evaluate real-world security accuracy across 20 benign scenarios and 40 attack vectors
              including prompt injections, jailbreaks, and obfuscation.
            </p>
          </div>

          {/* Run Button */}
          <button
            type="button"
            onClick={handleRunBenchmark}
            disabled={running}
            className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md text-xs font-medium font-mono uppercase tracking-wider transition-colors shrink-0 ${
              running
                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
          >
            {running ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Evaluating 60 Cases...</span>
              </>
            ) : (
              <span>Run benchmark</span>
            )}
          </button>
        </div>

        {/* Mode Toggle Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="text-xs font-mono text-slate-600">
            Select Evaluation Mode:
          </div>

          <div className="inline-flex p-1 rounded-md bg-slate-100 border border-slate-200">
            <button
              type="button"
              onClick={() => setMode('deterministic')}
              className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors ${
                mode === 'deterministic'
                  ? 'bg-white text-emerald-400 font-semibold border border-slate-200 shadow-none'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Deterministic fast</span>
              <span className="block text-[10px] text-slate-500 font-sans">
                Rules & Regex only (~15 ms)
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMode('full')}
              className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors ${
                mode === 'full'
                  ? 'bg-white text-purple-400 font-semibold border border-slate-200 shadow-none'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Full with AI</span>
              <span className="block text-[10px] text-slate-500 font-sans">
                Dual-LLM Extractor & Judge
              </span>
            </button>
          </div>
        </div>

        {/* Indeterminate Progress Bar while running */}
        {running && (
          <div className="pt-2 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-500">
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-900" />
                Evaluating cases across all 11 threat categories...
              </span>
              <span>Running...</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
              <div className="h-full bg-slate-900 rounded-full w-full" />
            </div>
          </div>
        )}
      </div>

      {/* HTTP 429 and General Errors */}
      {errorMsg && (
        <div
          className={`rounded-md border p-4 text-xs font-mono flex items-start gap-3 ${
            is429
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <span className="text-base shrink-0">⚠️</span>
          <div className="space-y-1">
            <p className="font-semibold text-sm">
              {is429 ? 'Rate Limit Exceeded (HTTP 429)' : 'Benchmark Error'}
            </p>
            <p className="leading-relaxed">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Awaiting Benchmark Empty State */}
      {!running && !benchmarkData && !errorMsg && (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-slate-50 text-slate-400 border border-slate-200 mb-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-slate-900">
            No Benchmark Results Yet
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
            Select a mode above and click &quot;Run benchmark&quot; to inspect detection rates,
            false-positive metrics, category precision, and latency breakdowns.
          </p>
        </div>
      )}

      {/* BENCHMARK SCORECARD */}
      {!running && benchmarkData && (
        <div
          data-testid="benchmark-scorecard"
          className="rounded-lg border border-slate-200 bg-white p-6 space-y-6"
        >
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <span>Evaluation Scorecard</span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  {benchmarkData.mode} MODE
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Evaluated against all {benchmarkData.total} cases (20 benign, 40 hostile attacks).
              </p>
            </div>
            <div className="text-xs font-mono text-slate-600 bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
              Total {benchmarkData.total} cases evaluated
            </div>
          </div>

          {/* 4 BIG NUMBER METRIC CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Detection Rate */}
            <div className="rounded-md bg-slate-50 border border-slate-200 p-4 flex flex-col justify-between">
              <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">
                Detection Rate
              </span>
              <div className="mt-2 text-3xl font-bold font-mono text-slate-900">
                {(benchmarkData.detection_rate * 100).toFixed(1)}%
              </div>
              <span className="text-[11px] text-slate-500 mt-1">
                Attacks successfully blocked
              </span>
            </div>

            {/* 2. False-Positive Rate */}
            <div className="rounded-md bg-slate-50 border border-slate-200 p-4 flex flex-col justify-between">
              <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">
                False-Positive Rate
              </span>
              <div
                className={`mt-2 text-3xl font-bold font-mono ${
                  benchmarkData.false_positive_rate === 0
                    ? 'text-slate-900'
                    : benchmarkData.false_positive_rate <= 0.05
                    ? 'text-amber-700'
                    : 'text-rose-700'
                }`}
              >
                {(benchmarkData.false_positive_rate * 100).toFixed(1)}%
              </div>
              <span className="text-[11px] text-slate-500 mt-1">
                Benign transfers flagged
              </span>
            </div>

            {/* 3. Category Accuracy */}
            <div className="rounded-md bg-slate-50 border border-slate-200 p-4 flex flex-col justify-between">
              <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">
                Category Accuracy
              </span>
              <div className="mt-2 text-3xl font-bold font-mono text-slate-900">
                {(benchmarkData.category_accuracy * 100).toFixed(1)}%
              </div>
              <span className="text-[11px] text-slate-500 mt-1">
                Threat taxonomy matches
              </span>
            </div>

            {/* 4. Avg Latency */}
            <div className="rounded-md bg-slate-50 border border-slate-200 p-4 flex flex-col justify-between">
              <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">
                Avg Latency
              </span>
              <div className="mt-2 text-3xl font-bold font-mono text-slate-900">
                {benchmarkData.avg_latency_ms} ms
              </div>
              <span className="text-[11px] text-slate-500 mt-1">
                Mean pipeline runtime
              </span>
            </div>
          </div>

          {/* PER-GROUP BAR LIST */}
          <div className="rounded-md bg-slate-50 border border-slate-200 p-5 space-y-3">
            <h4 className="text-xs font-mono text-slate-600 uppercase tracking-wider">
              Per-Group Defense Breakdown
            </h4>

            <div className="space-y-2.5">
              {Object.entries(benchmarkData.by_group || {}).map(([groupKey, stats]) => {
                const total = stats.total || 0;
                const passed = stats.passed || 0;
                const pct = total > 0 ? Math.round((passed / total) * 100) : 0;
                const groupLabel = GROUP_LABELS[groupKey] || groupKey.replace(/_/g, ' ');

                return (
                  <div key={groupKey} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-800">{groupLabel}</span>
                      <span className="text-slate-500">
                        {passed} / {total} ({pct}%)
                      </span>
                    </div>

                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          pct === 100
                            ? 'bg-emerald-600'
                            : pct >= 80
                            ? 'bg-amber-500'
                            : 'bg-rose-600'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* FAILURES TABLE */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono text-slate-600 uppercase tracking-wider">
                Case Failures ({benchmarkData.failures?.length || 0})
              </h4>
              {benchmarkData.failures?.length > 0 && (
                <span className="text-[11px] text-slate-500 font-mono">
                  Click a row to load the case in Replay Lab
                </span>
              )}
            </div>

            {(!benchmarkData.failures || benchmarkData.failures.length === 0) ? (
              <div className="rounded-md bg-emerald-50 border border-emerald-200 p-4 text-center text-xs font-mono text-emerald-800">
                Zero Failures — All {benchmarkData.total} benchmark cases passed expected decision and category tests.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600 bg-slate-50">
                      <th className="py-2.5 px-3 font-semibold">Case ID</th>
                      <th className="py-2.5 px-3 font-semibold">Name</th>
                      <th className="py-2.5 px-3 font-semibold">Expected</th>
                      <th className="py-2.5 px-3 font-semibold">Actual</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {benchmarkData.failures.map((f) => (
                      <tr
                        key={f.id}
                        onClick={() => handleOpenInReplayLab(f)}
                        className="hover:bg-slate-50 transition-colors cursor-pointer group"
                      >
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                          {f.id}
                        </td>
                        <td className="py-2.5 px-3 text-slate-900 font-sans font-medium whitespace-nowrap">
                          {f.name}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="text-emerald-700 font-semibold">
                            {f.expected.decision}
                          </span>
                          <span className="text-slate-400 ml-1.5">
                            ({f.expected.category})
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="text-rose-700 font-semibold">
                            {f.actual.decision}
                          </span>
                          <span className="text-slate-400 ml-1.5">
                            ({f.actual.category})
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenInReplayLab(f);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors text-[11px]"
                          >
                            <span>Open in Replay Lab</span>
                            <span>➔</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
