import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173'),
  SESSION_SECRET: z.string().min(32),
  SYSTEM_SETUP_KEY: z.string().min(32).optional(),
});

export const config = envSchema.parse(process.env);
config.isProduction = config.NODE_ENV === 'production';

if (config.isProduction && config.SESSION_SECRET.includes('replace-this')) {
  throw new Error('Set a unique SESSION_SECRET before starting in production.');
}
if (config.SYSTEM_SETUP_KEY?.includes('replace-this')) {
  throw new Error('Set a unique SYSTEM_SETUP_KEY before enabling first-run setup.');
}
