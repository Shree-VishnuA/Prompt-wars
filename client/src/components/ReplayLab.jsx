import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import * as api from '../api/client.js';
import { getThreatCategoryLabel } from '../lib/format.js';

export const GROUP_LABELS = {
  benign: 'Benign Transfers',
  direct_injection: 'Direct Injection',
  roleplay: 'Roleplay Jailbreak',
  memo_injection: 'Memo Injection',
  obfuscation: 'Token Obfuscation',
  exfiltration: 'Data Exfiltration',
  mismatch: 'Amount Mismatch',
  policy: 'Policy Violations',
  ambiguous: 'Ambiguous Requests'
};

export const MATRIX_LAYERS = [
  { key: 'normalization', label: 'Normalization' },
  { key: 'deterministic', label: 'Deterministic' },
  { key: 'llm_judge', label: 'AI Judge' },
  { key: 'grounding', label: 'Grounding' },
  { key: 'policy', label: 'Policy' }
];

export default function ReplayLab() {
  const { setActiveTab, setDraftInput, draftInput } = useApp();

  const [cases, setCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [casesError, setCasesError] = useState(null);

  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [instruction, setInstruction] = useState(draftInput?.instruction || '');
  const [memo, setMemo] = useState(draftInput?.memo || '');
  const [useLlm, setUseLlm] = useState(false);

  useEffect(() => {
    if (draftInput) {
      if (draftInput.instruction !== undefined) setInstruction(draftInput.instruction);
      if (draftInput.memo !== undefined) setMemo(draftInput.memo || '');
    }
  }, [draftInput]);

  const [mutating, setMutating] = useState(false);
  const [mutationResults, setMutationResults] = useState(null);
  const [mutationError, setMutationError] = useState(null);

  const [searchFilter, setSearchFilter] = useState('');

  // Fetch benchmark cases on mount
  useEffect(() => {
    let isMounted = true;
    async function fetchCases() {
      setLoadingCases(true);
      setCasesError(null);
      try {
        const res = await api.labCases();
        if (!isMounted) return;
        if (res.ok && Array.isArray(res.data)) {
          setCases(res.data);
          // Pick the first attack case by default if available
          const firstAttack = res.data.find((c) => c.expected_decision === 'BLOCKED') || res.data[0];
          if (firstAttack) {
            setSelectedCaseId(firstAttack.id);
            setInstruction(firstAttack.instruction || '');
            setMemo(firstAttack.memo || '');
          }
        } else {
          setCasesError(res.error || 'Failed to load test cases');
        }
      } catch (err) {
        if (isMounted) setCasesError(err.message || 'Error fetching cases');
      } finally {
        if (isMounted) setLoadingCases(false);
      }
    }

    fetchCases();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSelectCase = (caseItem) => {
    setSelectedCaseId(caseItem.id);
    setInstruction(caseItem.instruction || '');
    setMemo(caseItem.memo || '');
    setMutationResults(null);
    setMutationError(null);
  };

  const handleMutate = async () => {
    if (!instruction.trim()) return;

    setMutating(true);
    setMutationError(null);

    try {
      const res = await api.labMutate({
        instruction: instruction.trim(),
        memo: memo.trim(),
        useLlm
      });

      if (res.ok && res.data?.variants) {
        setMutationResults(res.data.variants);
      } else {
        setMutationError(res.error || 'Mutation failed. Server might be rate limited.');
      }
    } catch (err) {
      setMutationError(err.message || 'Network error executing mutation');
    } finally {
      setMutating(false);
    }
  };

  const handleLoadVariantIntoFirewall = (variant) => {
    if (setDraftInput) {
      setDraftInput({
        instruction: variant.instruction,
        memo: variant.memo
      });
    }
    setActiveTab('Firewall');
  };

  // Group cases
  const filteredCases = cases.filter(
    (c) =>
      c.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.instruction.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.group.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const grouped = filteredCases.reduce((acc, c) => {
    const grp = c.group || 'other';
    if (!acc[grp]) acc[grp] = [];
    acc[grp].push(c);
    return acc;
  }, {});

  const variants = mutationResults || [];
  const blockedCount = variants.filter((v) => v.verdict?.decision === 'BLOCKED').length;
  const totalCount = variants.length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* LEFT COLUMN: Case Browser */}
      <div className="lg:col-span-4 rounded-xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5 shadow-xl backdrop-blur-sm flex flex-col max-h-[850px]">
        <div className="pb-3 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <span>Test Attack Library</span>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {cases.length} CASES
              </span>
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Curated benign requests and hostile injections across 9 threat groups.
          </p>

          {/* Search Box */}
          <div className="mt-3">
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter cases by name or group..."
              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            />
          </div>
        </div>

        {/* Case List Scroll Area */}
        <div className="flex-1 overflow-y-auto mt-3 pr-1 space-y-4">
          {loadingCases ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="animate-pulse flex flex-col gap-2 p-2 bg-slate-950/50 rounded-lg">
                  <div className="h-3 bg-slate-800 rounded w-1/3" />
                  <div className="h-4 bg-slate-800 rounded w-4/5" />
                </div>
              ))}
            </div>
          ) : casesError ? (
            <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-900/50 text-xs text-rose-300">
              {casesError}
            </div>
          ) : (
            Object.entries(grouped).map(([grpKey, grpCases]) => (
              <div key={grpKey} className="space-y-1.5">
                <div className="flex items-center justify-between px-1 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                  <span>{GROUP_LABELS[grpKey] || grpKey}</span>
                  <span className="text-slate-500">({grpCases.length})</span>
                </div>

                <div className="space-y-1">
                  {grpCases.map((c) => {
                    const isSelected = selectedCaseId === c.id;
                    const isAttack = c.expected_decision === 'BLOCKED';
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectCase(c)}
                        className={`w-full text-left p-2.5 rounded-lg text-xs transition-all border ${
                          isSelected
                            ? 'bg-slate-800 border-emerald-500/50 text-slate-100 shadow-md'
                            : 'bg-slate-950/60 hover:bg-slate-900 border-slate-800/80 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-medium text-slate-200 truncate">
                            {c.name}
                          </span>
                          <span
                            className={`text-[9px] font-mono px-1 py-0.2 rounded uppercase ${
                              isAttack
                                ? 'bg-rose-950/60 text-rose-400 border border-rose-900/60'
                                : 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/60'
                            }`}
                          >
                            {c.expected_decision}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate font-mono">
                          {c.instruction}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* MAIN COLUMN: Editor & Results MATRIX */}
      <div className="lg:col-span-8 space-y-6">
        {/* Attack Editor & Mutation Controls */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6 shadow-xl backdrop-blur-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-800 gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <span>Adversarial Mutation Harness</span>
                <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  REPLAY LAB
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Generate 17 obfuscation, encoding, and jailbreak variants to fuzz multi-layer defenses.
              </p>
            </div>
          </div>

          {/* Editable Instruction & Memo Pair */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                <span>Instruction Payload</span>
                <span className="text-slate-500 font-mono text-[11px]">
                  {instruction.length} chars
                </span>
              </label>
              <textarea
                rows={3}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Enter prompt instruction to mutate..."
                className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                <span>Transaction Memo</span>
                <span className="text-slate-500 font-mono text-[11px]">
                  {memo.length} chars
                </span>
              </label>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Optional memo (treated as data, never instruction)..."
                className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
            </div>
          </div>

          {/* Controls: useLlm Toggle & Mutate Button */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-800/80">
            <div className="flex flex-col gap-0.5">
              <label className="flex items-center gap-2 text-xs font-mono text-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={useLlm}
                  onChange={(e) => setUseLlm(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-emerald-500/30"
                />
                <span className="font-semibold">Enable LLM Verification (Dual-model)</span>
              </label>
              <span className="text-[11px] text-slate-500 font-mono pl-6">
                LLM adds latency and quota use
              </span>
            </div>

            <button
              type="button"
              onClick={handleMutate}
              disabled={mutating || !instruction.trim()}
              className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold font-mono uppercase tracking-wider transition-all shadow-md ${
                mutating || !instruction.trim()
                  ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-950/50'
              }`}
            >
              {mutating ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-slate-950" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Fuzzing 17 Variants...</span>
                </>
              ) : (
                <>
                  <span>⚡</span>
                  <span>Mutate this attack</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {mutationError && (
          <div className="rounded-xl border border-rose-900/60 bg-rose-950/30 p-4 text-xs text-rose-300 font-mono flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <span>{mutationError}</span>
            </div>
            <button
              type="button"
              onClick={handleMutate}
              className="px-2.5 py-1 rounded bg-rose-900/40 hover:bg-rose-900/60 border border-rose-700 text-rose-200"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading Skeletons */}
        {mutating && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="h-4 bg-slate-800 rounded w-1/4 animate-pulse" />
              <div className="h-4 bg-slate-800 rounded w-1/6 animate-pulse" />
            </div>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-10 bg-slate-950/70 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        )}

        {/* Results MATRIX */}
        {!mutating && mutationResults && (
          <div
            data-testid="mutation-matrix"
            className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6 shadow-xl backdrop-blur-sm space-y-4"
          >
            {/* Header & Summary Line */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-800 gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <span>Mutation Defense Matrix</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {totalCount} VARIANTS
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Click any row to load that mutated payload into the Firewall tab.
                </p>
              </div>

              {/* Exact Summary Line: "Blocked X of Y variants" */}
              <div className="text-right">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold bg-slate-950 border border-slate-800 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>
                    Blocked {blockedCount} of {totalCount} variants
                  </span>
                </span>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto rounded-lg border border-slate-800/80 bg-slate-950/70">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400">
                    <th className="py-2.5 px-3 font-semibold">Variant Transform</th>
                    {MATRIX_LAYERS.map((layer) => (
                      <th key={layer.key} className="py-2.5 px-2 font-semibold text-center whitespace-nowrap">
                        {layer.label}
                      </th>
                    ))}
                    <th className="py-2.5 px-3 font-semibold text-center">Decision</th>
                    <th className="py-2.5 px-3 font-semibold">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {variants.map((variant) => {
                    const isBlocked = variant.verdict?.decision === 'BLOCKED';
                    const categoryLabel = getThreatCategoryLabel(variant.verdict?.threat_category);

                    return (
                      <tr
                        key={variant.id}
                        onClick={() => handleLoadVariantIntoFirewall(variant)}
                        title="Click to inspect this variant in the Firewall tab"
                        className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                      >
                        {/* Variant Label */}
                        <td className="py-2.5 px-3 font-medium text-slate-200 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 group-hover:text-emerald-400 transition-colors">
                              ➔
                            </span>
                            <span>{variant.label}</span>
                          </div>
                        </td>

                        {/* 5 Layer Columns */}
                        {MATRIX_LAYERS.map((layer) => {
                          const flagged = Array.isArray(variant.verdict?.layers_flagged) &&
                            variant.verdict.layers_flagged.includes(layer.key);

                          return (
                            <td key={layer.key} className="py-2.5 px-2 text-center">
                              {flagged ? (
                                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-950/60 text-rose-300 border border-rose-800/80">
                                  FLAG
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] text-slate-500 bg-slate-900 border border-slate-800">
                                  pass
                                </span>
                              )}
                            </td>
                          );
                        })}

                        {/* Decision Chip */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                              isBlocked
                                ? 'bg-rose-950/50 text-rose-300 border-rose-800/60'
                                : 'bg-emerald-950/50 text-emerald-300 border-emerald-800/60'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isBlocked ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                            <span>{variant.verdict?.decision || 'UNKNOWN'}</span>
                          </span>
                        </td>

                        {/* Threat Category */}
                        <td className="py-2.5 px-3 text-slate-300 truncate max-w-[160px] text-[11px]">
                          {categoryLabel}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
