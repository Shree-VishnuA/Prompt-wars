import { Router } from 'express';
import { z } from 'zod';
import { runPipeline } from '../lib/pipeline.js';
import { makeBlockedVerdict } from '../lib/schemas.js';
import { recordAudit, getAuditLog } from '../lib/audit.js';
import crypto from 'node:crypto';

export const analyzeRouter = Router();

const BodySchema = z.object({
  instruction: z.string(),
  memo: z.string().optional().default('')
});

analyzeRouter.post('/analyze', async (req, res) => {
  // Quick pre-check: if body is missing instruction key entirely, short-circuit
  const bodyCheck = BodySchema.safeParse(req.body);
  if (!bodyCheck.success) {
    // Return HTTP 400 with a BLOCKED MALFORMED_INPUT verdict
    const verdict = makeBlockedVerdict({
      request_id: crypto.randomUUID(),
      category: 'MALFORMED_INPUT',
      score: 60,
      rationale: 'Request failed payload schema validation.',
      trace: [
        {
          layer: 'validation',
          status: 'block',
          summary: 'Missing or invalid required fields',
          findings: bodyCheck.error.issues.map((i) => i.message),
          duration_ms: 0
        }
      ]
    });
    verdict.latency_ms = 0;

    // Record to audit with instruction preview from raw body (may be undefined)
    const rawInstruction = req.body?.instruction;
    verdict._instruction = typeof rawInstruction === 'string' ? rawInstruction : '';
    recordAudit(verdict);
    delete verdict._instruction;

    return res.status(400).json(verdict);
  }

  const { instruction, memo } = bodyCheck.data;

  // runPipeline handles all further validation (length, types) and errors internally
  const verdict = await runPipeline({
    instruction,
    memo,
    userId: req.user?.id || 'usr_demo',
    options: { useLlm: true }
  });

  // Record to audit log (attach instruction for preview masking, then remove)
  verdict._instruction = instruction;
  recordAudit(verdict);
  delete verdict._instruction;

  return res.status(200).json(verdict);
});

analyzeRouter.get('/audit', (req, res) => {
  return res.status(200).json(getAuditLog());
});
