import { getMediaMsg } from '../getMediaMsg.ts';
import { arrayBufferToBase64 } from './arrayBufferToBase64.ts';
import { convertToWav } from './convertToWav.ts';
import { removeWavHeader } from './removeWavHeader.ts';

export const getTwilioReply = async (xiAudio: string, streamSid: string) => {
  const wavBuffer = await convertToWav(xiAudio);
  const wavArrayBuffer = new Uint8Array(wavBuffer).buffer;
  const wavBufferNoHeader = removeWavHeader(wavArrayBuffer, 76);
  const wavB64 = arrayBufferToBase64(wavBufferNoHeader);
  return getMediaMsg(wavB64, streamSid);
};
