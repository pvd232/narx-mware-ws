import fs from 'fs';
import { WebSocket } from 'uWebSockets.js';
import { TwilioUserData } from './types/interface/twilio/TwilioUserData.ts';
import { getMediaMsg } from './helpers/getMediaMsg.ts';

export const respondWithVoice = async (
  message: string,
  ws: WebSocket<TwilioUserData>,
  voiceFiles: Map<String, string>,
  streamSid: string | undefined
) => {
  try {
    const data = await fs.promises.readFile(voiceFiles.get(message)!, {
      encoding: 'base64',
    });
    const twilioReply = getMediaMsg(data, streamSid ?? '-1');
    ws.send(JSON.stringify(twilioReply));
  } catch (err) {
    console.log('Error reading file:', err);
  }
};
