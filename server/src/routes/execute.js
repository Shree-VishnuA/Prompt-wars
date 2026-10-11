import { Router } from 'express';
import { z } from 'zod';
import { verifyIntentToken, consumeNonce } from '../lib/token.js';
import * as mockBank from '../lib/mockBank.js';

export const executeRouter = Router();

const ExecuteRequestSchema = z.object({
  intent_token: z.string({
    required_error: 'intent_token is required',
    invalid_type_error: 'intent_token must be a string'
  }).min(1, 'intent_token cannot be empty')
});

executeRouter.post(['/execute', '/'], (req, res) => {
  // 1. Validate with Zod - malformed body -> HTTP 400
  const parseResult = ExecuteRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Malformed request body: intent_token is required.',
      status: 'rejected',
      reason: 'MALFORMED_INPUT'
    });
  }

  const { intent_token } = parseResult.data;

  // 2. Verify token signature, structure, and expiration
  const verification = verifyIntentToken(intent_token);
  if (!verification.valid) {
    return res.status(200).json({
      status: 'rejected',
      reason: verification.reason || 'INVALID_TOKEN'
    });
  }

  const payload = verification.payload;

  // 3. Consume nonce (replay protection)
  const consumed = consumeNonce(payload.nonce, payload.exp);
  if (!consumed) {
    return res.status(200).json({
      status: 'rejected',
      reason: 'TOKEN_REPLAYED'
    });
  }

  // 4. Call mockBank.transfer using ONLY values inside the token (never from req.body)
  try {
    const userId = payload.uid || 'usr_demo';
    const receipt = mockBank.transfer(userId, {
      recipient_id: payload.rid,
      amount_paise: payload.amt,
      memo: ''
    });

    return res.status(200).json({
      status: 'executed',
      receipt,
      balance_paise: receipt.balance_paise
    });
  } catch (err) {
    const reason = err.code || err.message || 'TRANSFER_FAILED';
    return res.status(200).json({
      status: 'rejected',
      reason
    });
  }
});
