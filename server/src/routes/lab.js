import { Router } from 'express';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { mutate } from '../lib/mutations.js';
import { runPipeline } from '../lib/pipeline.js';
import { getUserId } from '../middleware/session.js';

export const labRouter = Router();

// Rate limit to 20/min
const labRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Too many mutation requests, please try again later.'
  }
});

const MutateBodySchema = z.object({
  instruction: z.string().optional().default(''),
  memo: z.string().optional().default(''),
  targetField: z.enum(['instruction', 'memo']).optional(),
  useLlm: z.boolean().optional().default(false)
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
