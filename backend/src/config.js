import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:4173'),
  SESSION_SECRET: z.string().min(32),
  DEMO_MODE: z.enum(['true', 'false']).default('true'),
  ESIGNET_ISSUER_URL: z.string().optional(),
  ESIGNET_CLIENT_ID: z.string().optional(),
  ESIGNET_CLIENT_SECRET: z.string().optional(),
  ESIGNET_REDIRECT_URI: z.string().url().optional()
});

export const config = envSchema.parse(process.env);
config.demoMode = config.DEMO_MODE === 'true';
config.isProduction = config.NODE_ENV === 'production';

if (config.isProduction && config.demoMode) {
  throw new Error('DEMO_MODE must be false in production.');
}

if (config.isProduction && config.SESSION_SECRET.includes('replace-this')) {
  throw new Error('Set a unique SESSION_SECRET before starting in production.');
}
