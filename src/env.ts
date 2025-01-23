import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

export const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string(),
});

export const env = envSchema.parse(process.env);
