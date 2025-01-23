import { anthropic } from '@ai-sdk/anthropic';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { generateObject, LanguageModelV1, streamObject, streamText } from 'ai';
import { z } from 'zod';
import { env } from './env';

const run = <T>(fn: () => T) => fn();

// Available models
const models = (() => {
  const lmstudio = createOpenAICompatible({
    name: 'lmstudio',
    baseURL: env.LMSTUDIO_URL,
  });

  const record = {
    // Requires `ANTHROPIC_API_KEY`
    // https://console.anthropic.com/
    'claude-3-5-haiku-latest': anthropic('claude-3-5-haiku-latest'),
    'claude-3-5-sonnet-latest': anthropic('claude-3-5-sonnet-latest'),
    // Requires LMStudio installed and running (free)
    // https://lmstudio.ai/
    'lmstudio-default': lmstudio(''),
  } as const satisfies Record<string, LanguageModelV1>;

  function zodEnumFromObjKeys<K extends string>(obj: Record<K, any>): z.ZodEnum<[K, ...K[]]> {
    return z.enum(Object.keys(obj) as [K, ...K[]]);
  }

  const schema = zodEnumFromObjKeys(record);

  return {
    schema,
    record,
  };
})();

// Initialize tRPC
const t = initTRPC.context<Record<string, unknown>>().create();
const router = t.router;
const publicProcedure = t.procedure;

const llmProcedure = publicProcedure
  .input(
    z.object({
      model: models.schema.default('claude-3-5-haiku-latest'),
    })
  )
  .use(opts => {
    return opts.next({
      ctx: {
        model: models.record[opts.input.model],
      },
    });
  });

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
        model: opts.ctx.model,
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
        model: opts.ctx.model,
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

  recipeObject: llmProcedure.input(z.object({ prompt: z.string() })).query(async opts => {
    return {
      /**
       * A nice loading message while the full recipe is being generated
       */
      loading: run(() => {
        const loading = streamText({
          model: opts.ctx.model,
          messages: [
            {
              role: 'system',
              content: [
                'You are a helpful assistant that generates recipes.',
                'You are just going to give a short message here while a longer LLM is running to generate the actual recipe.',
                'Just 1 line is enough while loading',
                'Emojis are fun!',
              ].join('\n'),
            },
            { role: 'user', content: opts.input.prompt },
          ],
        });

        return loading.textStream;
      }),
      recipe: run(async () => {
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
          model: opts.ctx.model,
          schema,
          prompt: opts.input.prompt,
          system: 'You are a helpful assistant that generates recipes.',
        });

        return res.object;
      }),
    };
  }),

  recipeStream: llmProcedure.input(z.object({ prompt: z.string() })).query(async function* (opts) {
    const loadingStream = run(() => {
      const loading = streamText({
        model: opts.ctx.model,
        messages: [
          {
            role: 'system',
            content: [
              'You are a helpful assistant that generates recipes.',
              'You are just going to give a short message here while a longer LLM is running to generate the actual recipe.',
              'Just 1 line is enough while loading',
              'Emojis are fun!',
            ].join('\n'),
          },
          { role: 'user', content: opts.input.prompt },
        ],
      });
      return loading.textStream;
    });

    const structuredStream = run(() => {
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
      return streamObject({
        model: opts.ctx.model,
        schema,
        prompt: opts.input.prompt,
        system: 'You are a helpful assistant that generates recipes.',
      });
    });

    yield* loadingStream;
    yield '\n\n';
    for await (const chunk of structuredStream.partialObjectStream) {
      yield chunk;

      // console.log({
      //   name: chunk.recipe?.name,
      //   ingredients: chunk.recipe?.ingredients?.length ?? 0,
      //   steps: chunk.recipe?.steps?.length ?? 0,
      // });
      // Adds artificial delay to make the stream more readable
      await new Promise(resolve => setTimeout(resolve, 10));
    }
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
