import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

export const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  LMSTUDIO_URL: z.string().url(),
  PORT: z.coerce.number().default(3000),
});

const res = envSchema.safeParse(process.env);

if (!res.success) {
  throw new Error('❌ Invalid environment variables - did you miss to `cp .env.example .env`?', {
    cause: res.error,
  });
}

export const env = res.data;
