import crypto from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { config } from './config.js';
import { bankRouter } from './routes/bank.js';
import { executeRouter } from './routes/execute.js';
import { analyzeRouter } from './routes/analyze.js';
import { authRouter } from './routes/auth.js';
import { sessionMiddleware } from './middleware/session.js';
import { getLlmStatus } from './lib/gemini.js';

export function createApp() {
  const app = express();

  // 1. Request ID middleware (crypto.randomUUID, set req.id and header)
  app.use((req, res, next) => {
    req.id = crypto.randomUUID();
    res.setHeader('X-Request-Id', req.id);
    next();
  });

  // 2. Helmet (default for now)
  app.use(helmet());

  // 3. CORS (origin from CLIENT_ORIGIN or true in dev, credentials true)
  const corsOrigin = config.isDev
    ? (config.clientOrigin || true)
    : (config.clientOrigin || false);

  app.use(
    cors({
      origin: corsOrigin,
      credentials: true
    })
  );

  // 4. Express JSON parser with 16kb limit
  app.use(express.json({ limit: '16kb' }));

  // 5. Cookie parser with SERVER_SECRET
  app.use(cookieParser(config.serverSecret));

  // Session middleware
  app.use(sessionMiddleware);

  // 6. Rate limiting on /api (300 req/min per IP, JSON error body)
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      error: 'Too many requests, please try again later.'
    }
  });
  app.use('/api', apiLimiter);

  // GET /health
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'bankism',
      llm: getLlmStatus(),
      policy_version: '1.0.0'
    });
  });

  // Bank routes
  app.use('/api/bank', bankRouter);

  // Analyze + audit routes
  app.use('/api', analyzeRouter);

  // Execute route
  app.use('/api', executeRouter);

  // Auth routes
  app.use('/api/auth', authRouter);


  // 404 handler for unmatched routes
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found'
    });
  });

  // Final error handler (never leaks stack traces, catches malformed JSON as 400)
  app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      return res.status(400).json({
        error: 'Malformed JSON payload'
      });
    }

    const statusCode = typeof err.status === 'number' ? err.status : 500;
    const message = statusCode < 500 ? (err.message || 'Bad Request') : 'Internal Server Error';

    res.status(statusCode).json({
      error: message
    });
  });

  return app;
}
