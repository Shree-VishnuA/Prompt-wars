import { Router } from 'express';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { readFileSync } from 'node:fs';
import { mutate } from '../lib/mutations.js';
import { runPipeline } from '../lib/pipeline.js';
import { getUserId } from '../middleware/session.js';

export const labRouter = Router();

// Load labeled benchmark cases
const casesJson = JSON.parse(
  readFileSync(new URL('../data/cases.json', import.meta.url), 'utf8')
);

// In-memory cache for deterministic benchmark (60s TTL)
let deterministicBenchmarkCache = null;
let deterministicBenchmarkCacheTime = 0;
const BENCHMARK_CACHE_TTL_MS = 60 * 1000;

export function clearBenchmarkCache() {
  deterministicBenchmarkCache = null;
  deterministicBenchmarkCacheTime = 0;
}

// Rate limit to 20/min for /mutate
const labRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Too many mutation requests, please try again later.'
  }
});

// Rate limit to 6/min for /benchmark
const benchmarkRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 6,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Too many benchmark requests, please try again later.'
  }
});

const MutateBodySchema = z.object({
  instruction: z.string().optional().default(''),
  memo: z.string().optional().default(''),
  targetField: z.enum(['instruction', 'memo']).optional(),
  useLlm: z.boolean().optional().default(false)
});

const BenchmarkBodySchema = z.object({
  mode: z.enum(['deterministic', 'full']).optional().default('deterministic')
});

async function mapConcurrent(items, concurrency, fn) {
  const results = new Array(items.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      results[idx] = await fn(items[idx], idx);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);
  return results;
}

// GET /api/lab/cases -> the list of benchmark cases
labRouter.get('/cases', (req, res) => {
  return res.status(200).json(casesJson);
});

// POST /api/lab/mutate
labRouter.post('/mutate', labRateLimiter, async (req, res) => {
  const parseResult = MutateBodySchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Malformed request body.',
      details: parseResult.error.issues
    });
  }

  const { instruction, memo, targetField, useLlm } = parseResult.data;

  // Generate variants capped at 20
  let variants = mutate({ instruction, memo, targetField });
  variants = variants.slice(0, 20);

  const userId = getUserId(req);

  // Execute pipeline concurrently (concurrency = 4)
  const executedVariants = await mapConcurrent(variants, 4, async (variant) => {
    const pipelineVerdict = await runPipeline({
      instruction: variant.instruction,
      memo: variant.memo,
      userId,
      options: { useLlm }
    });

    const layersFlagged = (pipelineVerdict.trace || [])
      .filter((t) => t.status === 'flag' || t.status === 'block')
      .map((t) => t.layer);

    return {
      id: variant.id,
      label: variant.label,
      instruction: variant.instruction,
      memo: variant.memo,
      verdict: {
        decision: pipelineVerdict.decision,
        threat_category: pipelineVerdict.threat_category,
        risk_level: pipelineVerdict.risk_level,
        layers_flagged: [...new Set(layersFlagged)]
      }
    };
  });

  return res.status(200).json({
    variants: executedVariants
  });
});

// POST /api/lab/benchmark
labRouter.post('/benchmark', benchmarkRateLimiter, async (req, res) => {
  const parseResult = BenchmarkBodySchema.safeParse(req.body || {});
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Malformed request body.',
      details: parseResult.error.issues
    });
  }

  const { mode } = parseResult.data;

  // Cache hit for deterministic mode (60s TTL)
  if (
    mode === 'deterministic' &&
    deterministicBenchmarkCache &&
    Date.now() - deterministicBenchmarkCacheTime < BENCHMARK_CACHE_TTL_MS
  ) {
    return res.status(200).json(deterministicBenchmarkCache);
  }

  const useLlm = mode === 'full';
  const userId = getUserId(req);

  const startAll = Date.now();

  // Run all 60 cases with concurrency 4
  const results = await mapConcurrent(casesJson, 4, async (c) => {
    const verdict = await runPipeline({
      instruction: c.instruction,
      memo: c.memo,
      userId,
      options: { useLlm }
    });
    return {
      case: c,
      verdict
    };
  });

  const totalTime = Date.now() - startAll;
  const avgLatency = Number((totalTime / casesJson.length).toFixed(2));

  let attacksCount = 0;
  let attacksBlockedCount = 0;
  let benignCount = 0;
  let benignBlockedCount = 0;
  let categoryMatches = 0;

  const byGroup = {};
  const failures = [];

  for (const { case: c, verdict } of results) {
    if (!byGroup[c.group]) {
      byGroup[c.group] = { total: 0, passed: 0 };
    }
    byGroup[c.group].total++;

    const isBenign = c.group === 'benign' || c.expected_decision === 'APPROVED';
    if (isBenign) {
      benignCount++;
      if (verdict.decision === 'BLOCKED') {
        benignBlockedCount++;
      }
    } else {
      attacksCount++;
      if (verdict.decision === 'BLOCKED') {
        attacksBlockedCount++;
      }
    }

    if (verdict.threat_category === c.expected_category) {
      categoryMatches++;
    }

    const passedDecision = verdict.decision === c.expected_decision;
    const passedCategory = verdict.threat_category === c.expected_category;

    if (passedDecision && passedCategory) {
      byGroup[c.group].passed++;
    } else {
      failures.push({
        id: c.id,
        name: c.name,
        expected: { decision: c.expected_decision, category: c.expected_category },
        actual: { decision: verdict.decision, category: verdict.threat_category }
      });
    }
  }

  const detectionRate =
    attacksCount > 0 ? Number((attacksBlockedCount / attacksCount).toFixed(4)) : 1.0;
  const falsePositiveRate =
    benignCount > 0 ? Number((benignBlockedCount / benignCount).toFixed(4)) : 0.0;
  const categoryAccuracy = Number((categoryMatches / casesJson.length).toFixed(4));

  const responsePayload = {
    mode,
    total: casesJson.length,
    detection_rate: detectionRate,
    false_positive_rate: falsePositiveRate,
    category_accuracy: categoryAccuracy,
    avg_latency_ms: avgLatency,
    by_group: byGroup,
    failures
  };

  if (mode === 'deterministic') {
    deterministicBenchmarkCache = responsePayload;
    deterministicBenchmarkCacheTime = Date.now();
  }

  return res.status(200).json(responsePayload);
});
