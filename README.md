# AI Playground with Vercel AI SDK

A project following [Matt Pocock's Vercel AI SDK Tutorial](https://www.aihero.dev/structured-data-from-pdfs-with-vercel-ai-sdk?list=vercel-ai-sdk-tutorial), implementing various AI features using a tRPC server and streaming responses to a client.

![Demo GIF](./demo.gif)

- tRPC server with AI procedures using Vercel's AI SDK
- tRPC client for calling AI procedures

## Files

- [`src/server.ts`](./src/server.ts) - tRPC server with AI procedures
- [`src/client.ts`](./src/client.ts) - CLI client for testing endpoints
- [`src/env.ts`](./src/env.ts) - Environment configuration
- `.env` - Environment variables (copy from [.env.example](./.env.example))

## Features

> Note: Not all features may work with every model.

Uncomment the one you want to play with at the bottom of [src/client.ts](./src/client.ts).

- Text generation and streaming
- Structured data extraction (recipes, user data)
- PDF invoice data extraction
- Image description generation
- Sentiment analysis

## Setup

```bash
git clone git@github.com:KATT/trpc-ai-playground.git
cd trpc-ai-playground
pnpm install
cp .env.example .env
```

1. Open `.env` and fill in your API keys.
2. In terminal 1, run the server: `pnpm dev-server`
3. In terminal 2, run the client: `pnpm dev-client`

> [!NOTE]
>
> If you're using Cursor, ensure you use the workspace's version of TypeScript (as Cursor [ships with an old version](https://forum.cursor.com/t/bump-typescript-version-to-5-6/28370) of TypeScript)
>
> `CMD+SHIFT+P` → `TypeScript: Select TypeScript Version` → `Use Workspace Version`

## Available Models

- Claude 3 (Haiku & Sonnet)
- GPT-4 & GPT-3.5 Turbo
- LMStudio (local)
