import { anthropic } from '@ai-sdk/anthropic';
import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { streamText } from 'ai';
import { z } from 'zod';
import { env } from './env';

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
        messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })),
      })
    )
    .mutation(async opts => {
      const response = streamText({
        model,
        messages: [
          // System prompt
          { role: 'system', content: 'You respond short riddles without answer or clues' },
          ...opts.input.messages,
        ],
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
  onError: opts => {
    console.error(opts.error);
  },
});

// Start server
const port = env.PORT;
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
