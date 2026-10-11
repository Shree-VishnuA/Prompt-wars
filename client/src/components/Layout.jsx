import React from 'react';
import { useApp } from '../context/AppContext.jsx';
import RequestForm from './RequestForm.jsx';

function StatusPill({ health }) {
  const llmStatus = health?.llm || 'offline';
  const policyVersion = health?.policy_version || '1.0.0';

  let dotColor = 'bg-slate-500';
  let badgeClasses = 'bg-slate-900/80 text-slate-300 border-slate-700';

  if (llmStatus === 'online') {
    dotColor = 'bg-emerald-400';
    badgeClasses = 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30';
  } else if (llmStatus === 'degraded') {
    dotColor = 'bg-amber-400';
    badgeClasses = 'bg-amber-950/40 text-amber-300 border-amber-500/30';
  } else if (llmStatus === 'disabled') {
    dotColor = 'bg-rose-400';
    badgeClasses = 'bg-rose-950/40 text-rose-300 border-rose-500/30';
  }

  return (
    <div
      data-testid="status-pill"
      className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-mono rounded-full border shadow-sm transition-colors ${badgeClasses}`}
    >
      <span className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${dotColor} ${llmStatus === 'online' ? 'animate-pulse' : ''}`} />
        <span className="font-semibold uppercase tracking-wider">LLM {llmStatus}</span>
      </span>
      <span className="text-slate-600 select-none">•</span>
      <span className="text-slate-400">v{policyVersion}</span>
    </div>
  );
}

function FirewallPlaceholder() {
  return (
    <div className="space-y-6">
      <RequestForm />
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/20">
              Layer 1-7 Defensive Pipeline
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-100">
              Transaction Intent Firewall
            </h2>
            <p className="mt-1 text-sm text-slate-400 max-w-2xl">
              Inspect natural language instructions and transaction memos for prompt injections,
              roleplay jailbreaks, obfuscation, and amount tampering before granting execution tokens.
            </p>
          </div>
          <div className="hidden sm:block text-right">
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Real-time Active
            </span>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg bg-slate-950/60 p-4 border border-slate-800/80">
            <div className="text-xs font-mono text-slate-400">DETERMINISTIC DEFENSE</div>
            <div className="mt-2 text-lg font-semibold text-slate-200">Regex & Entropy Engine</div>
            <p className="mt-1 text-xs text-slate-400">Zero-width, base64, homoglyph, delimiter filters</p>
          </div>
          <div className="rounded-lg bg-slate-950/60 p-4 border border-slate-800/80">
            <div className="text-xs font-mono text-slate-400">SEMANTIC PARSER</div>
            <div className="mt-2 text-lg font-semibold text-slate-200">Grammar & Grounding</div>
            <p className="mt-1 text-xs text-slate-400">Strict recipient verification & memo conflict guards</p>
          </div>
          <div className="rounded-lg bg-slate-950/60 p-4 border border-slate-800/80">
            <div className="text-xs font-mono text-slate-400">LLM REASONING</div>
            <div className="mt-2 text-lg font-semibold text-slate-200">Dual-Model Validator</div>
            <p className="mt-1 text-xs text-slate-400">Isolated extractor and adversarial judge evaluation</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReplayLabPlaceholder() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-sm">
        <div className="inline-flex items-center gap-2 rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400 border border-amber-500/20">
          Adversarial Testing Ground
        </div>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-100">
          Replay & Mutation Lab
        </h2>
        <p className="mt-1 text-sm text-slate-400 max-w-2xl">
          Fuzz firewall defenses against 17 deterministic payload mutations including rot13, cyrillic homoglyphs,
          URL-encoding, and system prompt delimiters.
        </p>
        <div className="mt-6 rounded-lg bg-slate-950/60 p-5 border border-slate-800 text-sm text-slate-400 font-mono">
          Ready for mutation payloads...
        </div>
      </div>
    </div>
  );
}

function BenchmarkPlaceholder() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-sm">
        <div className="inline-flex items-center gap-2 rounded-md bg-purple-500/10 px-2.5 py-1 text-xs font-medium text-purple-400 border border-purple-500/20">
          Regression Harness
        </div>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-100">
          Defense Benchmark Suite
        </h2>
        <p className="mt-1 text-sm text-slate-400 max-w-2xl">
          Continuous evaluation across 60 curated test cases (20 benign, 40 hostile) measuring detection
          rates, false positive ratios, and pipeline latency.
        </p>
        <div className="mt-6 rounded-lg bg-slate-950/60 p-5 border border-slate-800 text-sm text-slate-400 font-mono">
          Ready to run benchmark suite...
        </div>
      </div>
    </div>
  );
}

function AuditPlaceholder() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-sm">
        <div className="inline-flex items-center gap-2 rounded-md bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-400 border border-sky-500/20">
          Tamper-Evident Ring Buffer
        </div>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-100">
          Security Audit Ledger
        </h2>
        <p className="mt-1 text-sm text-slate-400 max-w-2xl">
          Circular buffer recording the last 50 decisions with sanitized instruction summaries,
          detected threat categories, risk scores, and granular timing breakdowns.
        </p>
        <div className="mt-6 rounded-lg bg-slate-950/60 p-5 border border-slate-800 text-sm text-slate-400 font-mono">
          Audit ledger ready...
        </div>
      </div>
    </div>
  );
}

const TABS = [
  { id: 'Firewall', label: 'Firewall' },
  { id: 'Replay Lab', label: 'Replay Lab' },
  { id: 'Benchmark', label: 'Benchmark' },
  { id: 'Audit', label: 'Audit' }
];

export default function Layout() {
  const { health, user, account, activeTab, setActiveTab } = useApp();

  const currentTab = TABS.find(
    (t) => t.id.toLowerCase() === (activeTab || '').toLowerCase() || t.label.toLowerCase() === (activeTab || '').toLowerCase()
  )?.id || 'Firewall';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3.5 gap-4">
            {/* Logo and Brand */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-slate-800 border border-emerald-500/30 text-emerald-400 shadow-md shadow-emerald-950/50">
                {/* Shield SVG */}
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                  />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-slate-100 font-mono">
                    Bankism
                  </h1>
                  <span className="text-[10px] uppercase font-mono tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    CONSOLE
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Transaction Intent Firewall
                </p>
              </div>
            </div>

            {/* Right Header: Status Pill and Account Context */}
            <div className="flex items-center flex-wrap gap-3">
              {account && (
                <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-slate-950/70 border border-slate-800 rounded-lg text-xs font-mono text-slate-300">
                  <span className="text-slate-500">ACC:</span>
                  <span className="text-slate-200">{account.account_id || 'ACC-1001'}</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-emerald-400 font-semibold">
                    ₹{((account.balance_paise || 0) / 100).toLocaleString('en-IN')}
                  </span>
                </div>
              )}

              {user && (
                <div className="hidden md:flex items-center gap-2 px-2.5 py-1 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  <span className="font-medium text-slate-200">{user.name || user.id}</span>
                </div>
              )}

              <StatusPill health={health} />
            </div>
          </div>

          {/* Navigation Tab Bar (Plain State, Responsive Stack on Mobile) */}
          <nav className="flex flex-col sm:flex-row gap-1 border-t border-slate-800/60 pt-2 pb-1.5">
            {TABS.map((tab) => {
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.label)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-150 text-left sm:text-center ${
                    isActive
                      ? 'bg-slate-800 text-emerald-400 border border-slate-700/80 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentTab === 'Firewall' && <FirewallPlaceholder />}
        {currentTab === 'Replay Lab' && <ReplayLabPlaceholder />}
        {currentTab === 'Benchmark' && <BenchmarkPlaceholder />}
        {currentTab === 'Audit' && <AuditPlaceholder />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-4 text-center text-xs text-slate-600">
        Bankism Security Operations • Multi-Layer Prompt Injection Defense
      </footer>
    </div>
  );
}
