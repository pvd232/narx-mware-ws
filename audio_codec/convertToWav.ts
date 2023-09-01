import ffmpeg from 'fluent-ffmpeg';
import streamBuffers from 'stream-buffers';
import { Readable } from 'stream';
export const convertToWav = (mp3Base64: string): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const bufferStream = new Readable();
    const audioBuffer = Buffer.from(mp3Base64, 'base64');
    bufferStream.push(audioBuffer);
    bufferStream.push(null);

    let wavBuffer = new streamBuffers.WritableStreamBuffer({});
    ffmpeg(bufferStream)
      .format('wav')
      .audioCodec('pcm_mulaw')
      .audioFrequency(8000)
      .on('error', reject)
      .on('end', () => {
        let contents = wavBuffer.getContents();
        resolve(contents ? contents : Buffer.alloc(0));
      })
      .pipe(wavBuffer);
  });
};
