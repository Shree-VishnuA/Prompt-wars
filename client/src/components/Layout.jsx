import React from 'react';
import { useApp } from '../context/AppContext.jsx';
import RequestForm from './RequestForm.jsx';
import VerdictPanel from './VerdictPanel.jsx';
import TraceTimeline from './TraceTimeline.jsx';
import JsonInspector from './JsonInspector.jsx';
import AccountCard from './AccountCard.jsx';
import ConfirmTransfer from './ConfirmTransfer.jsx';
import AuthButton from './AuthButton.jsx';
import ReplayLab from './ReplayLab.jsx';
import BenchmarkPage from './BenchmarkPage.jsx';
import AuditLog from './AuditLog.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import Toast from './Toast.jsx';

function StatusPill({ health }) {
  const llmStatus = health?.llm || 'offline';
  const policyVersion = health?.policy_version || '1.0.0';

  let dotColor = 'bg-slate-400';
  let badgeClasses = 'bg-slate-50 text-slate-700 border-slate-200';

  if (llmStatus === 'online') {
    dotColor = 'bg-emerald-600';
    badgeClasses = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  } else if (llmStatus === 'degraded') {
    dotColor = 'bg-amber-500';
    badgeClasses = 'bg-amber-50 text-amber-800 border-amber-200';
  } else if (llmStatus === 'disabled') {
    dotColor = 'bg-rose-500';
    badgeClasses = 'bg-rose-50 text-rose-800 border-rose-200';
  }

  return (
    <div
      data-testid="status-pill"
      className={`inline-flex items-center gap-2 px-2.5 py-1 text-xs font-mono rounded-md border whitespace-nowrap ${badgeClasses}`}
    >
      <span className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
        <span className="font-semibold uppercase tracking-wider">LLM {llmStatus}</span>
      </span>
      <span className="text-slate-300 select-none">•</span>
      <span className="text-slate-500">v{policyVersion}</span>
    </div>
  );
}

function FirewallPlaceholder() {
  const { verdict, loading } = useApp();
  const analysisRef = React.useRef(null);
  const [viewMode, setViewMode] = React.useState('trace');

  // Smooth scroll to analysis workbench on mobile/tablet when analyzing
  React.useEffect(() => {
    if (loading || verdict) {
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        analysisRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [loading, verdict]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* LEFT COLUMN (5 cols): Input Console & Intent Desk */}
      <div className="lg:col-span-5 space-y-6">
        <RequestForm />
        <ConfirmTransfer />
        <AccountCard />
      </div>

      {/* RIGHT COLUMN (7 cols): Live Analysis Workbench - VISIBLE IN THE SAME VIEWPORT */}
      <div
        ref={analysisRef}
        id="firewall-analysis-section"
        className="lg:col-span-7 space-y-4 lg:sticky lg:top-6"
      >
        <VerdictPanel />

        {/* View Switcher Controls */}
        <div className="flex items-center justify-between gap-3 px-0.5">
          <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs font-mono font-medium">
            <button
              type="button"
              onClick={() => setViewMode('trace')}
              className={`px-3 py-1 rounded-md transition-all ${
                viewMode === 'trace'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              🛡️ Defense Trace
            </button>
            <button
              type="button"
              onClick={() => setViewMode('json')}
              className={`px-3 py-1 rounded-md transition-all ${
                viewMode === 'json'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {'{ }'} Raw JSON
            </button>
       
          </div>
        </div>

        {/* Dynamic Display */}
        {viewMode === 'split' ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
            <TraceTimeline />
            <JsonInspector />
          </div>
        ) : viewMode === 'json' ? (
          <div>
            <JsonInspector />
          </div>
        ) : (
          <div>
            <TraceTimeline />
          </div>
        )}
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
  {
    id: 'Firewall',
    label: 'Firewall',
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    )
  },
  {
    id: 'Replay Lab',
    label: 'Replay Lab',
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.942A4.5 4.5 0 0115.91 17H8.09a4.5 4.5 0 01-2.32-.658L4.2 15.3m15.6 0a2.25 2.25 0 00.4-1.228V10.5a6 6 0 00-6-6h-4.5a6 6 0 00-6 6v3.572a2.25 2.25 0 00.4 1.228" />
      </svg>
    )
  },
  {
    id: 'Benchmark',
    label: 'Benchmark',
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    )
  },
  {
    id: 'Audit',
    label: 'Audit',
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    )
  }
];

function BankLogoIcon({ className = "w-4 h-4" }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3L2 9h20L12 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 10v7m5-7v7m6-7v7m5-7v7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 18h20M1 21h22" />
    </svg>
  );
}

function ThemeToggle({ theme, toggleTheme }) {
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 border border-slate-200 bg-white hover:bg-slate-100 transition-colors shrink-0"
    >
      {isDark ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
        </svg>
      )}
    </button>
  );
}

export default function Layout() {
  const { health, user, account, activeTab, setActiveTab, serverOffline, fetchHealth, theme, toggleTheme } = useApp();
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);

  const currentTab = TABS.find(
    (t) => t.id.toLowerCase() === (activeTab || '').toLowerCase() || t.label.toLowerCase() === (activeTab || '').toLowerCase()
  )?.id || 'Firewall';

  const tabRefs = React.useRef([]);

  const handleTabKeyDown = (e) => {
    const currentIndex = TABS.findIndex((t) => t.id === currentTab);
    let nextIndex = null;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % TABS.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIndex = TABS.length - 1;
    }

    if (nextIndex !== null) {
      setActiveTab(TABS[nextIndex].label);
      tabRefs.current[nextIndex]?.focus();
    }
  };

  const currentTabSlug = currentTab.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-slate-200 selection:text-slate-900">
      {/* Global Offline / Server-Unreachable Banner */}
      {serverOffline && (
        <div
          role="alert"
          data-testid="offline-banner"
          className="bg-rose-50 border-b border-rose-200 text-rose-900 px-3 sm:px-6 py-2.5 text-xs font-mono flex flex-wrap items-center justify-between gap-3 sticky top-0 z-50"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" />
            <span className="font-semibold uppercase tracking-wider text-rose-950">
              Server Unreachable / Offline:
            </span>
            <span className="text-rose-800">
              Backend health check poll failed. Service is currently offline or unreachable.
            </span>
          </div>
          <button
            type="button"
            onClick={() => fetchHealth && fetchHealth()}
            aria-label="Retry connection"
            className="px-2.5 py-1 rounded bg-white hover:bg-rose-100 text-rose-900 border border-rose-300 text-[11px] font-semibold transition-colors"
          >
            Retry connection
          </button>
        </div>
      )}

      {/* Mobile Top App Bar (visible on < lg screens) */}
      <header className="lg:hidden sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Toggle navigation menu"
            className="p-1.5 rounded-md text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-md border border-slate-200 bg-slate-50 text-slate-900">
              <BankLogoIcon className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-sm font-semibold tracking-tight text-slate-900 font-sans">Bankism</span>
              <span className="block text-[10px] text-slate-500 font-mono">Intent Firewall</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono rounded border bg-slate-50 text-slate-700 border-slate-200">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                health?.llm === 'online' ? 'bg-emerald-600' : 'bg-slate-400'
              }`}
            />
            <span className="text-[11px] font-semibold uppercase">{health?.llm || 'offline'}</span>
          </div>
        </div>
      </header>

      {/* Main Layout Container with Sidebar and Content */}
      <div className="flex-1 flex flex-col lg:flex-row w-full min-h-[calc(100vh-48px)]">
        {/* Mobile Backdrop Overlay */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Responsive Sidebar (docked on desktop, off-canvas drawer on mobile) */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 xl:w-72 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:h-screen lg:sticky lg:top-0 ${
            mobileSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          {/* Top Brand Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center justify-center w-8 h-8 rounded-md border border-slate-200 bg-slate-50 text-slate-900 shrink-0">
                <BankLogoIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-semibold tracking-tight text-slate-900 font-sans truncate">
                    Bankism
                  </h1>
                  <span className="text-[10px] uppercase font-mono tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                    CONSOLE
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate">
                  Transaction Intent Firewall
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <ThemeToggle theme={theme} toggleTheme={toggleTheme} />

              {/* Close button on mobile drawer */}
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                aria-label="Close navigation menu"
                className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Sidebar Navigation: WAI-ARIA role="tablist" */}
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <div className="px-3 pb-2 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
              Navigation
            </div>
            <nav
              role="tablist"
              aria-label="Security Console Sections"
              onKeyDown={handleTabKeyDown}
              className="space-y-1"
            >
              {TABS.map((tab, idx) => {
                const isActive = currentTab === tab.id;
                const tabSlug = tab.id.toLowerCase().replace(/\s+/g, '-');
                return (
                  <button
                    key={tab.id}
                    id={`tab-${tabSlug}`}
                    aria-selected={isActive}
                    aria-controls={`panel-${tabSlug}`}
                    tabIndex={isActive ? 0 : -1}
                    ref={(el) => { tabRefs.current[idx] = el; }}
                    onClick={() => {
                      setActiveTab(tab.label);
                      setMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left ${
                      isActive
                        ? 'bg-slate-900 text-white font-medium shadow-none'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {tab.icon}
                    <span className="flex-1">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Footer: Account Context, Auth, Health */}
          <div className="p-3.5 border-t border-slate-200 bg-slate-50 space-y-2.5">
            {account && (
              <div className="px-3 py-2 bg-white border border-slate-200 rounded-md text-xs font-mono text-slate-700">
                <div className="flex items-center justify-between text-slate-500 text-[10px] uppercase">
                  <span>Active Account</span>
                  <span className="text-slate-900 font-semibold">{account.account_id || 'ACC-1001'}</span>
                </div>
                <div className="mt-1 text-sm font-bold text-slate-900">
                  ₹{((account.balance_paise || 0) / 100).toLocaleString('en-IN')}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">System</span>
                <StatusPill health={health} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Session</span>
                <AuthButton />
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0 flex flex-col bg-slate-50">
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            {currentTab === 'Firewall' && (
              <div role="tabpanel" id="panel-firewall" aria-labelledby="tab-firewall" tabIndex={0} className="focus:outline-none">
                <ErrorBoundary panelName="Firewall">
                  <FirewallPlaceholder />
                </ErrorBoundary>
              </div>
            )}
            {currentTab === 'Replay Lab' && (
              <div role="tabpanel" id="panel-replay-lab" aria-labelledby="tab-replay-lab" tabIndex={0} className="focus:outline-none">
                <ErrorBoundary panelName="Replay Lab">
                  <ReplayLab />
                </ErrorBoundary>
              </div>
            )}
            {currentTab === 'Benchmark' && (
              <div role="tabpanel" id="panel-benchmark" aria-labelledby="tab-benchmark" tabIndex={0} className="focus:outline-none">
                <ErrorBoundary panelName="Benchmark">
                  <BenchmarkPage />
                </ErrorBoundary>
              </div>
            )}
            {currentTab === 'Audit' && (
              <div role="tabpanel" id="panel-audit" aria-labelledby="tab-audit" tabIndex={0} className="focus:outline-none">
                <ErrorBoundary panelName="Audit">
                  <AuditLog />
                </ErrorBoundary>
              </div>
            )}
          </main>

          {/* Accessible Toast Notifications */}
          <Toast />

          {/* Clean Footer */}
          <footer className="border-t border-slate-200 py-5 text-center text-xs text-slate-500 bg-white">
            Bankism Security Operations • Multi-Layer Prompt Injection Defense
          </footer>
        </div>
      </div>
    </div>
  );
}
