import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieSession from 'cookie-session';
import { rateLimit } from 'express-rate-limit';
import { ZodError } from 'zod';
import { config } from './config.js';
import { prisma } from './db.js';
import { HttpError } from './http-error.js';
import { apiRouter } from './routes/api.js';

export const app = express();
app.disable('x-powered-by');
if (config.isProduction) app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || origin === config.FRONTEND_ORIGIN) return callback(null, true);
    return callback(new HttpError(403, 'ORIGIN_NOT_ALLOWED', 'This app origin is not allowed.'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json({ limit: '16kb' }));
app.use(cookieSession({
  name: 'daryeelpass.session',
  keys: [config.SESSION_SECRET],
  maxAge: 14 * 24 * 60 * 60 * 1000,
  httpOnly: true,
  sameSite: 'lax',
  secure: config.isProduction,
  path: '/'
}));

app.get('/health', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: 'ok', database: 'ok' });
});

app.use('/api/v1', rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false
}));
app.use('/api/v1', apiRouter);

app.use((_req, _res, next) => next(new HttpError(404, 'NOT_FOUND', 'The requested route was not found.')));

app.use((error, _req, res, _next) => {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Check the submitted fields.', details: error.issues.map(({ path, message }) => ({ path, message })) }
    });
  }

  if (error?.code === 'P2002') {
    return res.status(409).json({ error: { code: 'CONFLICT', message: 'This record already exists.' } });
  }
  if (error?.code === 'P2025') {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'The requested record was not found.' } });
  }

  const status = error instanceof HttpError ? error.status : 500;
  const code = error instanceof HttpError ? error.code : 'INTERNAL_ERROR';
  const message = error instanceof HttpError ? error.message : 'An unexpected server error occurred.';

  if (status >= 500) console.error('API request failed:', error);
  return res.status(status).json({ error: { code, message } });
});
