import { getMediaMsg } from './getMediaMsg.ts';
import { convertToWav } from './convertToWav.ts';
import fs from 'fs';
export const getTwilioReply = async (mp3Base64: string, streamSid: string) => {
  const wavBuffer = await convertToWav(mp3Base64);
  fs.writeFileSync(`./voice/wav/header-${streamSid}.wav`, wavBuffer);
  const wavBufferNoHeader = wavBuffer.subarray(80);
  fs.writeFileSync(`./voice/wav/no-header${streamSid}.wav`, wavBufferNoHeader);
  const wavB64 = wavBufferNoHeader.toString('base64');
  return getMediaMsg(wavB64, streamSid);
};
