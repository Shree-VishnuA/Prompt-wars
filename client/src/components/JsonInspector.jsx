import React, { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';

/**
 * Hand-written, pure React JSON syntax highlighter.
 * Splits a JSON line into cleanly colored React spans without any external libraries or dangerouslySetInnerHTML.
 */
export function tokenizeLine(line, lineIdx) {
  const indentMatch = line.match(/^(\s*)/);
  const indent = indentMatch ? indentMatch[1] : '';
  const content = line.slice(indent.length);

  if (!content) {
    return [<span key="empty">&nbsp;</span>];
  }

  // Matches:
  // 1: Key before colon: "key":
  // 2: String value: "..."
  // 3: Number: -?123.45
  // 4: Boolean: true|false
  // 5: Null: null
  // 6: Punctuation: {}[],:
  const tokenRegex = /("(?:\\.|[^"\\])*"(?=\s*:))|("(?:\\.|[^"\\])*")|(-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|(\btrue\b|\bfalse\b)|(\bnull\b)|([{}[\],:])|(\s+)/g;

  const spans = [];
  if (indent) {
    spans.push(<span key={`indent-${lineIdx}`}>{indent}</span>);
  }

  let match;
  let lastIndex = 0;
  let tokenIdx = 0;

  while ((match = tokenRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      spans.push(
        <span key={`raw-${lineIdx}-${tokenIdx++}`} className="text-slate-800 dark:text-slate-200">
          {content.slice(lastIndex, match.index)}
        </span>
      );
    }

    const [full, key, str, num, bool, nil, punc, space] = match;

    if (key) {
      spans.push(
        <span key={`key-${lineIdx}-${tokenIdx++}`} className="text-slate-900 dark:text-sky-300 font-semibold">
          {key}
        </span>
      );
    } else if (str) {
      spans.push(
        <span key={`str-${lineIdx}-${tokenIdx++}`} className="text-emerald-700 dark:text-emerald-400">
          {str}
        </span>
      );
    } else if (num) {
      spans.push(
        <span key={`num-${lineIdx}-${tokenIdx++}`} className="text-blue-700 dark:text-amber-400 font-medium">
          {num}
        </span>
      );
    } else if (bool) {
      spans.push(
        <span key={`bool-${lineIdx}-${tokenIdx++}`} className="text-purple-700 dark:text-purple-400 font-semibold">
          {bool}
        </span>
      );
    } else if (nil) {
      spans.push(
        <span key={`nil-${lineIdx}-${tokenIdx++}`} className="text-slate-500 dark:text-slate-400 italic">
          {nil}
        </span>
      );
    } else if (punc) {
      spans.push(
        <span key={`punc-${lineIdx}-${tokenIdx++}`} className="text-slate-600 dark:text-slate-400 font-mono">
          {punc}
        </span>
      );
    } else if (space) {
      spans.push(
        <span key={`space-${lineIdx}-${tokenIdx++}`}>
          {space}
        </span>
      );
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < content.length) {
    spans.push(
      <span key={`tail-${lineIdx}-${tokenIdx++}`} className="text-slate-800 dark:text-slate-200">
        {content.slice(lastIndex)}
      </span>
    );
  }

  return spans;
}

export default function JsonInspector({ verdict: propVerdict } = {}) {
  const { verdict: contextVerdict } = useApp();
  const verdict = propVerdict !== undefined ? propVerdict : contextVerdict;

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hideToken, setHideToken] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!verdict) {
    return (
      <div
        data-testid="json-inspector"
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center shadow-xs"
      >
        <div className="text-xs font-mono text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
          JSON Verdict Inspector
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No verdict generated yet. Evaluated payloads and server verdict tokens will render here.
        </p>
      </div>
    );
  }

  // Prepare data with optional intent_token hiding
  const displayData = { ...verdict };
  if (hideToken && 'intent_token' in displayData) {
    displayData.intent_token = '[REDACTED]';
  }

  const jsonString = JSON.stringify(displayData, null, 2);
  const lines = jsonString.split('\n');

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(jsonString);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = jsonString;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div
      data-testid="json-inspector"
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col"
    >
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800 gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label="JSON Verdict Inspector"
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-100 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            <svg
              className={`w-3.5 h-3.5 text-slate-500 transition-transform ${
                isCollapsed ? '-rotate-90' : 'rotate-0'
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            <span>JSON Verdict Inspector</span>
          </button>
          <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
            {lines.length} lines
          </span>
        </div>

        {/* Action Controls: Hide Token Toggle & Copy JSON Button */}
        <div className="flex items-center flex-wrap gap-3">
          <label className="flex items-center gap-2 text-xs font-mono text-slate-600 dark:text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideToken}
              onChange={(e) => setHideToken(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-700 text-slate-900 focus:ring-slate-900"
            />
            <span>Hide intent_token</span>
          </label>

          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy JSON"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium border transition-colors ${
              copied
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
            }`}
          >
            {copied ? (
              <>
                <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>Copied!</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Copy JSON</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Collapsible Body */}
      {!isCollapsed && (
        <div className="rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 overflow-x-auto max-h-[460px] overflow-y-auto font-mono text-[11px] leading-5 text-slate-800 dark:text-slate-200">
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} className="hover:bg-slate-200/50 dark:hover:bg-slate-900/60 transition-colors">
                  <td className="w-8 select-none pr-3 text-right text-[10px] text-slate-400 dark:text-slate-500 border-r border-slate-200 dark:border-slate-800 align-top">
                    {idx + 1}
                  </td>
                  <td className="pl-3 whitespace-pre text-slate-800 dark:text-slate-200 align-top">
                    {tokenizeLine(line, idx)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isCollapsed && (
        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono py-2 italic">
          Verdict JSON is collapsed. Click above to view raw schema payload.
        </div>
      )}
    </div>
  );
}
