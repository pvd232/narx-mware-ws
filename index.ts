import uWS, {
  HttpRequest,
  HttpResponse,
  WebSocket,
  us_listen_socket,
} from 'uWebSockets.js';
import speech from '@google-cloud/speech';
import { protos } from '@google-cloud/speech';
import Pumpify from 'pumpify';
import * as async from 'async';

import twilio from 'twilio';
import { stringifyArrayBuffer } from './helpers/stringifyArrayBuffer.ts';
import WebSocketClient from 'ws';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import url from 'url';
import findConfig from 'find-config';
import { getGptReply } from './helpers/getGptReply.ts';
import { MediaStream } from './MediaStream.ts';
import { TwilioUserData } from './types/interface/twilio/TwilioUserData.ts';
import { MessageEvent } from './types/enums/MessageEvent.ts';
import { StartEvent } from './types/interface/twilio/event/StartEvent.ts';
import { MediaEvent } from './types/interface/twilio/event/MediaEvent.ts';
import { getTwilioReply } from './helpers/getTwilioReply.ts';
import { convertAudio } from './helpers/convertAudio.ts';
import { getMediaMsg } from './helpers/getMediaMsg.ts';
import { Cargo } from './Cargo.ts';
dotenv.config({ path: findConfig('.env') ?? undefined });

const app = uWS.App();
const googleSpeechClient = new speech.SpeechClient();
let recognizeStream: Pumpify | undefined;
let streamSid: string | undefined;
let stream: MediaStream | undefined;
app.ws('/*', {
  // Twilio client opens new connection
  open: async (ws: WebSocket<TwilioUserData>) => {
    // Conditional IVR logic, wait 2 seconds for user to say something
    console.log('New Connection Initiated');
  },
  message: (
    ws: WebSocket<TwilioUserData>,
    message: ArrayBuffer,
    _isBinary: boolean
  ) => {
    // Confirm twilio message schema

    const msg = JSON.parse(stringifyArrayBuffer(message));
    switch (msg.event as MessageEvent) {
      case MessageEvent.Connected:
        console.log('Connected');
        const googleSpeechRequest = {
          config: {
            encoding: 'MULAW',
            sampleRateHertz: 8000,
            languageCode: 'en-US',
          },
          interimResults: false,
          voice_activity_timeout: {
            speech_end_timeout: 100,
          },
        } as protos.google.cloud.speech.v1p1beta1.IStreamingRecognitionConfig;
        recognizeStream = googleSpeechClient
          .streamingRecognize(googleSpeechRequest)
          .on('error', (e) => console.log('Google Speech to Text Error', e))
          .on('data', async (data) => {
            switch (data.speechEventType) {
              case 'SPEECH_EVENT_UNSPECIFIED':
                // Let receiver speak first
                const pharmReply: string =
                  data.results[0].alternatives[0].transcript;
                console.log('pharmReply', pharmReply);
                // Conditionally return cached audio
                // const gptReply = "Hi, I'm calling from a doctor's office to see if you have 20 milligram instant release adderall in stock? I would really like to get my adderall so if you could check that would be great."
                const gptReply = (await getGptReply(pharmReply)) ?? 'Hello';
                console.log('gptReply', gptReply);

                if (gptReply.toLowerCase() === 'great, thanks.') {
                  const audioToSend = fs.readFileSync(
                    './voice/great_thanks.wav'
                  );
                  const base64Audio = audioToSend.toString('base64');
                  const twilioReply = getMediaMsg(
                    base64Audio,
                    streamSid ?? '-1'
                  );
                  ws.send(JSON.stringify(twilioReply));
                } else if (
                  gptReply.toLowerCase() ===
                  "hi, i'm calling from a doctor's office to see if you have 20 milligram instant release adderall in stock?"
                ) {
                  const audioToSend = fs.readFileSync('./voice/intro.wav');
                  const base64Audio = audioToSend.toString('base64');
                  const twilioReply = getMediaMsg(
                    base64Audio,
                    streamSid ?? '-1'
                  );

                  ws.send(JSON.stringify(twilioReply));
                } else if (
                  gptReply
                    .toLowerCase()
                    .includes("it's 20 milligram instant release adderall")
                ) {
                  const audioToSend = fs.readFileSync(
                    './voice/what_medication.wav'
                  );
                  const base64Audio = audioToSend.toString('base64');
                  const twilioReply = getMediaMsg(
                    base64Audio,
                    streamSid ?? '-1'
                  );

                  ws.send(JSON.stringify(twilioReply));
                } else {
                  stream = new MediaStream(
                    new WebSocketClient(
                      `wss://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVEN_LABS_VOICE_ID}/stream-input?model_type=${process.env.ELEVEN_LABS_MODEL_ID}`
                    ),
                    gptReply,
                    new Cargo(ws, streamSid ?? '-1')
                  );
                }
            }
          });

        break;

      case MessageEvent.Start:
        console.log(`Starting Media Stream ${msg.streamSid}`);
        const twilioStartMsg = msg as StartEvent;

        if (twilioStartMsg) {
          streamSid = twilioStartMsg.streamSid;
        }
        break;
      case MessageEvent.Media:
        // Write Media Packets to the recognize stream continuously
        const twilioMediaEvent = msg as MediaEvent;
        if (recognizeStream !== undefined) {
          recognizeStream.write(twilioMediaEvent.media.payload);
        }
        break;
      case MessageEvent.Stop:
        console.log(`Call Has Ended`);
        if (recognizeStream !== undefined) {
          recognizeStream.destroy();
        }
        break;
    }
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
app.get('/convert_audio', (res: HttpResponse, req: HttpRequest) => {
  // read file from ./audio.mp3
  const mp3File = req.getHeader('mp3-file');
  const outputFile = req.getHeader('output-file');
  const dirname = path.dirname(url.fileURLToPath(new URL(import.meta.url)));
  const filePath = path.join(dirname, './voice', mp3File);
  fs.readFile(filePath, (err, data) => {
    const base64Mp3 = data.toString('base64');
    // write file~
    convertAudio(base64Mp3, outputFile);
  });
  res.end('Converted');
  // convert to wav
});
app.post('/', (res: HttpResponse, req: HttpRequest) => {
  res.writeHeader('Content-Type', 'text/xml');
  res.end(`
    <Response>
      <Connect>
        <Stream url="wss://${req.getHeader('host')}/"/>
      </Connect>
    </Response>
  `);
});

app.get('/outbound_call', async (res: HttpResponse, _req: HttpRequest) => {
  const peter = '+15126456898';
  const blaise = '+17132565720';
  const mom = '+15125731975';
  const nimi = '+16363685761';
  const maheep = '+12102138521';
  const phoneToCall = peter;
  const voiceUrl = process.env.VOICE_URL;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  const client = twilio(accountSid, authToken);
  /* Can't return or yield from here without responding or attaching an abort handler */
  res.onAborted(() => {
    res.aborted = true;
  });

  /* Awaiting will yield and effectively return to C++, so you need to have called onAborted */
  await client
    .incomingPhoneNumbers('PN62be7bf578ccd82b025fe80d103f1cd3')
    .update({ voiceUrl: voiceUrl });
  await client.calls.create({
    url: voiceUrl,
    to: phoneToCall,
    from: '+18883422703',
  });
  /* If we were aborted, you cannot respond */
  if (!res.aborted) {
    res.cork(() => {
      res.end('Call completed');
    });
  }
});

app.listen(8080, (listenSocket: false | us_listen_socket) => {
  if (listenSocket) {
    console.log('Listening to port 8080');
  }
});
