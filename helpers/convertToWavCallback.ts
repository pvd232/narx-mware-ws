import ffmpeg from 'fluent-ffmpeg';
import streamBuffers from 'stream-buffers';
import { Readable } from 'stream';

export const convertToWavCallback = (
  mp3Buffer: Buffer,
  callback: (err: Error | null, buffer: Buffer | null) => void
): void => {
  const bufferStream = new Readable();
  if (mp3Buffer.length === 0 || mp3Buffer === null) {
    callback(null, null);
    console.log('mp3Buffer fucked');
    return;
  }
  bufferStream.push(mp3Buffer);
  bufferStream.push(null);

  let wavBuffer = new streamBuffers.WritableStreamBuffer({
    initialSize: mp3Buffer.length,
  });

  ffmpeg(bufferStream)
    .toFormat('wav')
    .audioCodec('pcm_mulaw')
    .audioFrequency(8000)
    .outputOptions('-movflags frag_keyframe+empty_moov')
    .on('error', (err, _stdout, stderr) => {
      console.error('Error:', err);
      console.error('ffmpeg stderr:', stderr);
      callback(err, null);
    })
    .on('end', () => {
      let contents = wavBuffer.getContents();
      callback(null, contents ? contents : Buffer.alloc(0));
    })
    .pipe(wavBuffer, { end: true });
};
