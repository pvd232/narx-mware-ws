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
dotenv.config({ path: findConfig('.env') ?? undefined });

const app = uWS.App();
app.ws('/*', {
  // Client opens new connection
  open: (_ws: WebSocket<unknown>) => {
    let startTime: Date;
    console.log('WebSocket connected');
    const voiceId = '21m00Tcm4TlvDq8ikWAM';
    const model = 'eleven_monolingual_v1';
    const wsClient = new WebSocketClient(
      `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_type=${model}`
    )
      .on('open', async function open() {
        console.log('WebSocket connected to eleven labs');
        startTime = new Date();

        const gptReply = await getGptReply(
          "no we don't have it. it's on back order?"
        );
        const gptReplyDuration = new Date().getTime() - startTime.getTime();
        console.log('gptReplyDuration', gptReplyDuration);

        const formattedGptReply = gptReply + ' ';
        const streamInit = {
          text: ' ',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
          generation_config: {
            chunk_length_schedule: [120, 160, 250, 290],
          },
          xi_api_key: process.env.ELEVEN_LABS_API_KEY,
        };
        wsClient.send(JSON.stringify(streamInit));
        const textMessage = {
          text: formattedGptReply,
          try_trigger_generation: true,
        };

        wsClient.send(JSON.stringify(textMessage));

        // 4. Send the EOS message with an empty string
        const eosMessage = {
          text: '',
        };

        wsClient.send(JSON.stringify(eosMessage));
      })
      .on('message', async function message(data: string) {
        let response: XIWebSocketResponse = JSON.parse(data);
        if (response.audio) {
          const twilioReply = getTwilioReply(response.audio, '1234');

          // Send the audio to Twilio
        } else {
          console.log('No audio data in the response');
          console.log('response', response);
        }
        if (response.isFinal) {
          console.log('Generation is complete');
          const endTime = new Date();
          const duration = endTime.getTime() - startTime.getTime();
          console.log('duration', duration);
          // the generation is complete
        }
        if (response.normalizedAlignment) {
          console.log('Alignment info is available');
          // use the alignment info if needed
        }
      })
      .on('error', console.error)
      .on('close', function (data: string) {
        const event = JSON.parse(data);
        console.log('event', event);
        if (event.wasClean) {
          console.info(
            `Connection closed cleanly, code=${event.code}, reason=${event.reason}`
          );
        } else {
          console.warn('Connection died');
        }
      });
  },
  message: (
    ws: WebSocket<unknown>,
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
