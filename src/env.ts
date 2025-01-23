import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

export const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().optional(),
  LMSTUDIO_URL: z.string().url(),
  PORT: z.coerce.number().default(3000),
});

export const env = envSchema.parse(process.env);
