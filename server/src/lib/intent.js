import { findAmounts, parseAmountText } from './amount.js';
import { SEED_CONTACTS } from './mockBank.js';

export function resolveContact(contacts = SEED_CONTACTS, text = '') {
  if (!text || typeof text !== 'string') return null;
  const normalized = text.trim().toLowerCase();
  if (!normalized) return null;

  const list = contacts && contacts.length > 0 ? contacts : SEED_CONTACTS;

  const matches = list.filter((c) => {
    const alias = (c.alias || '').toLowerCase();
    const name = (c.name || '').toLowerCase();
    const id = (c.id || '').toLowerCase();

    return (
      alias === normalized ||
      name === normalized ||
      id === normalized ||
      name.includes(normalized) ||
      normalized.includes(alias)
    );
  });

  if (matches.length === 1) {
    return matches[0];
  }

  const exactMatches = matches.filter((c) => {
    return (
      (c.alias || '').toLowerCase() === normalized ||
      (c.name || '').toLowerCase() === normalized ||
      (c.id || '').toLowerCase() === normalized
    );
  });

  if (exactMatches.length === 1) {
    return exactMatches[0];
  }

  return null;
}

export function parseIntent(normalizedInstruction, contacts = SEED_CONTACTS) {
  const activeContacts = contacts && contacts.length > 0 ? contacts : SEED_CONTACTS;
  const original =
    typeof normalizedInstruction === 'string'
      ? normalizedInstruction
      : normalizedInstruction?.original || normalizedInstruction?.normalized || '';
  const text = (
    typeof normalizedInstruction === 'string'
      ? normalizedInstruction
      : normalizedInstruction?.normalized || normalizedInstruction?.original || ''
  )
    .trim()
    .toLowerCase();

  const reasons = [];
  let ambiguous = false;
  let action = 'UNSUPPORTED';
  let amount = null;
  let recipient = null;
  let recipient_text = null;

  // 1. Action grammar classification
  const isTransfer = /\b(?:send|transfer|pay|give|bhejo)\b/i.test(text);
  const isBalance =
    /\b(?:balance|available\s+funds|my\s+balance|check\s+balance|account\s+balance)\b/i.test(text) ||
    /\bhow\s+much\s+(?:money\s+)?(?:do\s+i\s+have|in\s+my\s+account)\b/i.test(text) ||
    /\bwhat\s+is\s+my\s+balance\b/i.test(text);
  const isHistory =
    /\b(?:history|statement|recent\s+transactions|past\s+transactions|transaction\s+history)\b/i.test(text) ||
    /\blast\s+(\d+)\s+transactions\b/i.test(text) ||
    /\bshow\s+(?:my\s+)?(?:last\s+)?transactions\b/i.test(text);

  if (isTransfer) {
    action = 'TRANSFER';
  } else if (isBalance) {
    action = 'BALANCE_INQUIRY';
  } else if (isHistory) {
    action = 'TRANSACTION_HISTORY';
  } else {
    action = 'UNSUPPORTED';
    return {
      action,
      amount: null,
      recipient: null,
      recipient_text: null,
      ambiguous: false,
      reasons: ['UNSUPPORTED_ACTION']
    };
  }

  // 2. Check for another account ID in the text (e.g. ACC-2002 while user is ACC-1001)
  if (/\bACC-(?!1001\b)\d{4}\b/i.test(text)) {
    ambiguous = true;
    reasons.push('CONFLICTING_ACCOUNT_ID');
  }

  // 3. For Read Actions (Balance / History), return immediately
  if (action === 'BALANCE_INQUIRY' || action === 'TRANSACTION_HISTORY') {
    return {
      action,
      amount: null,
      recipient: null,
      recipient_text: null,
      ambiguous,
      reasons
    };
  }

  // 4. TRANSFER Action Analysis
  // Check vague words: "all", "everything", "some money", "same as before"
  if (/\b(?:all|everything|some\s+money|same\s+as\s+before)\b/i.test(text)) {
    ambiguous = true;
    reasons.push('VAGUE_WORDS');
  }

  // Extract amounts
  const extractedAmounts = findAmounts(original || text);
  if (extractedAmounts.length === 0) {
    if (!reasons.includes('VAGUE_WORDS')) {
      ambiguous = true;
      reasons.push('NO_AMOUNT');
    }
  } else if (extractedAmounts.length === 1) {
    const single = extractedAmounts[0];
    amount = {
      text: single.text,
      paise: single.paise,
      currency: single.currency
    };
    if (single.currency !== null && single.currency !== 'INR') {
      ambiguous = true;
      reasons.push('UNSUPPORTED_CURRENCY');
    }
  } else {
    // Check if multiple distinct amounts exist
    const distinctPaise = new Set(extractedAmounts.map((a) => a.paise));
    if (distinctPaise.size > 1) {
      ambiguous = true;
      reasons.push('MULTIPLE_AMOUNTS');
    } else {
      amount = {
        text: extractedAmounts[0].text,
        paise: extractedAmounts[0].paise,
        currency: extractedAmounts[0].currency
      };
    }
  }

  // Extract Recipient
  const matchedContacts = [];
  for (const contact of activeContacts) {
    const aliasRegex = new RegExp(`\\b${contact.alias}\\b`, 'i');
    const nameRegex = new RegExp(`\\b${contact.name}\\b`, 'i');
    const idRegex = new RegExp(`\\b${contact.id}\\b`, 'i');

    if (aliasRegex.test(text) || nameRegex.test(text) || idRegex.test(text)) {
      matchedContacts.push(contact);
    }
  }

  if (matchedContacts.length === 1) {
    recipient = matchedContacts[0];
    recipient_text = matchedContacts[0].name;
  } else if (matchedContacts.length > 1) {
    ambiguous = true;
    recipient = null;
    recipient_text = matchedContacts.map((c) => c.name).join(', ');
    reasons.push('MULTIPLE_RECIPIENTS');
  } else {
    // Check if a recipient was attempted (e.g. "to <target>" or "<target> ko")
    const toMatch = text.match(/\bto\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
    const koMatch = text.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s+ko\b/i);
    const target = toMatch ? toMatch[1] : koMatch ? koMatch[1] : null;

    if (target && !/^(?:account|the|my|all)$/i.test(target)) {
      recipient = null;
      recipient_text = target;
      ambiguous = true;
      reasons.push('UNKNOWN_RECIPIENT');
    } else {
      ambiguous = true;
      recipient = null;
      recipient_text = null;
      reasons.push('NO_RECIPIENT');
    }
  }

  return {
    action,
    amount,
    recipient,
    recipient_text,
    ambiguous,
    reasons
  };
}

export function checkMemoConflict(memoNormalized, intent) {
  const reasons = [];

  const mainMemo =
    typeof memoNormalized === 'string'
      ? memoNormalized
      : memoNormalized?.normalized || memoNormalized?.original || '';
  const layers = memoNormalized?.layers || [];

  const allMemoTexts = [mainMemo, ...layers.map((l) => l.text)].filter(Boolean);

  for (const memoText of allMemoTexts) {
    // 1. Check for any conflicting amounts in the memo
    const memoAmounts = findAmounts(memoText);
    for (const ma of memoAmounts) {
      if (!intent.amount || ma.paise !== intent.amount.paise) {
        reasons.push(`MEMO_AMOUNT_CONFLICT: memo amount ${ma.paise} differs from intent amount ${intent.amount?.paise || 'none'}`);
      }
    }

    // 2. Check for any account IDs present in the memo
    if (/\bACC-\d{4}\b/i.test(memoText)) {
      reasons.push('MEMO_ACCOUNT_ID_PRESENT');
    }

    // 3. Check for any contact name/alias differing from chosen recipient
    for (const contact of SEED_CONTACTS) {
      const aliasRegex = new RegExp(`\\b${contact.alias}\\b`, 'i');
      const nameRegex = new RegExp(`\\b${contact.name}\\b`, 'i');

      if (aliasRegex.test(memoText) || nameRegex.test(memoText)) {
        if (!intent.recipient || contact.id !== intent.recipient.id) {
          reasons.push(`MEMO_RECIPIENT_CONFLICT: memo mentions ${contact.name} but recipient is ${intent.recipient?.name || 'none'}`);
        }
      }
    }
  }

  const uniqueReasons = Array.from(new Set(reasons));
  return {
    conflict: uniqueReasons.length > 0,
    reasons: uniqueReasons
  };
}

export function verifyGrounding(llmExtract, instructionNormalized, deterministicIntent, contacts = SEED_CONTACTS) {
  const reasons = [];

  const rawInstruction =
    typeof instructionNormalized === 'string'
      ? instructionNormalized
      : instructionNormalized?.original || instructionNormalized?.normalized || '';
  const rawInstructionLower = rawInstruction.toLowerCase();

  // Rule 1: If deterministic parsing failed or is ambiguous, but LLM extracted actionable values
  if (deterministicIntent.action === 'UNSUPPORTED' || deterministicIntent.ambiguous) {
    if (llmExtract.action !== 'UNSUPPORTED' || llmExtract.amount_text || llmExtract.recipient_text) {
      reasons.push('DETERMINISTIC_FAILED_BUT_LLM_EXTRACTED');
      return {
        grounded: false,
        reasons
      };
    }
  }

  // Rule 2: LLM action must equal deterministic action
  if (llmExtract.action !== deterministicIntent.action) {
    reasons.push(`ACTION_MISMATCH: expected ${deterministicIntent.action}, got ${llmExtract.action}`);
  }

  // Rule 3: Amount grounding
  if (deterministicIntent.amount) {
    if (!llmExtract.amount_text) {
      reasons.push('MISSING_LLM_AMOUNT');
    } else {
      // Must be a substring of the original instruction (case-insensitive)
      if (!rawInstructionLower.includes(llmExtract.amount_text.toLowerCase())) {
        reasons.push('AMOUNT_NOT_IN_INSTRUCTION');
      }

      // Must parse to the same paise as deterministic amount
      const parsedAmount = parseAmountText(llmExtract.amount_text);
      if (!parsedAmount) {
        reasons.push('AMOUNT_PARSE_FAILED');
      } else if (parsedAmount.paise !== deterministicIntent.amount.paise) {
        reasons.push(`AMOUNT_VALUE_MISMATCH: expected ${deterministicIntent.amount.paise}, got ${parsedAmount.paise}`);
      }
    }
  } else if (llmExtract.amount_text) {
    reasons.push('UNEXPECTED_LLM_AMOUNT');
  }

  // Rule 4: Recipient grounding
  if (deterministicIntent.recipient) {
    if (!llmExtract.recipient_text) {
      reasons.push('MISSING_LLM_RECIPIENT');
    } else {
      // Must be a substring of original instruction (case-insensitive)
      if (!rawInstructionLower.includes(llmExtract.recipient_text.toLowerCase())) {
        reasons.push('RECIPIENT_NOT_IN_INSTRUCTION');
      }

      // Must resolve to the same contact
      const resolved = resolveContact(contacts, llmExtract.recipient_text);
      if (!resolved || resolved.id !== deterministicIntent.recipient.id) {
        reasons.push(`RECIPIENT_MISMATCH: expected ${deterministicIntent.recipient.id}, got ${resolved?.id || 'none'}`);
      }
    }
  } else if (llmExtract.recipient_text) {
    reasons.push('UNEXPECTED_LLM_RECIPIENT');
  }

  return {
    grounded: reasons.length === 0,
    reasons
  };
}
