import OpenAI from 'openai';
import { messages } from './messages.ts';
import { CreateChatCompletionRequestMessage } from 'openai/resources/chat/index';
export const getGptReply = async (
  messages: Array<CreateChatCompletionRequestMessage>,
  stream: boolean
) => {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const chat = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: messages,
    max_tokens: 50,
    temperature: 0.35,
    top_p: 0.5,
    frequency_penalty: 1,
    presence_penalty: -1.0,
    stream: stream,
    stop: ['AI', 'fictional', 'fictitious', 'role'],
  });
  return chat;
};
