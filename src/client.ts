import {
  createTRPCClient,
  httpLink,
  isNonJsonSerializable,
  splitLink,
  unstable_httpBatchStreamLink,
} from '@trpc/client';
import { inferRouterInputs } from '@trpc/server';
import type { AppRouter } from './server';
import { inspect } from 'util';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type Inputs = inferRouterInputs<AppRouter>;

// Initialize tRPC client
const url = `http://localhost:${process.env['PORT'] || 3000}`;
const client = createTRPCClient<AppRouter>({
  links: [
    splitLink({
      condition: op => isNonJsonSerializable(op.input),
      true: httpLink({
        url,
      }),
      false: unstable_httpBatchStreamLink({
        url,
      }),
    }),
  ],
});

const spinner = (() => {
  const spinner = ['◜', '◠', '◝', '◞', '◡', '◟'];
  let interval: NodeJS.Timeout | null = null;

  return {
    start() {
      if (interval) {
        throw new Error('Loading spinner is already running');
      }

      let first = true;
      let currentIndex = 0;
      function writeSpinner() {
        if (!first) {
          process.stdout.write('\b');
        }
        process.stdout.write(spinner[currentIndex]!);
        currentIndex = (currentIndex + 1) % spinner.length;
        first = false;
      }
      writeSpinner();
      interval = setInterval(writeSpinner, 75);
    },

    stop() {
      if (!interval) return;
      clearInterval(interval);
      interval = null;
      process.stdout.write('\b'); // Clear the spinner character
      process.stdout.write('\x1B[?25h'); // Show cursor
    },
  };
})();

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

        process.stdout.write('Response: ');
        spinner.start();
        const res = await client.chat.query({
          messages,
          // model: 'lmstudio-default',
        });

        let allChunks: string[] = [];

        for await (const chunk of res) {
          spinner.stop();
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
  await chat.ask('Summarize the conversation so far.');
}

async function promptDemo() {
  const prompt = 'What is the capital of France? Give a really long-winded answer.';

  process.stdout.write(prompt + '\n');
  process.stdout.write('Response: ');
  spinner.start();
  const res = await client.prompt.query({
    prompt,
    // model: 'lmstudio-default',
  });

  for await (const chunk of res) {
    spinner.stop();
    process.stdout.write(chunk);
  }
}

async function structuredRecipeDemo() {
  const prompt = 'Give me a recipe for a chocolate cake.';

  process.stdout.write(prompt + '\n');
  spinner.start();
  const res = await client.recipeObject.query({ prompt });

  for await (const chunk of res.loading) {
    spinner.stop();
    process.stdout.write(chunk);
  }

  console.log('\n');

  spinner.start();

  const recipe = await res.recipe;
  spinner.stop();

  console.log(inspect(recipe, { depth: null }));
}

async function structuredRecipeStreamDemo() {
  const prompt = 'Give me a recipe for a chocolate cake.';

  process.stdout.write(prompt + '\n');
  spinner.start();
  const res = await client.recipeStream.query({ prompt });

  for await (const chunk of res.loading) {
    spinner.stop();
    process.stdout.write(chunk);
  }

  process.stdout.write('\n\n');

  spinner.start();

  let lastNumberOfLinesToClear = 0;
  for await (const chunk of res.recipe) {
    spinner.stop();
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
    spinner.start();
    const sentiment = await client.sentiment.query({ text });
    spinner.stop();
    console.log(`Sentiment: ${sentiment}\n`);
  }
}

async function usersFixtureDataDemo() {
  const prompt = 'Generate 3 users who work in tech companies';

  process.stdout.write(`${prompt}\n`);
  spinner.start();
  const users = await client.users.query({ prompt });
  spinner.stop();
  console.log(inspect(users, { depth: null, colors: true }));
}

async function imageDescriptionDemo() {
  const imageUrls = [
    'https://images.unsplash.com/photo-1546527868-ccb7ee7dfa6a?q=80&w=2070&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?q=80&w=2070&auto=format&fit=crop',
  ];

  for (const imageUrl of imageUrls) {
    process.stdout.write(`Describing image: ${imageUrl}\n`);

    process.stdout.write('Description: ');
    spinner.start();
    const description = await client.describeImage.query({
      imageUrl,
      model: 'claude-3-5-sonnet-latest',
    });

    for await (const chunk of description) {
      spinner.stop();
      process.stdout.write(chunk);
    }
    process.stdout.write('\n\n');
  }
}

async function pdfParsingDemo() {
  const pdfPath = path.join(__dirname, './fixtures/invoice.pdf');
  process.stdout.write(`Extracting data from ${pdfPath}\n`);

  const fileContent = readFileSync(pdfPath, 'utf-8');
  const formData = new FormData();
  formData.append(
    'fileContent',
    new Blob([fileContent], { type: 'application/pdf' }),
    'invoice.pdf'
  );
  formData.append('model', 'claude-3-5-sonnet-latest');

  spinner.start();
  const data = await client.extractInvoice.mutate(formData);
  spinner.stop();
  console.log(inspect(data, { depth: null, colors: true }));
}

try {
  // await promptDemo();
  // console.log('\n----\n');
  // await askDemo();
  // console.log('\n----\n');
  // await structuredRecipeDemo();
  // console.log('\n----\n');
  await structuredRecipeStreamDemo();
  // console.log('\n----\n');
  // await sentimentDemo();
  // console.log('\n----\n');
  // await usersFixtureDataDemo();
  // console.log('\n----\n');
  // await imageDescriptionDemo();
  // console.log('\n----\n');
  // await pdfParsingDemo();
} catch (error) {
  console.log('Error:');
  spinner.stop();
  console.error(error);
  process.exit(1);
}
