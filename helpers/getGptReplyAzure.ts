import { OpenAIClient, AzureKeyCredential, ChatMessage } from '@azure/openai';
import { streamChatCompletions } from './streamChatCompletions.ts';
export const getGptReplyAzure = async (messages: Array<ChatMessage>) => {
  const endpoint: string = process.env['AZURE_OPENAI_ENDPOINT']!;
  const azureApiKey: string = process.env['AZURE_OPENAI_KEY']!;

  const openai = new OpenAIClient(
    endpoint,
    new AzureKeyCredential(azureApiKey)
  );
  const deploymentName = 'narx-gpt-35-turbo';
  const chatOptions = {
    model: 'gpt-3.5-turbo',
    maxTokens: 50,
    temperature: 0.35,
    topP: 0.5,
    frequencyPenalty: 1,
    presencePenalty: -1.0,
    stream: true,
    stop: ['AI', 'fictional', 'fictitious', 'role'],
  };
  const chatStream = streamChatCompletions(
    openai,
    deploymentName,
    messages,
    chatOptions
  );
  return chatStream;
};
