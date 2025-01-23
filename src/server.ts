import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { initTRPC } from '@trpc/server';
import { env } from './env';

// Initialize tRPC
const t = initTRPC.create();

// Create router and procedure helpers
const router = t.router;
const publicProcedure = t.procedure;

// Define routes
const appRouter = router({
  hello: publicProcedure.query(() => {
    return { message: 'Hello from tRPC!' };
  }),
});

// Export type definition of API
export type AppRouter = typeof appRouter;

// Create standalone server
const server = createHTTPServer({
  router: appRouter,
});

// Start server
const port = env.PORT;
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
