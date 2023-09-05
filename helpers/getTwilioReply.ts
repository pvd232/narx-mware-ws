import { getMediaMsg } from './getMediaMsg.ts';
import { convertToWav } from './convertToWav.ts';
import fs from 'fs';
export const getTwilioReply = async (mp3Base64: string, streamSid: string) => {
  const wavBuffer = await convertToWav(mp3Base64);
  const wavBufferNoHeader = wavBuffer.subarray(80);
  const wavB64 = wavBufferNoHeader.toString('base64');
  return getMediaMsg(wavB64, streamSid);
};
