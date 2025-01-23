import { createTRPCClient, unstable_httpBatchStreamLink } from '@trpc/client';
import type { AppRouter } from './server';

// Initialize tRPC client
const client = createTRPCClient<AppRouter>({
  links: [
    unstable_httpBatchStreamLink({
      url: `http://localhost:${process.env['PORT'] || 3000}`,
    }),
  ],
});

const res = await client.chat.mutate({
  prompt: 'What is the capital of France?',
});

for await (const chunk of res) {
  process.stdout.write(chunk);
}
