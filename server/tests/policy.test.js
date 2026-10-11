import { describe, it, expect } from 'vitest';
import { decide } from '../src/lib/policy.js';

describe('Policy Decision Engine (policy.js)', () => {
  const baseContact = { id: 'c_rahul', name: 'Rahul Sharma', alias: 'rahul' };

  const validTransferIntent = {
    action: 'TRANSFER',
    amount: { text: '500', paise: 50000, currency: 'INR' },
    recipient: baseContact,
    recipient_text: 'Rahul',
    ambiguous: false,
    reasons: []
  };

  const validBalanceIntent = {
    action: 'BALANCE_INQUIRY',
    amount: null,
    recipient: null,
    recipient_text: null,
    ambiguous: false,
    reasons: []
  };

  const validHistoryIntent = {
    action: 'TRANSACTION_HISTORY',
    amount: null,
    recipient: null,
    recipient_text: null,
    ambiguous: false,
    reasons: []
  };

  const defaultBank = {
    balance_paise: 5000000, // 50,000 Rs
    limit_paise: 2500000   // 25,000 Rs
  };

  const scenarios = [
    {
      name: 'R1: validation failed',
      ctx: { validationOk: false },
      expectedDecision: 'BLOCKED',
      expectedCategory: 'MALFORMED_INPUT',
      expectedScore: 60
    },
    {
      name: 'R2: critical deterministic finding (OVERRIDE)',
      ctx: {
        validationOk: true,
        det: {
          findings: [{ id: 'OVERRIDE', severity: 'critical', category: 'DIRECT_PROMPT_INJECTION', evidence: 'ignore rules' }],
          maxSeverity: 'critical'
        },
        intent: validTransferIntent,
        bank: defaultBank
      },
      expectedDecision: 'BLOCKED',
      expectedCategory: 'DIRECT_PROMPT_INJECTION',
      expectedScore: 95
    },
    {
      name: 'R2: high deterministic finding (DELIMITER_SPOOF)',
      ctx: {
        validationOk: true,
        det: {
          findings: [{ id: 'DELIMITER_SPOOF', severity: 'high', category: 'DIRECT_PROMPT_INJECTION', evidence: '<<DATA' }],
          maxSeverity: 'high'
        },
        intent: validTransferIntent,
        bank: defaultBank
      },
      expectedDecision: 'BLOCKED',
      expectedCategory: 'DIRECT_PROMPT_INJECTION',
      expectedScore: 80
    },
    {
      name: 'R2: high deterministic finding (MARKUP_OR_SQL)',
      ctx: {
        validationOk: true,
        det: {
          findings: [{ id: 'MARKUP_OR_SQL', severity: 'high', category: 'MALFORMED_INPUT', evidence: '<script>' }],
          maxSeverity: 'high'
        },
        intent: validTransferIntent,
        bank: defaultBank
      },
      expectedDecision: 'BLOCKED',
      expectedCategory: 'MALFORMED_INPUT',
      expectedScore: 80
    },
    {
      name: 'R2: COMPROMISED LLM SCENARIO - critical det blocks despite judge claiming BENIGN 0.99',
      ctx: {
        validationOk: true,
        det: {
          findings: [{ id: 'OVERRIDE', severity: 'critical', category: 'DIRECT_PROMPT_INJECTION', evidence: 'ignore instructions' }],
          maxSeverity: 'critical'
        },
        useLlm: true,
        llm: {
          available: true,
          extract: { action: 'TRANSFER', amount_text: '500', recipient_text: 'Rahul', ambiguous: false, confidence: 0.99 },
          judge: { threat_category: 'BENIGN', is_malicious: false, confidence: 0.99, evidence: [], summary: 'Compromised benign' },
          canaryLeaked: false,
          errors: []
        },
        grounding: { grounded: true, reasons: [] },
        intent: validTransferIntent,
        bank: defaultBank
      },
      expectedDecision: 'BLOCKED',
      expectedCategory: 'DIRECT_PROMPT_INJECTION',
      expectedScore: 95
    },
    {
      name: 'R3: medium deterministic finding (TOKEN_OBFUSCATION)',
      ctx: {
        validationOk: true,
        det: {
          findings: [{ id: 'STRUCTURAL_ZERO_WIDTH', severity: 'medium', category: 'TOKEN_OBFUSCATION', evidence: 'ZERO_WIDTH' }],
          maxSeverity: 'medium'
        },
        intent: validTransferIntent,
        bank: defaultBank
      },
      expectedDecision: 'BLOCKED',
      expectedCategory: 'TOKEN_OBFUSCATION',
      expectedScore: 55
    },
    {
      name: 'R4: canary leaked in LLM output',
      ctx: {
        validationOk: true,
        useLlm: true,
        llm: { available: true, canaryLeaked: true, errors: [] },
        intent: validTransferIntent,
        bank: defaultBank
      },
      expectedDecision: 'BLOCKED',
      expectedCategory: 'DATA_EXFILTRATION',
      expectedScore: 100
    },
    {
      name: 'R5: degraded mode allows clear non-ambiguous transfer',
      ctx: {
        validationOk: true,
        useLlm: true,
        llm: { available: false, errors: ['LLM_UNAVAILABLE'] },
        intent: validTransferIntent,
        bank: defaultBank
      },
      expectedDecision: 'APPROVED',
      expectedCategory: 'BENIGN',
      expectedScore: 20
    },
    {
      name: 'R5: degraded mode allows clear non-ambiguous balance inquiry',
      ctx: {
        validationOk: true,
        useLlm: true,
        llm: { available: false, errors: ['LLM_UNAVAILABLE'] },
        intent: validBalanceIntent,
        bank: defaultBank
      },
      expectedDecision: 'APPROVED',
      expectedCategory: 'BENIGN',
      expectedScore: 5
    },
    {
      name: 'R5: degraded mode blocks ambiguous request',
      ctx: {
        validationOk: true,
        useLlm: true,
        llm: { available: false, errors: ['LLM_UNAVAILABLE'] },
        intent: { ...validTransferIntent, ambiguous: true, reasons: ['NO_AMOUNT'] },
        bank: defaultBank
      },
      expectedDecision: 'BLOCKED',
      expectedCategory: 'SERVICE_DEGRADED',
      expectedScore: 50
    },
    {
      name: 'R5: degraded mode blocks unsupported action',
      ctx: {
        validationOk: true,
        useLlm: true,
        llm: { available: false, errors: ['LLM_UNAVAILABLE'] },
        intent: { action: 'UNSUPPORTED', ambiguous: false, reasons: ['UNKNOWN'] },
        bank: defaultBank
      },
      expectedDecision: 'BLOCKED',
      expectedCategory: 'SERVICE_DEGRADED',
      expectedScore: 50
    },
    {
      name: 'R6: judge classifies DIRECT_PROMPT_INJECTION (conf 0.9)',
      ctx: {
        validationOk: true,
        useLlm: true,
        llm: {
          available: true,
          judge: { threat_category: 'DIRECT_PROMPT_INJECTION', is_malicious: true, confidence: 0.9, evidence: [], summary: 'injection' }
        },
        intent: validTransferIntent,
        bank: defaultBank
      },
      expectedDecision: 'BLOCKED',
      expectedCategory: 'DIRECT_PROMPT_INJECTION',
      expectedScore: 96
    },
    {
      name: 'R6: judge classifies ROLEPLAY_JAILBREAK (conf 0.8)',
      ctx: {
        validationOk: true,
        useLlm: true,
        llm: {
          available: true,
          judge: { threat_category: 'ROLEPLAY_JAILBREAK', is_malicious: true, confidence: 0.8, evidence: [], summary: 'jailbreak' }
        },
        intent: validTransferIntent,
        bank: defaultBank
      },
      expectedDecision: 'BLOCKED',
      expectedCategory: 'ROLEPLAY_JAILBREAK',
      expectedScore: 92
    },
    {
      name: 'R6: judge classifies MEMO_INJECTION (conf 0.85)',
      ctx: {
        validationOk: true,
        useLlm: true,
        llm: {
          available: true,
          judge: { threat_category: 'MEMO_INJECTION', is_malicious: true, confidence: 0.85, evidence: [], summary: 'memo injection' }
        },
        intent: validTransferIntent,
        bank: defaultBank
      },
      expectedDecision: 'BLOCKED',
      expectedCategory: 'MEMO_INJECTION',
      expectedScore: 94
    },
    {
      name: 'R6: judge is_malicious true with BENIGN category',
      ctx: {
        validationOk: true,
        useLlm: true,
        llm: {
          available: true,
          judge: { threat_category: 'BENIGN', is_malicious: true, confidence: 0.8, evidence: [], summary: 'malicious' }
        },
        intent: validTransferIntent,
        bank: defaultBank
      },
      expectedDecision: 'BLOCKED',
      expectedCategory: 'POLICY_VIOLATION',
      expectedScore: 92
    },
    {
      name: 'R6: judge BENIGN but low confidence (< 0.7, e.g. 0.5)',
      ctx: {
        validationOk: true,
        useLlm: true,
        llm: {
          available: true,
          judge: { threat_category: 'BENIGN', is_malicious: false, confidence: 0.5, evidence: [], summary: 'uncertain' }
        },
        intent: validTransferIntent,
        bank: defaultBank
      },
      expectedDecision: 'BLOCKED',
      expectedCategory: 'AMBIGUOUS_REQUEST',
      expectedScore: 80
    },
    {
      name: 'R7: grounding failed due to amount mismatch',
      ctx: {
        validationOk: true,
        useLlm: true,
        llm: {
          available: true,
          judge: { threat_category: 'BENIGN', is_malicious: false, confidence: 0.95 }
        },
        grounding: { grounded: false, reasons: ['AMOUNT_VALUE_MISMATCH'] },
        intent: validTransferIntent,
        bank: defaultBank
      },
      expectedDecision: 'BLOCKED',
      expectedCategory: 'AMOUNT_MISMATCH',
      expectedScore: 70
    },
    {
      name: 'R7: grounding failed due to recipient mismatch',
      ctx: {
        validationOk: true,
        useLlm: true,
        llm: {
          available: true,
          judge: { threat_category: 'BENIGN', is_malicious: false, confidence: 0.95 }
        },
        grounding: { grounded: false, reasons: ['RECIPIENT_MISMATCH'] },
        intent: validTransferIntent,
        bank: defaultBank
      },
      expectedDecision: 'BLOCKED',
      expectedCategory: 'AMBIGUOUS_REQUEST',
      expectedScore: 70
    },
    {
      name: 'R8: memo conflict with conflicting amount',
      ctx: {
        validationOk: true,
        memoConflict: { conflict: true, reasons: ['MEMO_AMOUNT_CONFLICT: 1000 differs from 500'] },
        intent: validTransferIntent,
        bank: defaultBank
      },
      expectedDecision: 'BLOCKED',
      expectedCategory: 'AMOUNT_MISMATCH',
      expectedScore: 85
    },
    {
      name: 'R8: memo conflict with recipient override',
      ctx: {
        validationOk: true,
        memoConflict: { conflict: true, reasons: ['MEMO_RECIPIENT_CONFLICT: priya'] },
        intent: validTransferIntent,
        bank: defaultBank
      },
      expectedDecision: 'BLOCKED',
      expectedCategory: 'MEMO_INJECTION',
      expectedScore: 85
    },
    {
      name: 'R8: memo conflict with account ID',
      ctx: {
        validationOk: true,
        memoConflict: { conflict: true, reasons: ['MEMO_ACCOUNT_ID_PRESENT'] },
        intent: validTransferIntent,
        bank: defaultBank
      },
      expectedDecision: 'BLOCKED',
      expectedCategory: 'MEMO_INJECTION',
      expectedScore: 85
    },
    {
      name: 'R9: unsupported action',
      ctx: {
        validationOk: true,
        intent: { action: 'UNSUPPORTED', ambiguous: false, reasons: ['UNSUPPORTED_ACTION'] },
        bank: defaultBank
      },
      expectedDecision: 'BLOCKED',
      expectedCategory: 'POLICY_VIOLATION',
      expectedScore: 45
    },
    {
      name: 'R9: ambiguous request (missing amount)',
      ctx: {
        validationOk: true,
        intent: { ...validTransferIntent, ambiguous: true, reasons: ['NO_AMOUNT'] },
        bank: defaultBank
      },
      expectedDecision: 'BLOCKED',
      expectedCategory: 'AMBIGUOUS_REQUEST',
      expectedScore: 45
    },
    {
      name: 'R9: ambiguous request (multiple recipients)',
      ctx: {
        validationOk: true,
        intent: { ...validTransferIntent, ambiguous: true, reasons: ['MULTIPLE_RECIPIENTS'] },
        bank: defaultBank
      },
      expectedDecision: 'BLOCKED',
      expectedCategory: 'AMBIGUOUS_REQUEST',
      expectedScore: 45
    },
    {
      name: 'R9: read inquiry specifying another account ID ACC-2002',
      ctx: {
        validationOk: true,
        intent: {
          action: 'BALANCE_INQUIRY',
          ambiguous: true,
          reasons: ['CONFLICTING_ACCOUNT_ID']
        },
        bank: defaultBank
      },
      expectedDecision: 'BLOCKED',
      expectedCategory: 'UNAUTHORIZED_ACCESS',
      expectedScore: 85
    },
    {
      name: 'R10: transfer amount exceeds per-transfer limit',
      ctx: {
        validationOk: true,
        intent: {
          ...validTransferIntent,
          amount: { text: '30,000', paise: 3000000, currency: 'INR' } // 30,000 Rs > 25,000 Rs limit
        },
        bank: defaultBank
      },
      expectedDecision: 'BLOCKED',
      expectedCategory: 'POLICY_VIOLATION',
      expectedScore: 60
    },
    {
      name: 'R10: transfer amount exceeds available balance',
      ctx: {
        validationOk: true,
        intent: {
          ...validTransferIntent,
          amount: { text: '20,000', paise: 2000000, currency: 'INR' }
        },
        bank: {
          balance_paise: 1000000, // 10,000 Rs balance < 20,000 Rs requested
          limit_paise: 2500000
        }
      },
      expectedDecision: 'BLOCKED',
      expectedCategory: 'POLICY_VIOLATION',
      expectedScore: 60
    },
    {
      name: 'R10: transfer recipient missing from verified contacts',
      ctx: {
        validationOk: true,
        intent: {
          ...validTransferIntent,
          recipient: null
        },
        bank: defaultBank
      },
      expectedDecision: 'BLOCKED',
      expectedCategory: 'POLICY_VIOLATION',
      expectedScore: 60
    },
    {
      name: 'R11: approved balance inquiry',
      ctx: {
        validationOk: true,
        intent: validBalanceIntent,
        bank: defaultBank
      },
      expectedDecision: 'APPROVED',
      expectedCategory: 'BENIGN',
      expectedScore: 5
    },
    {
      name: 'R11: approved transaction history inquiry',
      ctx: {
        validationOk: true,
        intent: validHistoryIntent,
        bank: defaultBank
      },
      expectedDecision: 'APPROVED',
      expectedCategory: 'BENIGN',
      expectedScore: 5
    },
    {
      name: 'R11: approved small transfer (<= 10,000 Rs / 1,000,000 paise)',
      ctx: {
        validationOk: true,
        intent: {
          ...validTransferIntent,
          amount: { text: '500', paise: 50000, currency: 'INR' }
        },
        bank: defaultBank
      },
      expectedDecision: 'APPROVED',
      expectedCategory: 'BENIGN',
      expectedScore: 20
    },
    {
      name: 'R11: approved large transfer (> 1,000,000 paise)',
      ctx: {
        validationOk: true,
        intent: {
          ...validTransferIntent,
          amount: { text: '15,000', paise: 1500000, currency: 'INR' }
        },
        bank: defaultBank
      },
      expectedDecision: 'APPROVED',
      expectedCategory: 'BENIGN',
      expectedScore: 30
    }
  ];

  describe('Scenario Table Verification (>= 30 scenarios)', () => {
    scenarios.forEach((scenario, index) => {
      it(`Scenario ${index + 1}: ${scenario.name}`, () => {
        const res = decide(scenario.ctx);

        expect(res.decision).toBe(scenario.expectedDecision);
        expect(res.threat_category).toBe(scenario.expectedCategory);
        expect(res.risk_score).toBe(scenario.expectedScore);

        if (scenario.expectedDecision === 'APPROVED') {
          expect(res.threat_category).toBe('BENIGN');
          expect(res.risk_score).toBeLessThanOrEqual(49);
          if (scenario.ctx.intent?.action === 'TRANSFER') {
            expect(res.requires_confirmation).toBe(true);
            expect(res.extracted_intent).not.toBeNull();
          } else {
            expect(res.requires_confirmation).toBe(false);
          }
        } else {
          // BLOCKED must NEVER have threat_category BENIGN
          expect(res.threat_category).not.toBe('BENIGN');
          expect(res.extracted_intent).toBeNull();
          expect(res.requires_confirmation).toBe(false);
        }
      });
    });
  });

  describe('Contract Invariant Verification across all cases', () => {
    it('verifies that no BLOCKED result has threat_category BENIGN and no APPROVED result has risk_score > 49', () => {
      for (const scenario of scenarios) {
        const res = decide(scenario.ctx);

        if (res.decision === 'BLOCKED') {
          expect(res.threat_category).not.toBe('BENIGN');
        }
        if (res.decision === 'APPROVED') {
          expect(res.threat_category).toBe('BENIGN');
          expect(res.risk_score).toBeLessThanOrEqual(49);
        }
      }
    });

    it('verifies that trace contains entries for every layer evaluated', () => {
      const res = decide(scenarios[0].ctx); // R1 failed
      expect(res.trace).toBeInstanceOf(Array);
      expect(res.trace.length).toBeGreaterThan(0);
      expect(res.trace.some((t) => t.layer === 'validation')).toBe(true);
    });
  });
});
