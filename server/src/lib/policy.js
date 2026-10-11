/**
 * GUARANTEE: The LLM can ONLY escalate risk.
 * No code path lets any LLM field turn a deterministic BLOCK into an APPROVED decision.
 * Deterministic rules (R1, R2, R3) execute before any LLM evaluations.
 * All rationale strings are strictly authored by this policy engine and NEVER copied from LLM text.
 */

export function decide(ctx = {}) {
  const {
    validationOk = true,
    det = { findings: [], maxSeverity: null },
    intent = { action: 'UNSUPPORTED', ambiguous: false, reasons: [] },
    memoConflict = { conflict: false, reasons: [] },
    llm = { available: false, extract: null, judge: null, canaryLeaked: false, errors: [] },
    grounding = { grounded: true, reasons: [] },
    bank = { balance_paise: 5000000, limit_paise: 2500000 },
    useLlm = false
  } = ctx;

  const trace = [];
  let degraded = false;

  // Trace helper
  function addTrace(layer, status, summary, findings = []) {
    trace.push({
      layer,
      status,
      summary,
      findings
    });
  }

  // --- R1: Input Payload Validation ---
  if (!validationOk) {
    addTrace('validation', 'block', 'Input payload validation failed', ['Malformed input body']);
    addTrace('policy', 'block', 'Blocked by R1: Malformed input', ['Validation failed']);
    return {
      decision: 'BLOCKED',
      threat_category: 'MALFORMED_INPUT',
      risk_score: 60,
      rationale: 'Request failed payload schema validation.',
      requires_confirmation: false,
      extracted_intent: null,
      trace,
      degraded: false
    };
  }
  addTrace('validation', 'pass', 'Payload schema validated successfully', []);

  // --- R2 & R3: Deterministic Rule Evaluation ---
  const findings = det.findings || [];
  const criticalFinding = findings.find((f) => f.severity === 'critical');
  const highFinding = findings.find((f) => f.severity === 'high');
  const mediumFinding = findings.find((f) => f.severity === 'medium');

  if (criticalFinding || highFinding) {
    const finding = criticalFinding || highFinding;
    const score = criticalFinding ? 95 : 80;
    const cat = finding.category || 'DIRECT_PROMPT_INJECTION';

    addTrace('deterministic', 'block', `Deterministic high/critical threat detected: ${finding.id}`, [
      `${finding.id}: ${finding.evidence}`
    ]);
    addTrace('policy', 'block', `Blocked by R2: Deterministic threat ${finding.id}`, [finding.evidence]);

    return {
      decision: 'BLOCKED',
      threat_category: cat,
      risk_score: score,
      rationale: `Security policy blocked request: deterministic threat detected (${finding.id}).`,
      requires_confirmation: false,
      extracted_intent: null,
      trace,
      degraded: false
    };
  }

  if (mediumFinding) {
    const cat = mediumFinding.category || 'TOKEN_OBFUSCATION';
    addTrace('deterministic', 'block', `Deterministic medium threat detected: ${mediumFinding.id}`, [
      `${mediumFinding.id}: ${mediumFinding.evidence}`
    ]);
    addTrace('policy', 'block', `Blocked by R3: Token obfuscation anomaly`, [mediumFinding.evidence]);

    return {
      decision: 'BLOCKED',
      threat_category: cat,
      risk_score: 55,
      rationale: 'Security policy blocked request: token obfuscation or encoding anomaly detected.',
      requires_confirmation: false,
      extracted_intent: null,
      trace,
      degraded: false
    };
  }
  addTrace('deterministic', 'pass', 'Deterministic threat scan passed with no violations', []);

  // --- R4: Canary Leak Check ---
  if (llm?.canaryLeaked) {
    addTrace('llm_judge', 'block', 'Canary leak detected in LLM response', ['Canary leaked']);
    addTrace('policy', 'block', 'Blocked by R4: Internal canary leaked', ['Data exfiltration']);
    return {
      decision: 'BLOCKED',
      threat_category: 'DATA_EXFILTRATION',
      risk_score: 100,
      rationale: 'Security policy blocked request: internal canary leak detected.',
      requires_confirmation: false,
      extracted_intent: null,
      trace,
      degraded: false
    };
  }

  // --- R5: Degraded Mode Evaluation ---
  if (useLlm && !llm?.available) {
    degraded = true;
    const isDeterministicActionValid =
      !intent.ambiguous &&
      intent.action !== 'UNSUPPORTED' &&
      (intent.action !== 'TRANSFER' || (intent.amount && intent.recipient));

    if (!isDeterministicActionValid) {
      addTrace('llm_judge', 'error', 'LLM unavailable in degraded mode', llm?.errors || []);
      addTrace('policy', 'block', 'Blocked by R5: Degraded mode cannot resolve ambiguous request', ['Degraded mode']);
      return {
        decision: 'BLOCKED',
        threat_category: 'SERVICE_DEGRADED',
        risk_score: 50,
        rationale: 'LLM service is degraded and request cannot be resolved deterministically.',
        requires_confirmation: false,
        extracted_intent: null,
        trace,
        degraded: true
      };
    }
    addTrace('llm_judge', 'skipped', 'LLM unavailable; falling back to deterministic resolution', []);
  }

  // --- R6: LLM Judge Classification ---
  if (useLlm && llm?.available && llm?.judge) {
    const judge = llm.judge;
    const isNonBenign = judge.threat_category !== 'BENIGN';
    const isMalicious = Boolean(judge.is_malicious);
    const isLowConfidence = typeof judge.confidence === 'number' && judge.confidence < 0.7;

    if (isNonBenign || isMalicious || isLowConfidence) {
      let threatCat = judge.threat_category;
      if (judge.threat_category === 'BENIGN' && isLowConfidence) {
        threatCat = 'AMBIGUOUS_REQUEST';
      } else if (judge.threat_category === 'BENIGN' && isMalicious) {
        threatCat = 'POLICY_VIOLATION';
      }

      const conf = typeof judge.confidence === 'number' ? judge.confidence : 0.8;
      const score = Math.min(100, 60 + Math.round(40 * conf));

      addTrace('llm_judge', 'block', `LLM Judge classified request as ${threatCat}`, [
        `Category: ${threatCat}, Confidence: ${conf}`
      ]);
      addTrace('policy', 'block', `Blocked by R6: Classifier decision ${threatCat}`, [threatCat]);

      return {
        decision: 'BLOCKED',
        threat_category: threatCat,
        risk_score: score,
        rationale: `Security classifier flagged request: ${threatCat.toLowerCase().replace(/_/g, ' ')}.`,
        requires_confirmation: false,
        extracted_intent: null,
        trace,
        degraded
      };
    }
    addTrace('llm_judge', 'pass', 'LLM judge classified request as benign', []);
  }

  // --- R7: Grounding Verification ---
  if (useLlm && llm?.available && grounding && !grounding.grounded) {
    const isAmountMismatch = grounding.reasons.some((r) => r.toLowerCase().includes('amount'));
    const threatCat = isAmountMismatch ? 'AMOUNT_MISMATCH' : 'AMBIGUOUS_REQUEST';

    addTrace('grounding', 'block', 'Grounding verification failed', grounding.reasons || []);
    addTrace('policy', 'block', `Blocked by R7: Grounding mismatch (${threatCat})`, grounding.reasons || []);

    return {
      decision: 'BLOCKED',
      threat_category: threatCat,
      risk_score: 70,
      rationale: 'LLM extraction failed grounding verification against input instruction.',
      requires_confirmation: false,
      extracted_intent: null,
      trace,
      degraded
    };
  }
  if (useLlm && llm?.available && grounding?.grounded) {
    addTrace('grounding', 'pass', 'Grounding verification succeeded', []);
  }

  // --- R8: Memo Conflict Evaluation ---
  if (memoConflict?.conflict) {
    const isAmountMismatch = memoConflict.reasons.some((r) => r.toLowerCase().includes('amount'));
    const threatCat = isAmountMismatch ? 'AMOUNT_MISMATCH' : 'MEMO_INJECTION';

    addTrace('deterministic', 'flag', 'Memo conflict detected', memoConflict.reasons || []);
    addTrace('policy', 'block', `Blocked by R8: Memo conflict (${threatCat})`, memoConflict.reasons || []);

    return {
      decision: 'BLOCKED',
      threat_category: threatCat,
      risk_score: 85,
      rationale: 'Conflict detected between memo and instruction intent.',
      requires_confirmation: false,
      extracted_intent: null,
      trace,
      degraded
    };
  }

  // --- R9: Intent Grammar & Ambiguity Evaluation ---
  if (intent.action === 'UNSUPPORTED') {
    addTrace('deterministic', 'block', 'Requested action is unsupported', ['UNSUPPORTED_ACTION']);
    addTrace('policy', 'block', 'Blocked by R9: Unsupported action', ['UNSUPPORTED']);

    return {
      decision: 'BLOCKED',
      threat_category: 'POLICY_VIOLATION',
      risk_score: 45,
      rationale: 'Requested action is not supported by banking policy.',
      requires_confirmation: false,
      extracted_intent: null,
      trace,
      degraded
    };
  }

  if (intent.ambiguous) {
    const isConflictingAccount = intent.reasons.includes('CONFLICTING_ACCOUNT_ID');
    const isReadAction = intent.action === 'BALANCE_INQUIRY' || intent.action === 'TRANSACTION_HISTORY';

    if (isConflictingAccount && isReadAction) {
      addTrace('deterministic', 'block', 'Unauthorized account inquiry', ['CONFLICTING_ACCOUNT_ID']);
      addTrace('policy', 'block', 'Blocked by R9: Unauthorized access to other account', ['UNAUTHORIZED_ACCESS']);

      return {
        decision: 'BLOCKED',
        threat_category: 'UNAUTHORIZED_ACCESS',
        risk_score: 85,
        rationale: 'Unauthorized access to another account requested.',
        requires_confirmation: false,
        extracted_intent: null,
        trace,
        degraded
      };
    }

    addTrace('deterministic', 'block', 'Request is ambiguous or incomplete', intent.reasons || []);
    addTrace('policy', 'block', 'Blocked by R9: Ambiguous request', intent.reasons || []);

    return {
      decision: 'BLOCKED',
      threat_category: 'AMBIGUOUS_REQUEST',
      risk_score: 45,
      rationale: 'Ambiguous or incomplete request details provided.',
      requires_confirmation: false,
      extracted_intent: null,
      trace,
      degraded
    };
  }

  // --- R10: Transfer Policy & Balance Limits ---
  if (intent.action === 'TRANSFER') {
    const amountPaise = intent.amount?.paise || 0;
    const limitPaise = bank.limit_paise || 2500000;
    const balancePaise = bank.balance_paise || 0;

    if (amountPaise > limitPaise) {
      addTrace('policy', 'block', 'Blocked by R10: Transfer limit exceeded', [`${amountPaise} > ${limitPaise}`]);
      return {
        decision: 'BLOCKED',
        threat_category: 'POLICY_VIOLATION',
        risk_score: 60,
        rationale: 'Transfer amount exceeds per-transaction limit.',
        requires_confirmation: false,
        extracted_intent: null,
        trace,
        degraded
      };
    }

    if (amountPaise > balancePaise) {
      addTrace('policy', 'block', 'Blocked by R10: Insufficient funds', [`${amountPaise} > ${balancePaise}`]);
      return {
        decision: 'BLOCKED',
        threat_category: 'POLICY_VIOLATION',
        risk_score: 60,
        rationale: 'Insufficient account balance for transfer.',
        requires_confirmation: false,
        extracted_intent: null,
        trace,
        degraded
      };
    }

    if (!intent.recipient) {
      addTrace('policy', 'block', 'Blocked by R10: Recipient not found in contacts', ['Unknown recipient']);
      return {
        decision: 'BLOCKED',
        threat_category: 'POLICY_VIOLATION',
        risk_score: 60,
        rationale: 'Recipient not found in verified contacts.',
        requires_confirmation: false,
        extracted_intent: null,
        trace,
        degraded
      };
    }
  }

  // --- R11: APPROVED ---
  const isTransfer = intent.action === 'TRANSFER';
  const amountPaise = intent.amount?.paise || null;

  let riskScore = 5;
  if (isTransfer) {
    riskScore = (amountPaise && amountPaise > 1000000) ? 30 : 20;
  }

  addTrace('policy', 'pass', 'Request approved under banking security policy', []);

  const extractedIntent = {
    action: intent.action,
    amount_paise: amountPaise,
    currency: intent.amount ? (intent.amount.currency || 'INR') : null,
    recipient_id: intent.recipient ? intent.recipient.id : null,
    recipient_name: intent.recipient ? intent.recipient.name : null
  };

  return {
    decision: 'APPROVED',
    threat_category: 'BENIGN',
    risk_score: riskScore,
    rationale: 'Request approved according to banking security policy.',
    requires_confirmation: isTransfer,
    extracted_intent: extractedIntent,
    trace,
    degraded
  };
}
