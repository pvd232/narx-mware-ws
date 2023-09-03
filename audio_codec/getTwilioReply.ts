import { getMediaMsg } from '../getMediaMsg.ts';
import { arrayBufferToBase64 } from './arrayBufferToBase64.ts';
import { convertToWav } from './convertToWav.ts';
import { removeWavHeader } from './removeWavHeader.ts';
export const getTwilioReply = async (mp3Base64: string, streamSid: string) => {
  const wavBuffer = await convertToWav(mp3Base64);
  const wavArrayBuffer = new Uint8Array(wavBuffer).buffer;
  const wavBufferNoHeader = removeWavHeader(wavArrayBuffer, 80);
  const wavB64 = arrayBufferToBase64(wavBufferNoHeader);
  return getMediaMsg(wavB64, streamSid);
};
