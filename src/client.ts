import { createTRPCClient, unstable_httpBatchStreamLink } from '@trpc/client';
import { inferRouterInputs } from '@trpc/server';
import type { AppRouter } from './server';
import { inspect } from 'util';

type Inputs = inferRouterInputs<AppRouter>;

// Initialize tRPC client
const client = createTRPCClient<AppRouter>({
  links: [
    unstable_httpBatchStreamLink({
      url: `http://localhost:${process.env['PORT'] || 3000}`,
    }),
  ],
});

async function askDemo() {
  const chat = (function () {
    /**
     * Client holds state of the chat and passes it to the server on each request
     */
    const messages: Inputs['chat']['messages'] = [];

    return {
      async ask(question: string) {
        process.stdout.write(`Asking: ${question}\n`);
        messages.push({ role: 'user', content: question });

        process.stdout.write('... ');
        const res = await client.chat.query({
          messages,
          // model: 'lmstudio-default',
        });
        process.stdout.write('response:\n');

        let allChunks: string[] = [];

        for await (const chunk of res) {
          process.stdout.write(chunk);
          allChunks.push(chunk);
        }

        process.stdout.write('\n\n');

        messages.push({ role: 'assistant', content: allChunks.join('') });

        return allChunks.join('');
      },
    };
  })();

  await chat.ask('What is the capital of France?');
  await chat.ask('What is the capital of the UK?');
}

async function promptDemo() {
  const prompt = 'What is the capital of France? Give a really long-winded answer.';

  process.stdout.write(prompt + '\n');

  const res = await client.prompt.query({
    prompt,
    // model: 'lmstudio-default',
  });

  for await (const chunk of res) {
    process.stdout.write(chunk);
  }
}

async function structuredRecipeDemo() {
  const prompt = 'Give me a recipe for a chocolate cake.';

  process.stdout.write(prompt + '\n');

  const res = await client.recipeObject.query({ prompt });

  for await (const chunk of res.loading) {
    process.stdout.write(chunk);
  }

  console.log('\n');

  console.log(inspect(await res.recipe, { depth: null }));
}

async function structuredRecipeStreamDemo() {
  const prompt = 'Give me a recipe for a chocolate cake.';

  process.stdout.write(prompt + '\n');

  const res = await client.recipeStream.query({ prompt });

  for await (const chunk of res.loading) {
    process.stdout.write(chunk);
  }

  process.stdout.write('\n');

  let lastNumberOfLinesToClear = 0;
  for await (const chunk of res.recipe) {
    // Then we get a bunch of chunks with the actual recipe
    // We need to clear the previous lines to make the output more readable
    if (lastNumberOfLinesToClear > 0) {
      process.stdout.moveCursor(0, -lastNumberOfLinesToClear);
      process.stdout.clearScreenDown();
    }

    const output = inspect(chunk, { depth: null });
    process.stdout.write(output);
    lastNumberOfLinesToClear = output.split('\n').length;
    process.stdout.write('\n');
  }

  console.log('\n');
}

async function sentimentDemo() {
  const texts = [
    "I absolutely love this product! It's amazing!",
    'This is the worst experience ever.',
    'The weather is quite normal today.',
  ];

  for (const text of texts) {
    process.stdout.write(`Analyzing: "${text}"\n`);
    const sentiment = await client.sentiment.query({ text });
    console.log(`Sentiment: ${sentiment}\n`);
  }
}

async function usersDemo() {
  const prompt = 'Generate 3 users who work in tech companies';

  process.stdout.write(`${prompt}\n`);
  const users = await client.users.query({ prompt });
  console.log(inspect(users, { depth: null, colors: true }));
}

async function imageDemo() {
  const imageUrls = [
    'https://images.unsplash.com/photo-1546527868-ccb7ee7dfa6a?q=80&w=2070&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?q=80&w=2070&auto=format&fit=crop',
  ];

  for (const imageUrl of imageUrls) {
    process.stdout.write(`Describing image: ${imageUrl}\n`);
    const description = await client.describeImage.query({ imageUrl });
    console.log(`Description: ${description}\n`);
  }
}

// await promptDemo();
// console.log('\n\n');
// await askDemo();
// console.log('\n\n');
// await structuredRecipeDemo();
// await structuredRecipeStreamDemo();
// await sentimentDemo();
// await usersDemo();
await imageDemo();
