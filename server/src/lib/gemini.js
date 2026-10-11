import { config } from '../config.js';

let consecutiveFailures = 0;
let circuitOpenedAt = 0;
let lastCallFailed = false;
const CIRCUIT_RESET_MS = 30000; // 30 seconds

export function resetCircuitBreaker() {
  consecutiveFailures = 0;
  circuitOpenedAt = 0;
  lastCallFailed = false;
}

function isCircuitOpen() {
  if (circuitOpenedAt > 0) {
    if (Date.now() - circuitOpenedAt < CIRCUIT_RESET_MS) {
      return true;
    }
    // Cooldown elapsed; half-open/closed
    circuitOpenedAt = 0;
    consecutiveFailures = 0;
  }
  return false;
}

export function getLlmStatus() {
  const apiKey = config.geminiApiKey || config.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return 'disabled';
  }
  if (isCircuitOpen() || lastCallFailed) {
    return 'degraded';
  }
  return 'online';
}

function recordSuccess() {
  consecutiveFailures = 0;
  circuitOpenedAt = 0;
  lastCallFailed = false;
}

function recordFailure(reason) {
  if (reason === 'NO_KEY' || reason === 'CIRCUIT_OPEN') {
    return;
  }
  consecutiveFailures++;
  lastCallFailed = true;
  if (consecutiveFailures >= 3) {
    circuitOpenedAt = Date.now();
  }
}

async function executeFetch(url, headers, bodyPayload, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyPayload),
      signal: controller.signal
    });
    clearTimeout(timer);
    return { ok: true, response: res };
  } catch (err) {
    clearTimeout(timer);
    const isTimeout =
      err.name === 'AbortError' ||
      err.name === 'TimeoutError' ||
      controller.signal.aborted;
    return { ok: false, error: err, isTimeout };
  }
}

export async function callGemini({ system = '', user = '', timeoutMs = 8000 } = {}) {
  // 1. Check circuit breaker
  if (isCircuitOpen()) {
    return { ok: false, reason: 'CIRCUIT_OPEN' };
  }

  // 2. Check API key
  const apiKey = config.geminiApiKey || config.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: 'NO_KEY' };
  }

  const model = config.geminiModel || config.GEMINI_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const headers = {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey
  };

  const bodyPayload = {
    systemInstruction: {
      parts: [{ text: system }]
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: user }]
      }
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 600,
      responseMimeType: 'application/json'
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
    ]
  };

  let attempt = 0;
  let finalReason = 'HTTP_ERROR';

  while (attempt < 2) {
    attempt++;

    const fetchResult = await executeFetch(url, headers, bodyPayload, timeoutMs);

    if (!fetchResult.ok) {
      if (fetchResult.isTimeout) {
        finalReason = 'TIMEOUT';
      } else {
        finalReason = 'HTTP_ERROR';
      }

      // Retry once on network error if attempt === 1
      if (attempt === 1) {
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
      break;
    }

    const res = fetchResult.response;

    // Retry once on 429 or 5xx
    if (res.status === 429) {
      finalReason = 'RATE_LIMIT';
      if (attempt === 1) {
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
      break;
    }

    if (res.status >= 500) {
      finalReason = 'HTTP_ERROR';
      if (attempt === 1) {
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
      break;
    }

    if (!res.ok) {
      finalReason = 'HTTP_ERROR';
      break;
    }

    // Success response parsing
    try {
      const data = await res.json();

      // Check safety block
      if (
        data?.promptFeedback?.blockReason ||
        data?.candidates?.[0]?.finishReason === 'SAFETY'
      ) {
        finalReason = 'SAFETY_BLOCK';
        recordFailure(finalReason);
        return { ok: false, reason: 'SAFETY_BLOCK' };
      }

      let rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof rawText !== 'string') {
        finalReason = 'BAD_JSON';
        recordFailure(finalReason);
        return { ok: false, reason: 'BAD_JSON' };
      }

      // Strip markdown code fences if present
      rawText = rawText.trim();
      if (rawText.startsWith('```')) {
        rawText = rawText
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```$/, '')
          .trim();
      }

      const parsedJson = JSON.parse(rawText);
      recordSuccess();
      return { ok: true, json: parsedJson };
    } catch {
      finalReason = 'BAD_JSON';
      recordFailure(finalReason);
      return { ok: false, reason: 'BAD_JSON' };
    }
  }

  recordFailure(finalReason);
  return { ok: false, reason: finalReason };
}
