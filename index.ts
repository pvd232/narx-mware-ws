import uWS, {
  HttpRequest,
  HttpResponse,
  WebSocket,
  us_listen_socket,
} from 'uWebSockets.js';
import { stringifyArrayBuffer } from './stringifyArrayBuffer.ts';
import WebSocketClient from 'ws';

import dotenv from 'dotenv';
import findConfig from 'find-config';
import { XIWebSocketResponse } from './XIWebSocketResponse.ts';
import fs from 'fs';
import { getGptReply } from './getGptReply.ts';
import { convertToWav } from './audio_codec/convertToWav.ts';
import { removeWavHeader } from './audio_codec/removeWavHeader.ts';
import { getTwilioReply } from './audio_codec/getTwilioReply.ts';
import { MediaStream } from './MediaStream.ts';
import { TwilioUserData } from './UserData.ts';
dotenv.config({ path: findConfig('.env') ?? undefined });

const app = uWS.App();

app.ws('/*', {
  // Twilio client opens new connection
  open: async (ws: WebSocket<TwilioUserData>) => {
    const gptReply = (await getGptReply('Hello')) ?? 'Hello';
    new MediaStream(
      ws,
      new WebSocketClient(
        `wss://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVEN_LABS_VOICE_ID}/stream-input?model_type=${process.env.ELEVEN_LABS_MODEL_ID}`
      ),
      gptReply
    );
  },
  message: (
    ws: WebSocket<TwilioUserData>,
    message: ArrayBuffer,
    isBinary: boolean
  ) => {
    /* Ok is false if backpressure was built up, wait for drain */
    console.log('WebSocket message received');
    let ok = ws.send(message, isBinary);
  },
  drain: (ws: WebSocket<unknown>) => {
    console.log('WebSocket backpressure: ' + ws.getBufferedAmount());
  },
  close: (ws: WebSocket<unknown>, code: number, message: ArrayBuffer) => {
    console.log('WebSocket closed');
  },
});
app.get('/', (res: HttpResponse, req: HttpRequest) => {
  res.end('Hello World');
});
app.post('/', (res: HttpResponse, req: HttpRequest) => {
  res.onData((data) => {
    const stringed = stringifyArrayBuffer(data);
    console.log('stringed received', stringed);
  });
  res.write('Great knowing you');
  res.writeStatus('200OK');
  res.end();
});
app.get('/ws_xi', (res: HttpResponse, req: HttpRequest) => {
  res.end('Yippee');
});
app.listen(8080, (listenSocket: false | us_listen_socket) => {
  if (listenSocket) {
    console.log('Listening to port 9001');
  }
});
