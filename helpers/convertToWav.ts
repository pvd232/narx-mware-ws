import ffmpeg from 'fluent-ffmpeg';
import streamBuffers from 'stream-buffers';
import { Readable } from 'stream';
export const convertToWav = (mp3Base64: string): Promise<Buffer> => {
  console.log('convertToWav');
  return new Promise((resolve, reject) => {
    const bufferStream = new Readable();
    const audioBuffer = Buffer.from(mp3Base64, 'base64');
    bufferStream.push(audioBuffer);
    bufferStream.push(null);

    let wavBuffer = new streamBuffers.WritableStreamBuffer({
      initialSize: audioBuffer.length,
      incrementAmount: audioBuffer.length,
    });
    ffmpeg(bufferStream)
      .format('wav')
      .audioCodec('pcm_mulaw')
      .audioFrequency(8000)
      .outputOptions('-movflags frag_keyframe+empty_moov')
      .on('error', (err, _stdout, stderr) => {
        console.error('Error:', err);
        console.error('ffmpeg stderr:', stderr);
        reject(err);
      })
      .on('end', () => {
        let contents = wavBuffer.getContents();
        resolve(contents ? contents : Buffer.alloc(0));
      })
      .pipe(wavBuffer, { end: true });
  });
};
