import crypto from 'node:crypto';
import { callGemini, getLlmStatus } from './gemini.js';
import {
  EXTRACTOR_SYSTEM,
  JUDGE_SYSTEM,
  buildExtractorUser,
  buildJudgeUser,
  makeNonce,
  makeCanary
} from './prompts.js';
import { ExtractorOutputSchema, JudgeOutputSchema } from './schemas.js';

const CACHE_MAX_ENTRIES = 200;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// In-memory LRU cache Map maintains insertion order
const llmCache = new Map();

export function clearLlmCache() {
  llmCache.clear();
}

function getFromCache(key) {
  const item = llmCache.get(key);
  if (!item) return null;

  if (Date.now() > item.expiresAt) {
    llmCache.delete(key);
    return null;
  }

  // Refresh LRU order by deleting and re-inserting
  llmCache.delete(key);
  llmCache.set(key, item);
  return item.value;
}

function putInCache(key, value) {
  if (llmCache.has(key)) {
    llmCache.delete(key);
  } else if (llmCache.size >= CACHE_MAX_ENTRIES) {
    // Evict oldest (least recently used) item
    const oldestKey = llmCache.keys().next().value;
    llmCache.delete(oldestKey);
  }

  llmCache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

export async function analyzeWithLlm({
  instruction = '',
  instructionNorm = '',
  memo = '',
  memoNorm = ''
} = {}) {
  const rawInstruction =
    typeof instruction === 'string'
      ? instruction
      : instruction?.original || instruction?.normalized || '';
  const rawMemo =
    typeof memo === 'string'
      ? memo
      : memo?.original || memo?.normalized || '';

  const normInstruction =
    typeof instructionNorm === 'string'
      ? instructionNorm
      : instructionNorm?.normalized || instructionNorm?.original || rawInstruction.toLowerCase();
  const normMemo =
    typeof memoNorm === 'string'
      ? memoNorm
      : memoNorm?.normalized || memoNorm?.original || rawMemo.toLowerCase();

  const decodedLayers = (instructionNorm?.layers || []).concat(memoNorm?.layers || []);

  // 1. If LLM status is disabled, return immediately
  if (getLlmStatus() === 'disabled') {
    return {
      available: false,
      extract: null,
      judge: null,
      errors: ['LLM_DISABLED'],
      canaryLeaked: false,
      durationMs: 0
    };
  }

  // 2. Check LRU Cache
  const cacheKey = crypto
    .createHash('sha256')
    .update(rawInstruction + '\u0000' + rawMemo)
    .digest('hex');

  const cachedResult = getFromCache(cacheKey);
  if (cachedResult) {
    return {
      ...cachedResult,
      durationMs: 0
    };
  }

  // 3. Generate Nonce + Canary per request
  const nonce = makeNonce();
  const canary = makeCanary();

  // 4. Build Prompts: Extractor receives instruction ONLY, never the memo
  const extractorSystem = EXTRACTOR_SYSTEM(canary);
  const extractorUser = buildExtractorUser({ nonce, instruction: rawInstruction });

  const judgeSystem = JUDGE_SYSTEM(canary);
  const judgeUser = buildJudgeUser({
    nonce,
    instruction: rawInstruction,
    instructionNormalized: normInstruction,
    memo: rawMemo,
    memoNormalized: normMemo,
    decodedLayers
  });

  const errors = [];
  const startTime = Date.now();

  // 5. Execute Extractor and Judge in parallel
  const [extractRes, judgeRes] = await Promise.all([
    callGemini({ system: extractorSystem, user: extractorUser }),
    callGemini({ system: judgeSystem, user: judgeUser })
  ]);

  const durationMs = Date.now() - startTime;

  // 6. Check for canary leaks in raw responses
  const extractStr = JSON.stringify(extractRes.json || '');
  const judgeStr = JSON.stringify(judgeRes.json || '');
  const canaryLeaked = extractStr.includes(canary) || judgeStr.includes(canary);

  if (canaryLeaked) {
    errors.push('CANARY_LEAKED');
  }

  // 7. Validate Extractor Output against schema
  let extract = null;
  if (!extractRes.ok) {
    errors.push(`EXTRACTOR_ERROR: ${extractRes.reason}`);
  } else {
    const parseResult = ExtractorOutputSchema.safeParse(extractRes.json);
    if (!parseResult.success) {
      errors.push('EXTRACTOR_SCHEMA_INVALID');
    } else {
      extract = parseResult.data;
    }
  }

  // 8. Validate Judge Output against schema (truncating summary and evidence to limits)
  let judge = null;
  if (!judgeRes.ok) {
    errors.push(`JUDGE_ERROR: ${judgeRes.reason}`);
  } else {
    const rawJudge = judgeRes.json || {};

    const truncatedEvidence = Array.isArray(rawJudge.evidence)
      ? rawJudge.evidence.slice(0, 5).map((e) => ({
          field: e?.field === 'memo' ? 'memo' : 'instruction',
          quote: typeof e?.quote === 'string' ? e.quote.slice(0, 120) : '',
          reason: typeof e?.reason === 'string' ? e.reason.slice(0, 200) : ''
        }))
      : [];

    const truncatedSummary =
      typeof rawJudge.summary === 'string' ? rawJudge.summary.slice(0, 300) : '';

    const sanitizedJudge = {
      ...rawJudge,
      summary: truncatedSummary,
      evidence: truncatedEvidence
    };

    const parseResult = JudgeOutputSchema.safeParse(sanitizedJudge);
    if (!parseResult.success) {
      errors.push('JUDGE_SCHEMA_INVALID');
    } else {
      judge = parseResult.data;
    }
  }

  // 9. Available is true only if BOTH calls succeeded, validated, and no canary leaked
  const available = extract !== null && judge !== null && !canaryLeaked;

  const result = {
    available,
    extract,
    judge,
    errors,
    canaryLeaked,
    durationMs
  };

  // 10. Store successful results in LRU Cache
  if (available) {
    putInCache(cacheKey, result);
  }

  return result;
}
