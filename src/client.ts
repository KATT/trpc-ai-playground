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

const messages: Inputs['chat']['messages'] = [];

{
  messages.push({ role: 'user', content: 'What is the capital of France?' });

  const res = await client.chat.mutate({
    messages,
  });

  let allChunks: string[] = [];
  for await (const chunk of res) {
    process.stdout.write(chunk);
    allChunks.push(chunk);
  }
  process.stdout.write('\n\n');

  messages.push({ role: 'assistant', content: allChunks.join('') });
}

{
  messages.push({ role: 'user', content: 'What is the capital of the UK?' });

  const res = await client.chat.mutate({
    messages,
  });

  let allChunks: string[] = [];
  for await (const chunk of res) {
    process.stdout.write(chunk);
    allChunks.push(chunk);
  }

  process.stdout.write('\n\n');
  messages.push({ role: 'assistant', content: allChunks.join('') });
}

console.log({ messages });
