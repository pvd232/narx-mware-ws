import { spawn } from 'child_process';
import streamBuffers from 'stream-buffers';

export const convertToWav = (
  mp3Buffer: Buffer,
  callback: (err: Error | null, buffer: Buffer | null) => void
): void => {
  const bufferStream = new streamBuffers.ReadableStreamBuffer({
    initialSize: mp3Buffer.length,
  });
  bufferStream.put(mp3Buffer);
  bufferStream.stop();

  let wavBuffer = new streamBuffers.WritableStreamBuffer({
    initialSize: mp3Buffer.length,
  });

  const ffmpeg = spawn('ffmpeg', [
    '-i',
    'pipe:0',
    '-filter:a',
    'atempo=0.85',
    '-f',
    'wav',
    '-acodec',
    'pcm_mulaw',
    '-ar',
    '8000',
    '-movflags',
    'frag_keyframe+empty_moov',
    'pipe:1',
  ]);

  ffmpeg.stdout.pipe(wavBuffer);

  ffmpeg.on('close', (_code) => {
    let contents = wavBuffer.getContents();
    callback(null, contents ? contents : Buffer.alloc(0));
  });

  ffmpeg.on('error', (err) => {
    console.error('Error:', err);
    callback(err, null);
  });

  bufferStream.pipe(ffmpeg.stdin);
};
