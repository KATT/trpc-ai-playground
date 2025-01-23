import { anthropic } from '@ai-sdk/anthropic';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { generateObject, LanguageModelV1, streamText } from 'ai';
import { z } from 'zod';
import { env } from './env';

// Available models

const lmstudio = createOpenAICompatible({
  name: 'lmstudio',
  baseURL: env.LMSTUDIO_URL,
});

const modelMap = {
  'claude-3-5-haiku-latest': anthropic('claude-3-5-haiku-latest'),
  'claude-3-5-sonnet-latest': anthropic('claude-3-5-sonnet-latest'),
  'llama-3.2-3b-instruct': lmstudio('llama-3.2-3b-instruct'),
} as const satisfies Record<string, LanguageModelV1>;

function zodEnumFromObjKeys<K extends string>(obj: Record<K, any>): z.ZodEnum<[K, ...K[]]> {
  return z.enum(Object.keys(obj) as [K, ...K[]]);
}

const modelSchema = zodEnumFromObjKeys(modelMap);

// Initialize tRPC
const t = initTRPC.context<Record<string, unknown>>().create();
const router = t.router;
const publicProcedure = t.procedure;

const llmProcedure = publicProcedure.input(
  z.object({
    model: modelSchema.default('claude-3-5-haiku-latest'),
  })
);

// Define routes
const appRouter = router({
  prompt: llmProcedure
    .input(
      z.object({
        prompt: z.string(),
      })
    )
    .query(opts => {
      const response = streamText({
        model: modelMap[opts.input.model],
        prompt: opts.input.prompt,
      });

      return response.textStream;
    }),
  chat: llmProcedure
    .input(
      z.object({
        messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })),
      })
    )
    .query(opts => {
      const response = streamText({
        model: modelMap[opts.input.model],
        messages: [
          // System prompt
          {
            role: 'system',
            content:
              'You respond short riddles without answer or clues. Add an explanation of the riddle after',
          },
          ...opts.input.messages,
        ],
      });

      return response.textStream;
    }),

  recipe: llmProcedure.input(z.object({ prompt: z.string() })).query(async opts => {
    async function getLoading() {
      const loading = streamText({
        model: modelMap[opts.input.model],
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful assistant that generates recipes. You are just going to give a short message here while a longer LLM is running to generate the actual recipe. Just 1 line is enough while loading',
          },
          { role: 'user', content: opts.input.prompt },
        ],
      });

      return loading.textStream;
    }

    async function getRecipe() {
      const schema = z.object({
        recipe: z.object({
          name: z.string(),
          ingredients: z.array(
            z.object({
              name: z.string(),
              amount: z.string(),
            })
          ),
          steps: z.array(z.string()),
        }),
      });

      const res = await generateObject({
        model: modelMap[opts.input.model],
        schema,
        prompt: opts.input.prompt,
      });

      return res.object;
    }

    return {
      // doesn't work right now
      // loading: getLoading(),
      recipe: await getRecipe(),
    };
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
