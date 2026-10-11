import crypto from 'node:crypto';

export const PER_TRANSFER_LIMIT_PAISE = 2500000; // Rs 25,000

export class BankError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'BankError';
    this.code = code;
  }
}

export const SEED_CONTACTS = [
  { id: 'c_rahul', name: 'Rahul Sharma', alias: 'rahul' },
  { id: 'c_priya', name: 'Priya Nair', alias: 'priya' },
  { id: 'c_amit', name: 'Amit Verma', alias: 'amit' },
  { id: 'c_mom', name: 'Mom', alias: 'mom' }
];

function createSeedHistory() {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  return [
    {
      id: 'tx_001',
      date: new Date(now - 7 * day).toISOString(),
      type: 'CREDIT',
      counterparty: 'Salary / Employer Corp',
      amount_paise: 15000000,
      memo: 'Monthly salary'
    },
    {
      id: 'tx_002',
      date: new Date(now - 6 * day).toISOString(),
      type: 'DEBIT',
      counterparty: 'Landlord Properties',
      amount_paise: 4500000,
      memo: 'House rent'
    },
    {
      id: 'tx_003',
      date: new Date(now - 5 * day).toISOString(),
      type: 'DEBIT',
      counterparty: 'Rahul Sharma',
      amount_paise: 120000,
      memo: 'Dinner split'
    },
    {
      id: 'tx_004',
      date: new Date(now - 4 * day).toISOString(),
      type: 'CREDIT',
      counterparty: 'Priya Nair',
      amount_paise: 50000,
      memo: 'Coffee payback'
    },
    {
      id: 'tx_005',
      date: new Date(now - 3 * day).toISOString(),
      type: 'DEBIT',
      counterparty: 'Supermart Groceries',
      amount_paise: 84000,
      memo: 'Weekly grocery shopping'
    },
    {
      id: 'tx_006',
      date: new Date(now - 2 * day).toISOString(),
      type: 'DEBIT',
      counterparty: 'Electric Utility Board',
      amount_paise: 165000,
      memo: 'Electricity bill'
    },
    {
      id: 'tx_007',
      date: new Date(now - 1 * day).toISOString(),
      type: 'DEBIT',
      counterparty: 'Amit Verma',
      amount_paise: 250000,
      memo: 'Concert tickets'
    },
    {
      id: 'tx_008',
      date: new Date(now - 12 * 60 * 60 * 1000).toISOString(),
      type: 'DEBIT',
      counterparty: 'Mom',
      amount_paise: 500000,
      memo: 'Monthly allowance'
    }
  ];
}

const banks = new Map();

function seedBank(userId) {
  return {
    user: userId,
    account_id: 'ACC-1001',
    balance_paise: 5000000, // Rs 50,000
    contacts: JSON.parse(JSON.stringify(SEED_CONTACTS)),
    history: createSeedHistory()
  };
}

export function getBank(userId = 'usr_demo') {
  if (!banks.has(userId)) {
    banks.set(userId, seedBank(userId));
  }
  return banks.get(userId);
}

export function resetBank(userId) {
  if (userId) {
    banks.delete(userId);
  } else {
    banks.clear();
  }
}

export function getBalance(userId = 'usr_demo') {
  const bank = getBank(userId);
  return bank.balance_paise;
}

export function getHistory(userId = 'usr_demo', limit = 10) {
  const bank = getBank(userId);
  return bank.history.slice(0, limit);
}

export function findContact(userId = 'usr_demo', text = '') {
  if (!text || typeof text !== 'string') return null;
  const bank = getBank(userId);
  const normalized = text.trim().toLowerCase();
  if (!normalized) return null;

  // Match contacts by alias or name (case-insensitive substring or exact)
  const matches = bank.contacts.filter((c) => {
    const alias = (c.alias || '').toLowerCase();
    const name = (c.name || '').toLowerCase();
    const id = (c.id || '').toLowerCase();

    return alias === normalized || name === normalized || id === normalized ||
      name.includes(normalized) || normalized.includes(alias);
  });

  // Returns contact or null; null if text matches more than one contact (ambiguous)
  if (matches.length === 1) {
    return matches[0];
  }

  // If multiple matched, check if there is an exact alias/name match
  const exactMatches = matches.filter((c) => {
    return (c.alias || '').toLowerCase() === normalized ||
           (c.name || '').toLowerCase() === normalized ||
           (c.id || '').toLowerCase() === normalized;
  });

  if (exactMatches.length === 1) {
    return exactMatches[0];
  }

  return null;
}

export function transfer(userId = 'usr_demo', { recipient_id, amount_paise, memo = '' } = {}) {
  const bank = getBank(userId);

  if (typeof amount_paise !== 'number' || !Number.isInteger(amount_paise) || amount_paise <= 0) {
    throw new BankError('Transfer amount must be a positive integer in paise.', 'INVALID_AMOUNT');
  }

  if (amount_paise > PER_TRANSFER_LIMIT_PAISE) {
    throw new BankError(
      `Amount exceeds maximum per-transfer limit of ${PER_TRANSFER_LIMIT_PAISE} paise.`,
      'LIMIT_EXCEEDED'
    );
  }

  if (amount_paise > bank.balance_paise) {
    throw new BankError('Insufficient funds for transfer.', 'INSUFFICIENT_FUNDS');
  }

  const recipient = bank.contacts.find((c) => c.id === recipient_id) || {
    id: recipient_id,
    name: recipient_id
  };

  const receiptId = `rcpt_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const dateIso = new Date().toISOString();

  bank.balance_paise -= amount_paise;

  const historyEntry = {
    id: `tx_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
    date: dateIso,
    type: 'DEBIT',
    counterparty: recipient.name || recipient_id,
    amount_paise,
    memo: memo || ''
  };

  bank.history.unshift(historyEntry);

  return {
    receipt_id: receiptId,
    account_id: bank.account_id,
    recipient_id: recipient.id,
    recipient_name: recipient.name,
    amount_paise,
    balance_paise: bank.balance_paise,
    memo: memo || '',
    date: dateIso
  };
}
