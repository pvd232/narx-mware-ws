import OpenAI from 'openai';
import { CreateChatCompletionRequestMessage } from 'openai/resources/chat/index';
export const getGptReply = async (
  messages: Array<CreateChatCompletionRequestMessage>
) => {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const chat = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: messages,
    max_tokens: 50,
    temperature: 0.35,
    top_p: 0.5,
    frequency_penalty: 1,
    presence_penalty: -1.0,
    stream: true,
    stop: ['AI', 'fictional', 'fictitious', 'role'],
  });
  return chat;
};
