import uWS, {
  HttpRequest,
  HttpResponse,
  WebSocket,
  us_listen_socket,
} from 'uWebSockets.js';
import twilio, { Twilio } from 'twilio';
import { stringifyArrayBuffer } from './helpers/stringifyArrayBuffer.ts';
import WebSocketClient from 'ws';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import url from 'url';
import pkg from '@deepgram/sdk';
import findConfig from 'find-config';
import { TwilioUserData } from './types/interface/twilio/TwilioUserData.ts';
import { MessageEvent } from './types/enums/MessageEvent.ts';
import { StartEvent } from './types/interface/twilio/event/StartEvent.ts';
import { MediaEvent } from './types/interface/twilio/event/MediaEvent.ts';
import { convertAudio } from './helpers/convertAudio.ts';
import { Cargo } from './stream/Cargo.ts';
// import { respondWithVoice } from './stream/responseWithVoice.ts';
import { recordConversation } from './stream/recordingConversation.ts';
import { messages } from './config/messages.ts';
import { TwilioStream } from './stream/TwilioStream.ts';
import { deepgramConfig } from './config/deepgramConfig.ts';
import { StreamingStatus } from './types/enums/StreamingStatus.ts';
import { getTranscriptFileName } from './getTranscriptFileName.ts';
import { MarkEvent } from './types/interface/twilio/event/MarkEvent.ts';
import { MarkName } from './types/enums/MarkName.ts';
import { XIStream } from './stream/XIStream.ts';
const { Deepgram } = pkg;

dotenv.config({ path: findConfig('.env') ?? undefined });

const deepgramClient = new Deepgram(process.env.DEEPGRAM_API_KEY!);
let twilioStream: TwilioStream;
let twilioClient: Twilio;

let hostName = '';
let callSid = '';
const fileName = getTranscriptFileName();

const app = uWS.App();

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
    const msg = JSON.parse(stringifyArrayBuffer(message));
    switch (msg.event as MessageEvent) {
      case MessageEvent.Connected:
        console.log('Connected');
        break;

      case MessageEvent.Start:
        console.log(`Starting Media Stream ${msg.streamSid}`);

        const twilioStartMsg = msg as StartEvent;
        twilioStream = new TwilioStream(
          twilioClient!,
          ws,
          deepgramClient.transcription.live(deepgramConfig),
          new XIStream(
            new WebSocketClient(
              `wss://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVEN_LABS_VOICE_ID}/stream-input?model_type=${process.env.ELEVEN_LABS_MODEL_ID}&optimize_streaming_latency=4`
            ),
            new Cargo(ws, twilioStartMsg.streamSid)
          ),
          messages,
          hostName,
          callSid,
          fileName
        );
        break;
      case MessageEvent.Media:
        // Write Media Packets to the recognize stream continuously
        const twilioMediaEvent = msg as MediaEvent;
        twilioStream.handleMessageFromTwilio(twilioMediaEvent.media.payload);
        break;
      case MessageEvent.Mark:
        const twilioMarkEvent = msg as MarkEvent;
        console.log('twilioMarkEvent', twilioMarkEvent);
        console.log('Mark');
        if (twilioMarkEvent.mark.name === MarkName.COMPLETE) {
          console.log('Mark Complete');
          twilioStream.streamingStatus = StreamingStatus.PHARM;
        } else if (twilioMarkEvent.mark.name === MarkName.TERMINATE) {
          console.log('Mark Terminate');
          setTimeout(() => twilioStream.closeConnection(), 5000);
        }
        break;
      case MessageEvent.Stop:
        console.log(`Call Has Ended`);
        twilioStream.closeConnection();
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
  const mp3File = req.getHeader('mp3-file');
  const outputFile = req.getHeader('output-file');
  const dirname = path.dirname(url.fileURLToPath(new URL(import.meta.url)));
  const filePath = path.join(dirname, './voice', mp3File);
  fs.readFile(filePath, (err, data) => {
    const base64Mp3 = data.toString('base64');
    // Write audio file
    convertAudio(base64Mp3, outputFile);
  });
  res.end('Converted');
  // convert to wav
});
app.post('/', (res: HttpResponse, req: HttpRequest) => {
  hostName = req.getHeader('host') ?? '';
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
  const cvs1 = '+16464165752';
  const LICChemists = '+17183928049';
  const windsor = '+12122471538';
  const arrow = '+12122458469';
  const jHeights = '+17187791444';
  const esco = '+12122468169';
  const phoneToCall = esco;
  const voiceUrl = process.env.VOICE_URL;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  twilioClient = twilio(accountSid, authToken);
  /* Can't return or yield from here without responding or attaching an abort handler */
  res.onAborted(() => {
    res.aborted = true;
  });

  /* Awaiting will yield and effectively return to C++, so you need to have called onAborted */
  await twilioClient
    .incomingPhoneNumbers('PN62be7bf578ccd82b025fe80d103f1cd3')
    .update({ voiceUrl: voiceUrl });
  const call = await twilioClient.calls.create({
    url: voiceUrl,
    to: phoneToCall,
    from: '+18883422703',
    record: true,
    statusCallback: `${voiceUrl}/record`,
  });
  callSid = call.sid;
  /* If we were aborted, you cannot respond */
  if (!res.aborted) {
    res.cork(() => {
      res.end('Call completed');
    });
  }
});
app.post('/record', async (res: HttpResponse, req: HttpRequest) => {
  res.onAborted(() => {
    res.aborted = true;
  });
  res.onData((data) => {
    const encodedData = stringifyArrayBuffer(data);
    const recordingUrl = encodedData.split('RecordingUrl=')[1].split('&')[0];
    const decodedRecordingUrl = decodeURIComponent(recordingUrl);
    recordConversation(fileName, 'admin', decodedRecordingUrl);
  });
  if (!res.aborted) {
    res.cork(() => {
      res.end('Call recorded');
    });
  }
});
app.listen(8080, (listenSocket: false | us_listen_socket) => {
  if (listenSocket) {
    console.log('Listening to port 8080');
  }
});
