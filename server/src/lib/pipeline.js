import crypto from 'node:crypto';
import { AnalyzeRequestSchema, makeBlockedVerdict, riskLevelFromScore, VerdictSchema } from './schemas.js';
import { normalizeText } from './normalize.js';
import { runDetectors } from './detectors.js';
import { parseIntent, checkMemoConflict, verifyGrounding } from './intent.js';
import { analyzeWithLlm } from './llm.js';
import { decide } from './policy.js';
import { getBank, getBalance, getHistory, PER_TRANSFER_LIMIT_PAISE } from './mockBank.js';
import { mintIntentToken } from './token.js';

const POLICY_VERSION = '1.0.0';

function timed(fn) {
  const start = Date.now();
  const result = fn();
  const duration_ms = Date.now() - start;
  return { result, duration_ms };
}

async function timedAsync(fn) {
  const start = Date.now();
  const result = await fn();
  const duration_ms = Date.now() - start;
  return { result, duration_ms };
}

export async function runPipeline({
  instruction,
  memo = '',
  userId = 'usr_demo',
  options = { useLlm: true }
} = {}) {
  const pipelineStart = Date.now();
  const request_id = crypto.randomUUID();
  const useLlm = options?.useLlm !== false;

  const trace = [];

  try {
    // ---- Step 1: Validate via AnalyzeRequestSchema ----
    const validationStart = Date.now();
    const parseResult = AnalyzeRequestSchema.safeParse({ instruction, memo });
    const validationDuration = Date.now() - validationStart;

    if (!parseResult.success) {
      const verdict = makeBlockedVerdict({
        request_id,
        category: 'MALFORMED_INPUT',
        score: 60,
        rationale: 'Request failed payload schema validation.',
        trace: [
          {
            layer: 'validation',
            status: 'block',
            summary: 'Input payload validation failed',
            findings: parseResult.error.issues.map((i) => i.message),
            duration_ms: validationDuration
          }
        ],
        degraded: false
      });
      verdict.latency_ms = Date.now() - pipelineStart;
      return verdict;
    }

    const validated = parseResult.data;
    trace.push({
      layer: 'validation',
      status: 'pass',
      summary: 'Payload schema validated successfully',
      findings: [],
      duration_ms: validationDuration
    });

    // ---- Step 2: Normalize instruction and memo ----
    const normStart = Date.now();
    const instructionNorm = normalizeText(validated.instruction);
    const memoNorm = normalizeText(validated.memo || '');
    const normDuration = Date.now() - normStart;

    const normFlags = [...instructionNorm.flags, ...memoNorm.flags];
    trace.push({
      layer: 'normalization',
      status: normFlags.length > 0 ? 'flag' : 'pass',
      summary: normFlags.length > 0
        ? `Normalization flags detected: ${normFlags.join(', ')}`
        : 'Input normalized without anomalies',
      findings: normFlags,
      duration_ms: normDuration
    });

    // ---- Step 3: Run Detectors ----
    const detStart = Date.now();
    const det = runDetectors({ instruction: instructionNorm, memo: memoNorm });
    const detDuration = Date.now() - detStart;

    // Detector trace entry is added here for completeness; policy will also add its own
    // We do not add a separate 'deterministic' trace entry here; policy.decide builds it.
    // But policy.decide's trace needs duration_ms. We'll inject duration_ms later.

    // ---- Step 4: Parse intent and check memo conflict ----
    const intentStart = Date.now();
    const bank = getBank(userId);
    const contacts = bank.contacts || [];
    const intent = parseIntent(instructionNorm, contacts);
    const memoConflict = checkMemoConflict(memoNorm, intent);
    const intentDuration = Date.now() - intentStart;

    // ---- Step 5: LLM Analysis ----
    let llmResult = { available: false, extract: null, judge: null, errors: [], canaryLeaked: false, durationMs: 0 };
    const llmExtractorDuration_ms = 0;
    const llmJudgeDuration_ms = 0;

    if (useLlm) {
      const llmStart = Date.now();
      llmResult = await analyzeWithLlm({
        instruction: validated.instruction,
        instructionNorm,
        memo: validated.memo || '',
        memoNorm
      });
      const llmDuration = Date.now() - llmStart;

      // LLM trace entries (if skipped by policy, they will be overwritten below)
      if (!llmResult.available && llmResult.errors.includes('LLM_DISABLED')) {
        // Will be handled by policy as skipped
      }
    }

    // ---- Step 6: Grounding verification (when LLM extract exists) ----
    let grounding = { grounded: true, reasons: [] };
    if (useLlm && llmResult.available && llmResult.extract) {
      grounding = verifyGrounding(llmResult.extract, instructionNorm, intent, contacts);
    }

    // ---- Step 7: Policy decide ----
    const policyCtx = {
      validationOk: true,
      det,
      intent,
      memoConflict,
      llm: llmResult,
      grounding,
      bank: {
        balance_paise: bank.balance_paise,
        limit_paise: PER_TRANSFER_LIMIT_PAISE
      },
      useLlm
    };

    const policyStart = Date.now();
    const policyResult = decide(policyCtx);
    const policyDuration = Date.now() - policyStart;

    // Merge policy trace into our pipeline trace, injecting duration_ms
    const policyTrace = policyResult.trace || [];

    // Assign duration_ms to each policy-generated trace entry
    for (const entry of policyTrace) {
      if (!('duration_ms' in entry)) {
        entry.duration_ms = 0;
      }
      // For deterministic layer, inject detDuration
      if (entry.layer === 'deterministic') {
        entry.duration_ms = detDuration;
      }
      // For llm_extractor layer, inject LLM duration
      if (entry.layer === 'llm_extractor') {
        entry.duration_ms = llmResult.durationMs || 0;
      }
      if (entry.layer === 'llm_judge') {
        entry.duration_ms = llmResult.durationMs || 0;
      }
      // For grounding layer, use intentDuration
      if (entry.layer === 'grounding') {
        entry.duration_ms = intentDuration;
      }
      // For policy layer
      if (entry.layer === 'policy') {
        entry.duration_ms = policyDuration;
      }
    }

    // Deduplicate traces in canonical chronological order
    const layerOrder = [
      'validation',
      'normalization',
      'deterministic',
      'llm_extractor',
      'llm_judge',
      'grounding',
      'policy'
    ];

    const traceMap = new Map();
    for (const entry of trace) {
      traceMap.set(entry.layer, entry);
    }
    for (const entry of policyTrace) {
      if (traceMap.has(entry.layer)) {
        const existing = traceMap.get(entry.layer);
        traceMap.set(entry.layer, {
          ...entry,
          duration_ms: existing.duration_ms || entry.duration_ms || 0,
          findings: Array.from(new Set([...(existing.findings || []), ...(entry.findings || [])]))
        });
      } else {
        traceMap.set(entry.layer, entry);
      }
    }

    const finalTrace = layerOrder
      .filter((layer) => traceMap.has(layer))
      .map((layer) => traceMap.get(layer));

    const latency_ms = Date.now() - pipelineStart;

    // ---- Step 8: Build final verdict ----
    let simulated_result = null;
    let intent_token = null;
    let requires_confirmation = policyResult.requires_confirmation;

    if (policyResult.decision === 'APPROVED') {
      const action = policyResult.extracted_intent?.action;

      if (action === 'BALANCE_INQUIRY') {
        simulated_result = { balance_paise: bank.balance_paise };
      } else if (action === 'TRANSACTION_HISTORY') {
        simulated_result = { transactions: getHistory(userId, 10) };
      } else if (action === 'TRANSFER') {
        // Mint intent token for transfers
        const ei = policyResult.extracted_intent;
        const memoHashInput = validated.memo || '';
        const memo_hash = crypto
          .createHash('sha256')
          .update(memoHashInput)
          .digest('hex')
          .slice(0, 16);

        intent_token = mintIntentToken({
          userId,
          action: 'TRANSFER',
          recipient_id: ei.recipient_id,
          amount_paise: ei.amount_paise,
          memo_hash
        });
        requires_confirmation = true;
        simulated_result = null;
      }
    }

    const verdict = {
      request_id,
      decision: policyResult.decision,
      requires_confirmation: Boolean(requires_confirmation),
      risk_level: riskLevelFromScore(policyResult.risk_score),
      risk_score: policyResult.risk_score,
      threat_category: policyResult.threat_category,
      rationale: (policyResult.rationale || '').slice(0, 300),
      extracted_intent: policyResult.extracted_intent || null,
      trace: finalTrace,
      policy_version: POLICY_VERSION,
      degraded: Boolean(policyResult.degraded),
      simulated_result,
      intent_token,
      latency_ms
    };

    return verdict;
  } catch (err) {
    // Fail-closed: any unexpected exception -> BLOCKED SERVICE_DEGRADED
    const verdict = makeBlockedVerdict({
      request_id,
      category: 'SERVICE_DEGRADED',
      score: 80,
      rationale: 'An internal error occurred. Request blocked for safety.',
      trace: [
        ...trace,
        {
          layer: 'policy',
          status: 'error',
          summary: 'Pipeline exception caught',
          findings: [],
          duration_ms: 0
        }
      ],
      degraded: true
    });
    verdict.latency_ms = Date.now() - pipelineStart;
    return verdict;
  }
}
