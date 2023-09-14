import fs from 'fs';
import { WebSocket } from 'uWebSockets.js';
import { TwilioUserData } from '../types/interface/twilio/TwilioUserData.ts';
import { getMediaMsg } from '../helpers/getMediaMsg.ts';
import { MarkName } from '../types/enums/MarkName.ts';

export const respondWithVoice = async (
  ws: WebSocket<TwilioUserData>,
  fileName: string,
  streamSid: string | null
) => {
  try {
    const data = await fs.promises.readFile(fileName, {
      encoding: 'base64',
    });
    const twilioReply = getMediaMsg(data, streamSid ?? '-1');
    ws.send(JSON.stringify(twilioReply));
    const markMessage = {
      event: 'mark',
      streamSid: streamSid,
      mark: {
        name: MarkName.COMPLETE,
      },
    };
    ws.send(JSON.stringify(markMessage));
    return Date.now();
  } catch (err) {
    console.log('Error reading file:', err);
  }
};
