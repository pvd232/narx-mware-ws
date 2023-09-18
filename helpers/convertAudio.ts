import { convertToWav } from './convertToWav.ts';
import fs from 'fs';
export const convertAudio = async (mp3Base64: string, outputFile: string) => {
  convertToWav(Buffer.from(mp3Base64, 'base64'), (err, wavBuffer) => {
    // add "-header" to outputFile
    const newOutputFile = outputFile.split('.')[0] + '-header.wav';

    fs.writeFileSync(`./voice/${newOutputFile}`, wavBuffer!);

    const wavBufferNoHeader = wavBuffer!.subarray(80);
    fs.writeFileSync(`./voice/${outputFile}`, wavBufferNoHeader);
  });
  return;
};
