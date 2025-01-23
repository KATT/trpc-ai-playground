# AI Playground with Vercel AI SDK

A project following [Matt Pocock's Vercel AI SDK Tutorial](https://www.aihero.dev/structured-data-from-pdfs-with-vercel-ai-sdk?list=vercel-ai-sdk-tutorial), implementing various AI features using tRPC and streaming responses.

![Demo GIF](./demo.gif)

## Key Files

- [src/server.ts](./src/server.ts) - tRPC server with AI procedures
- [src/client.ts](./src/client.ts) - CLI client for testing endpoints
- [src/env.ts](./src/env.ts) - Environment configuration
- `.env` - Environment variables (copy from [.env.example](./.env.example))

## Features

> Note: Not all features may work with every model. Some features like image description require specific model capabilities.

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
```

1. Copy `.env.example` to `.env` and fill in your API keys.
2. Run the server: `pnpm dev:server`
3. Run the client: `pnpm dev:client`

## Available Models

- Claude 3 (Haiku & Sonnet)
- GPT-4 & GPT-3.5 Turbo
- LMStudio (local)
