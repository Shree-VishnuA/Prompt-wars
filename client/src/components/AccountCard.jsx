import React, { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { formatPaise } from '../lib/format.js';

export default function AccountCard() {
  const { account, user, refreshAccount, setDraftInput } = useApp();
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
  const contacts = account?.contacts?.length
    ? account.contacts
    : [
        { id: 'c_rahul', name: 'Rahul Sharma', alias: 'rahul' },
        { id: 'c_priya', name: 'Priya Nair', alias: 'priya' },
        { id: 'c_amit', name: 'Amit Verma', alias: 'amit' },
        { id: 'c_mom', name: 'Mom', alias: 'mom' }
      ];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
      {/* Account Header */}
      <div className="flex items-start justify-between border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            <h3 className="text-sm font-semibold text-slate-900 font-sans">
              {userName}
            </h3>
          </div>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            ID: <span className="text-slate-700">{accountId}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={refreshing}
          aria-label="Refresh account ledger balance and transactions"
          title="Refresh account data"
          className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors border border-transparent"
        >
          <svg
            className={`w-4 h-4 ${refreshing ? 'animate-spin text-slate-900' : ''}`}
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
      <div className="rounded-md bg-slate-50 border border-slate-200 p-3.5">
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-1">
          Available Ledger Balance
        </span>
        <div className="text-2xl font-bold font-mono text-slate-900">
          {formatPaise(balancePaise)}
        </div>
      </div>

      {/* Up to 5 Recent Transactions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">
            Recent Activity ({recentTransactions.length})
          </span>
          <span className="text-[10px] text-slate-400 font-mono">Last 5</span>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="rounded-md bg-slate-50 border border-slate-200 p-3 text-center text-xs text-slate-500 font-mono">
            No transactions yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 rounded-md bg-white border border-slate-200 overflow-hidden">
            {recentTransactions.map((tx, idx) => {
              const isCredit = tx.type === 'CREDIT';
              return (
                <div
                  key={tx.id || idx}
                  className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-slate-900 font-medium truncate">
                      {tx.counterparty || 'Counterparty'}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate font-mono">
                      {tx.memo || (tx.date ? new Date(tx.date).toLocaleDateString('en-IN') : '')}
                    </p>
                  </div>
                  <div className="text-right shrink-0 font-mono">
                    <span
                      className={`font-semibold block ${
                        isCredit ? 'text-emerald-700' : 'text-slate-900'
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

      {/* Whitelisted Payees / Registered Beneficiaries Directory */}
      <div className="pt-3 border-t border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">
            Whitelisted Payees ({contacts.length})
          </span>
          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-mono font-medium">
            Verified
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {contacts.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() =>
                setDraftInput &&
                setDraftInput({
                  instruction: `Send ₹500 to ${c.alias || c.name}`,
                  memo: 'dinner split'
                })
              }
              title={`Click to draft: Send ₹500 to ${c.name}`}
              className="p-2 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-all hover:border-slate-300 group"
            >
              <div className="text-xs font-semibold text-slate-900 group-hover:text-emerald-700 truncate">
                👤 {c.name}
              </div>
              <div className="text-[10px] font-mono text-slate-500 truncate">
                @{c.alias}
              </div>
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[10px] text-slate-400 font-mono leading-tight">
          Payments to unlisted entities (e.g. Aarav) are blocked by Intent Grounding.
        </p>
      </div>
    </div>
  );
}
