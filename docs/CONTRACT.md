ENUMS
- decision: APPROVED | BLOCKED
- risk_level: LOW | MEDIUM | HIGH | CRITICAL (from risk_score 0-100: 0-24 LOW, 25-49 MEDIUM, 50-79 HIGH, 80-100 CRITICAL)
- threat_category: BENIGN, DIRECT_PROMPT_INJECTION, ROLEPLAY_JAILBREAK, MEMO_INJECTION, TOKEN_OBFUSCATION, DATA_EXFILTRATION, AMOUNT_MISMATCH, UNAUTHORIZED_ACCESS, POLICY_VIOLATION, AMBIGUOUS_REQUEST, MALFORMED_INPUT, SERVICE_DEGRADED
- action: BALANCE_INQUIRY | TRANSACTION_HISTORY | TRANSFER | UNSUPPORTED
- trace layer: validation | normalization | deterministic | llm_extractor | llm_judge | grounding | policy
- trace status: pass | flag | block | skipped | error

VERDICT JSON (returned by POST /api/analyze, always this shape, even for errors)
{ request_id, decision, requires_confirmation (bool), risk_level, risk_score (int), threat_category, rationale (string, max 300 chars), extracted_intent: {action, amount_paise|null, currency|null, recipient_id|null, recipient_name|null} | null, trace: [{layer, status, summary, findings: string[], duration_ms}], policy_version: "1.0.0", degraded (bool), simulated_result: object|null, intent_token: string|null, latency_ms }
Invariants: APPROVED implies threat_category BENIGN and risk_score <= 49. BLOCKED implies intent_token null and simulated_result null.

ENDPOINTS
GET /health -> {status:"ok", service:"bankism", llm:"online"|"degraded"|"disabled", policy_version}
POST /api/analyze {instruction: string 1-500 chars, memo?: string 0-140 chars} -> verdict (HTTP 200; malformed body -> HTTP 400 with a BLOCKED MALFORMED_INPUT verdict)
POST /api/execute {intent_token} -> {status:"executed"|"rejected", reason?, receipt?, balance_paise?}
GET /api/bank/account -> {user, account_id, balance_paise, contacts[], history[]}
GET /api/audit -> last 50 redacted verdict summaries
POST /api/lab/mutate, GET /api/lab/cases, POST /api/lab/benchmark
POST /api/auth/guest, POST /api/auth/google {credential}, GET /api/auth/me, POST /api/auth/logout

MOCK BANK: default user usr_demo, account ACC-1001, balance 5000000 paise (Rs 50,000). Contacts: c_rahul "Rahul Sharma" (alias rahul), c_priya "Priya Nair" (priya), c_amit "Amit Verma" (amit), c_mom "Mom" (mom). Per-transfer limit 2500000 paise. Currency INR only. All money is integer paise.
