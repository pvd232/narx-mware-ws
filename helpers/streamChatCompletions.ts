import { ChatMessage, OpenAIClient } from '@azure/openai';
import { ReadableStream } from 'stream/web';

export const streamChatCompletions = (
  client: OpenAIClient,
  deploymentId: string,
  messages: Array<ChatMessage>,
  options: { [key: string]: any }
) => {
  const events = client.listChatCompletions(deploymentId, messages, options);
  const stream = new ReadableStream({
    async start(controller) {
      for await (const event of events) {
        controller.enqueue(event);
      }
      controller.close();
    },
  });
  return stream;
};
