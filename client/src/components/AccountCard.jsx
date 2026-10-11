import React, { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { formatPaise } from '../lib/format.js';

export default function AccountCard() {
  const { account, user, refreshAccount } = useApp();
  const [refreshing, setRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAccount();
    } finally {
      setRefreshing(false);
    }
  };

  const userName = user?.name || user?.id || 'Demo User';
  const accountId = account?.account_id || 'ACC-1001';
  const balancePaise = account?.balance_paise !== undefined ? account.balance_paise : 5000000;
  const recentTransactions = (account?.history || []).slice(0, 5);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl backdrop-blur-sm space-y-4">
      {/* Account Header */}
      <div className="flex items-start justify-between border-b border-slate-800/80 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-100 font-mono">
              {userName}
            </h3>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            ID: <span className="text-slate-300">{accountId}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={refreshing}
          aria-label="Refresh account ledger balance and transactions"
          title="Refresh account data"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700"
        >
          <svg
            className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-400' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
            />
          </svg>
        </button>
      </div>

      {/* Balance Display */}
      <div className="rounded-lg bg-slate-950/80 border border-slate-800/80 p-3.5">
        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
          Available Ledger Balance
        </span>
        <div className="text-2xl font-bold font-mono text-emerald-400">
          {formatPaise(balancePaise)}
        </div>
      </div>

      {/* Up to 5 Recent Transactions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
            Recent Activity ({recentTransactions.length})
          </span>
          <span className="text-[10px] text-slate-400 font-mono">Last 5</span>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="rounded-lg bg-slate-950/50 border border-slate-800/60 p-3 text-center text-xs text-slate-400 font-mono">
            No transactions yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60 rounded-lg bg-slate-950/60 border border-slate-800/80 overflow-hidden">
            {recentTransactions.map((tx, idx) => {
              const isCredit = tx.type === 'CREDIT';
              return (
                <div
                  key={tx.id || idx}
                  className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-900/50 transition-colors"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-slate-200 font-medium truncate">
                      {tx.counterparty || 'Counterparty'}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate font-mono">
                      {tx.memo || (tx.date ? new Date(tx.date).toLocaleDateString('en-IN') : '')}
                    </p>
                  </div>
                  <div className="text-right shrink-0 font-mono">
                    <span
                      className={`font-semibold block ${
                        isCredit ? 'text-emerald-400' : 'text-slate-200'
                      }`}
                    >
                      {isCredit ? '+' : '-'}
                      {formatPaise(tx.amount_paise)}
                    </span>
                    <span className="text-[9px] text-slate-400 uppercase">
                      {tx.type}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
