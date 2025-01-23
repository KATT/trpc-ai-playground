import { anthropic } from '@ai-sdk/anthropic';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { openai } from '@ai-sdk/openai';
import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { generateObject, generateText, LanguageModelV1, streamObject, streamText } from 'ai';
import { z } from 'zod';
import { zfd } from 'zod-form-data';
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
    // Requires `OPENAI_API_KEY`
    // https://platform.openai.com/
    'gpt-4-turbo-preview': openai('gpt-4-turbo-preview'),
    'gpt-4': openai('gpt-4'),
    'gpt-3.5-turbo': openai('gpt-3.5-turbo'),
    // Requires LMStudio installed and running (free)
    // https://lmstudio.ai/
    'lmstudio-default': lmstudio(''),
  } as const satisfies Record<string, LanguageModelV1>;

  function zodEnumFromObjKeys<K extends string>(obj: Record<K, any>): z.ZodEnum<[K, ...K[]]> {
    return z.enum(Object.keys(obj) as [K, ...K[]]);
  }

  const schema = zodEnumFromObjKeys(record).default('claude-3-5-haiku-latest');

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
      model: models.schema,
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
        messages: z.array(
          z.object({
            role: z.enum(['user', 'assistant']),
            content: z.string(),
          })
        ),
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

  recipeObject: llmProcedure
    .input(
      z.object({
        prompt: z.string(),
      })
    )
    .query(async opts => {
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

  recipeStream: llmProcedure
    .input(
      z.object({
        prompt: z.string(),
      })
    )
    .query(async opts => {
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
        recipe: run(async function* () {
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
          const stream = streamObject({
            model: opts.ctx.model,
            schema,
            prompt: opts.input.prompt,
            system: 'You are a helpful assistant that generates recipes.',
          });

          for await (const chunk of stream.partialObjectStream) {
            // console.log({
            //   name: chunk.recipe?.name,
            //   ingredients: chunk.recipe?.ingredients?.length ?? 0,
            //   steps: chunk.recipe?.steps?.length ?? 0,
            // });
            // Adds artificial delay to make the progress more readable
            await new Promise(resolve => setTimeout(resolve, 10));
            yield chunk;
          }
        }),
      };
    }),

  sentiment: llmProcedure
    .input(
      z.object({
        text: z.string(),
      })
    )
    .query(async opts => {
      const res = await generateObject({
        model: opts.ctx.model,
        output: 'enum',
        enum: ['positive', 'negative', 'neutral'],
        prompt: opts.input.text,
        system: 'Classify the sentiment of the text as either positive, negative, or neutral.',
      });

      return res.object;
    }),

  users: llmProcedure
    .input(
      z.object({
        prompt: z.string(),
      })
    )
    .query(async opts => {
      const userSchema = z.object({
        name: z.string().describe('Full name of the user'),
        age: z.number().describe('Age of the user between 18 and 80'),
        email: z.string().email().describe('A valid email address'),
        occupation: z.string().describe("The user's job or profession"),
        city: z.string().describe('A city in the UK'),
      });

      const res = await generateObject({
        model: opts.ctx.model,
        schema: userSchema,
        output: 'array',
        prompt: opts.input.prompt,
        system:
          'You are generating realistic fake user data for UK residents. Create diverse, believable profiles.',
      });

      return res.object;
    }),

  // All of them don't support image generation so not using llmProcedure for this one
  describeImage: publicProcedure
    .input(
      z.object({
        imageUrl: z.string().url(),
      })
    )
    .query(async opts => {
      const response = await fetch(opts.input.imageUrl);
      const buffer = await response.arrayBuffer();
      const base64Image = Buffer.from(buffer).toString('base64');

      const { text } = await generateText({
        model: models.record['gpt-4-turbo-preview'],
        system: [
          'You will receive an image.',
          'Please create an alt text for the image.',
          'Be concise.',
          'Use adjectives only when necessary.',
          'Do not pass 160 characters.',
          'Use simple language.',
        ].join(' '),
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                image: base64Image,
              },
            ],
          },
        ],
      });

      return text;
    }),

  extractInvoice: publicProcedure
    .input(
      zfd.formData({
        fileContent: zfd.file(),
        model: models.schema,
      })
    )
    .use(opts => {
      return opts.next({
        ctx: {
          model: models.record[opts.input.model],
        },
      });
    })
    .mutation(async opts => {
      const schema = z
        .object({
          total: z.number().describe('The total amount of the invoice.'),
          currency: z.string().describe('The currency of the total amount.'),
          invoiceNumber: z.string().describe('The invoice number.'),
          companyAddress: z
            .string()
            .describe('The address of the company or person issuing the invoice.'),
          companyName: z.string().describe('The name of the company issuing the invoice.'),
          invoiceeAddress: z
            .string()
            .describe('The address of the company or person receiving the invoice.'),
        })
        .describe('The extracted data from the invoice.');

      const res = await generateObject({
        model: opts.ctx.model,
        schema,
        system: 'You will receive an invoice. Please extract the data from the invoice.',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                data: await opts.input.fileContent.arrayBuffer(),
                mimeType: opts.input.fileContent.type,
              },
            ],
          },
        ],
      });

      return res.object;
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
