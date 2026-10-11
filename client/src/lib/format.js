/**
 * Format an integer amount in paise into an Indian Rupee currency string.
 * Example: 12345678 -> "₹1,23,456.78"
 *
 * @param {number|string|null|undefined} paise Amount in paise (1 INR = 100 paise)
 * @returns {string} Formatted INR currency string
 */
export function formatPaise(paise) {
  if (paise === null || paise === undefined || isNaN(Number(paise))) {
    return '₹0.00';
  }

  const numPaise = Number(paise);
  const rupees = numPaise / 100;

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(rupees);
}

/**
 * Human-readable mappings for threat categories.
 */
export const THREAT_CATEGORY_LABELS = {
  BENIGN: 'Benign Request',
  DIRECT_PROMPT_INJECTION: 'Direct Prompt Injection',
  ROLEPLAY_JAILBREAK: 'Roleplay Jailbreak',
  MEMO_INJECTION: 'Memo Injection',
  TOKEN_OBFUSCATION: 'Token Obfuscation',
  DATA_EXFILTRATION: 'Data Exfiltration',
  AMOUNT_MISMATCH: 'Amount Mismatch',
  UNAUTHORIZED_ACCESS: 'Unauthorized Access',
  POLICY_VIOLATION: 'Policy Violation',
  AMBIGUOUS_REQUEST: 'Ambiguous Request',
  MALFORMED_INPUT: 'Malformed Input',
  SERVICE_DEGRADED: 'Service Degraded'
};

export function getThreatCategoryLabel(category) {
  if (!category) return 'Unknown Category';
  return THREAT_CATEGORY_LABELS[category] || category.replace(/_/g, ' ');
}
