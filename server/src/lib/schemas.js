import crypto from 'node:crypto';
import { z } from 'zod';

export const DECISIONS = ['APPROVED', 'BLOCKED'];

export const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const THREAT_CATEGORIES = [
  'BENIGN',
  'DIRECT_PROMPT_INJECTION',
  'ROLEPLAY_JAILBREAK',
  'MEMO_INJECTION',
  'TOKEN_OBFUSCATION',
  'DATA_EXFILTRATION',
  'AMOUNT_MISMATCH',
  'UNAUTHORIZED_ACCESS',
  'POLICY_VIOLATION',
  'AMBIGUOUS_REQUEST',
  'MALFORMED_INPUT',
  'SERVICE_DEGRADED'
];

export const ACTIONS = [
  'BALANCE_INQUIRY',
  'TRANSACTION_HISTORY',
  'TRANSFER',
  'UNSUPPORTED'
];

export const TRACE_LAYERS = [
  'validation',
  'normalization',
  'deterministic',
  'llm_extractor',
  'llm_judge',
  'grounding',
  'policy'
];

export const TRACE_STATUSES = [
  'pass',
  'flag',
  'block',
  'skipped',
  'error'
];

export const AnalyzeRequestSchema = z
  .object({
    instruction: z.string().trim().min(1).max(500),
    memo: z.string().max(140).optional().default('')
  })
  .strict();

export const TraceEntrySchema = z.object({
  layer: z.enum(TRACE_LAYERS),
  status: z.enum(TRACE_STATUSES),
  summary: z.string(),
  findings: z.array(z.string()),
  duration_ms: z.number().nonnegative()
});

export const ExtractedIntentSchema = z.object({
  action: z.enum(ACTIONS),
  amount_paise: z.number().int().nullable(),
  currency: z.string().nullable(),
  recipient_id: z.string().nullable(),
  recipient_name: z.string().nullable()
});

export const ExtractorOutputSchema = z.object({
  action: z.enum(ACTIONS),
  amount_text: z.string().nullable(),
  recipient_text: z.string().nullable(),
  ambiguous: z.boolean(),
  confidence: z.number().min(0).max(1)
});

export const JudgeEvidenceSchema = z.object({
  field: z.enum(['instruction', 'memo']),
  quote: z.string().max(120),
  reason: z.string().max(200)
});

export const JudgeOutputSchema = z.object({
  threat_category: z.enum(THREAT_CATEGORIES),
  is_malicious: z.boolean(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(JudgeEvidenceSchema).max(5),
  summary: z.string().max(300)
});

export const VerdictSchema = z
  .object({
    request_id: z.string(),
    decision: z.enum(DECISIONS),
    requires_confirmation: z.boolean(),
    risk_level: z.enum(RISK_LEVELS),
    risk_score: z.number().int().min(0).max(100),
    threat_category: z.enum(THREAT_CATEGORIES),
    rationale: z.string().max(300),
    extracted_intent: ExtractedIntentSchema.nullable(),
    trace: z.array(TraceEntrySchema),
    policy_version: z.string(),
    degraded: z.boolean(),
    simulated_result: z.record(z.any()).nullable(),
    intent_token: z.string().nullable(),
    latency_ms: z.number().nonnegative()
  })
  .superRefine((val, ctx) => {
    if (val.decision === 'APPROVED') {
      if (val.threat_category !== 'BENIGN') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'APPROVED implies threat_category BENIGN',
          path: ['threat_category']
        });
      }
      if (val.risk_score > 49) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'APPROVED implies risk_score <= 49',
          path: ['risk_score']
        });
      }
    }

    if (val.decision === 'BLOCKED') {
      if (val.intent_token !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'BLOCKED implies intent_token null',
          path: ['intent_token']
        });
      }
      if (val.simulated_result !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'BLOCKED implies simulated_result null',
          path: ['simulated_result']
        });
      }
    }
  });

export function riskLevelFromScore(score) {
  if (score <= 24) return 'LOW';
  if (score <= 49) return 'MEDIUM';
  if (score <= 79) return 'HIGH';
  return 'CRITICAL';
}

export function makeBlockedVerdict({
  request_id = crypto.randomUUID(),
  category = 'MALFORMED_INPUT',
  score = 80,
  rationale = 'Request blocked due to policy or validation rules.',
  trace = [],
  degraded = false
} = {}) {
  return {
    request_id,
    decision: 'BLOCKED',
    requires_confirmation: false,
    risk_level: riskLevelFromScore(score),
    risk_score: score,
    threat_category: category,
    rationale: (rationale || '').slice(0, 300),
    extracted_intent: null,
    trace,
    policy_version: '1.0.0',
    degraded: Boolean(degraded),
    simulated_result: null,
    intent_token: null,
    latency_ms: 0
  };
}
