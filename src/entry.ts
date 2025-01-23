import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';

const model = anthropic('claude-3-5-haiku-latest');

async function answerMyQuestion(opts: { prompt: string }) {
  const response = streamText({
    model,
    prompt: opts.prompt,
  });
  return response;
}

const res = await answerMyQuestion({ prompt: 'What is the capital of France?' });

for await (const chunk of res.textStream) {
  console.log(chunk);
}
