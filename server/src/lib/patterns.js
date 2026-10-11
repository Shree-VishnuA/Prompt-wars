export const PATTERN_GROUPS = {
  OVERRIDE: {
    id: 'OVERRIDE',
    severity: 'critical',
    category: 'DIRECT_PROMPT_INJECTION',
    patterns: [
      /\b(?:ignore|disregard|forget|override|bypass)\s+(?:(?:all|any|the|your|my|these|those)\s+)*(?:(?:previous|prior|above|existing|all)\s+)*(?:instructions|rules|policy|policies|system\s*prompt|guardrails|restrictions|guidelines)\b/i,
      /\b(?:new\s+instructions|from\s+now\s+on\s+you|you\s+are\s+now|system\s+override)\b/i,
      /\b(?:pichle|purane|saare|sabhi)\s+(?:instructions|nirdesh|aadesh|niyam)\s+(?:ko\s+)?(?:ignore|bhool|hatao|bypas)/i,
      /\b(?:niyam|instructions|nirdesh)\s+(?:bhool\s+jao|ignore\s+karo)\b/i,
      /\bpurane\s+nirdesh\b/i,
      /\bignora\s+(?:las\s+)?instrucciones\s+(?:anteriores|previas)\b/i,
      /\bignorez\s+(?:toutes\s+)?(?:les\s+)?instructions\b/i,
      /\bignoriere\s+alle\s+vorherigen\s+anweisungen\b/i
    ]
  },
  ROLE_FAKE: {
    id: 'ROLE_FAKE',
    severity: 'critical',
    category: 'DIRECT_PROMPT_INJECTION',
    patterns: [
      /(?:^|\n|\s)(?:system\s*:|assistant\s*:|\[system\]|<\|im_start\|>|###\s*system)/i,
      /\b(?:admin\s+override|developer\s+message)\b/i,
      /\bas\s+the\s+(?:administrator|developer|bank\s+manager)\s+i\s+authorize\b/i
    ]
  },
  ROLEPLAY: {
    id: 'ROLEPLAY',
    severity: 'critical',
    category: 'ROLEPLAY_JAILBREAK',
    patterns: [
      /\b(?:dan|developer\s+mode|jailbreak)\b/i,
      /\b(?:pretend\s+you\s+are|act\s+as|roleplay(?:\s+as)?)\b/i,
      /\b(?:hypothetically|in\s+a\s+fictional\s+story)\b/i,
      /\b(?:no\s+restrictions|unfiltered)\b/i
    ]
  },
  EXFIL: {
    id: 'EXFIL',
    severity: 'critical',
    category: 'DATA_EXFILTRATION',
    patterns: [
      /\b(?:system\s*prompt|your\s+instructions|your\s+rules)\b/i,
      /\b(?:reveal|print|show|repeat|leak|display|dump)\s+(?:(?:me\s+)?(?:the|your|all)\s+)*(?:system\s*prompt|prompt|rules|instructions|config|api\s*key|secret|token|password|canary)\b/i,
      /\b(?:all\s+accounts|other\s+customers|database\s+dump|customer\s+database)\b/i,
      /\bACC-(?!1001\b)\d{4}\b/i
    ]
  },
  MEMO_AI_ADDRESS: {
    id: 'MEMO_AI_ADDRESS',
    severity: 'high',
    category: 'MEMO_INJECTION',
    patterns: [
      /\b(?:approve|authorize|execute|assistant|ai|bot|firewall|ignore|instruction|policy|override|bypass|transfer\s+all|send\s+all|change\s+the\s+amount|disable|whitelist)\b/i
    ]
  },
  DELIMITER_SPOOF: {
    id: 'DELIMITER_SPOOF',
    severity: 'high',
    category: 'DIRECT_PROMPT_INJECTION',
    patterns: [
      /(?:<<DATA|<<END|```|<\/|---END|\[INST\])/i
    ]
  },
  MARKUP_OR_SQL: {
    id: 'MARKUP_OR_SQL',
    severity: 'high',
    category: 'MALFORMED_INPUT',
    patterns: [
      /(?:<script|onerror\s*=|javascript:|<iframe|'[\s;]*or\s+1\s*=\s*1|;\s*drop\s+table|union\s+select|--|\$\{|\{\{|\$\()/i
    ]
  }
};
