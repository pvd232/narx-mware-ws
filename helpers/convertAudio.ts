import { getMediaMsg } from './getMediaMsg.ts';
import { convertToWav } from './convertToWav.ts';
import fs from 'fs';
export const convertAudio = async (mp3Base64: string, outputFile: string) => {
  const wavBuffer = await convertToWav(mp3Base64);
  fs.writeFileSync(`./voice/header-${outputFile}`, wavBuffer);

  const wavBufferNoHeader = wavBuffer.subarray(80);
  fs.writeFileSync(`./voice/${outputFile}`, wavBufferNoHeader);
  return;
};
