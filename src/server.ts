import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { initTRPC } from '@trpc/server';
import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { env } from './env';
import { z } from 'zod';

// Initialize model
const model = anthropic('claude-3-5-haiku-latest');

// Initialize tRPC
const t = initTRPC.context<Record<string, unknown>>().create();
const router = t.router;
const publicProcedure = t.procedure;

// Define routes
const appRouter = router({
  chat: publicProcedure
    .input(
      z.object({
        prompt: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const response = streamText({
        model,
        prompt: input.prompt,
      });

      return response.textStream;
    }),
});

// Export type definition of API
export type AppRouter = typeof appRouter;

// Create standalone server
const server = createHTTPServer({
  router: appRouter,
  createContext: () => ({}),
});

// Start server
const port = env.PORT;
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
