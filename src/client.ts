import { createTRPCClient, unstable_httpBatchStreamLink } from '@trpc/client';
import { inferRouterInputs } from '@trpc/server';
import type { AppRouter } from './server';

type Inputs = inferRouterInputs<AppRouter>;

// Initialize tRPC client
const client = createTRPCClient<AppRouter>({
  links: [
    unstable_httpBatchStreamLink({
      url: `http://localhost:${process.env['PORT'] || 3000}`,
    }),
  ],
});

const chat = (function () {
  const messages: Inputs['chat']['messages'] = [];

  return {
    async ask(question: string) {
      process.stdout.write(`Asking: ${question}\n`);
      messages.push({ role: 'user', content: question });

      process.stdout.write('... ');
      const res = await client.chat.mutate({
        messages,
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
