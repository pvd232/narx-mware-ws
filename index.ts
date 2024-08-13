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
import { recordConversation } from './stream/recordConversation.ts';
import { messages } from './config/messages.ts';
import { Stream } from './stream/Stream.ts';
import { deepgramConfig } from './config/deepgramConfig.ts';
import { StreamingStatus } from './types/enums/StreamingStatus.ts';
import { getTranscriptFileName } from './helpers/getTranscriptFileName.ts';
import { MarkEvent } from './types/interface/twilio/event/MarkEvent.ts';
import { MarkName } from './types/enums/MarkName.ts';
import { XIStream } from './stream/XIStream.ts';
import { StreamService } from './types/interface/twilio/event/StreamService.ts';
import { StopEvent } from './types/interface/twilio/event/StopEvent.ts';
const { Deepgram } = pkg;

dotenv.config({ path: findConfig('.env') ?? undefined });

let twilioClient: Twilio;
let phoneToCall = '';
let hostName = '';
let callSid = '';
let responseTime = 0;
const fileName = getTranscriptFileName();

const app = uWS.App();
const streamService = new StreamService();
app.ws('/*', {
  // Twilio client opens new connection
  open: async (ws: WebSocket<TwilioUserData>) => {
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
        const newStream = new Stream(
          ws,
          new Deepgram(process.env.DEEPGRAM_API_KEY!).transcription.live(
            deepgramConfig
          ),
          new XIStream(
            new WebSocketClient(
              `wss://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVEN_LABS_VOICE_ID}/stream-input?model_type=${process.env.ELEVEN_LABS_MODEL_ID}&optimize_streaming_latency=4`
            ),
            new Cargo(ws, twilioStartMsg.streamSid)
          ),
          messages,
          callSid,
          twilioStartMsg.streamSid,
          fileName
        );
        streamService.add(newStream);
        break;
      case MessageEvent.Media:
        // Write Media Packets to the recognize stream continuously
        const twilioMediaEvent = msg as MediaEvent;
        streamService
          .get(twilioMediaEvent.streamSid)!
          .handleMessageFromTwilio(twilioMediaEvent.media.payload);
        break;
      case MessageEvent.Mark:
        const twilioMarkEvent = msg as MarkEvent;
        console.log('Mark');

        if (twilioMarkEvent.mark.name === MarkName.COMPLETE) {
          if (responseTime === 0) {
            responseTime = 1;
            streamService.get(twilioMarkEvent.streamSid)!.recordGPTTime();
          }
          console.log('Mark Complete');

          streamService.get(twilioMarkEvent.streamSid)!.streamingStatus =
            StreamingStatus.PHARM;
        } else if (twilioMarkEvent.mark.name === MarkName.TERMINATE) {
          console.log('Mark Terminate');
          setTimeout(
            () =>
              streamService.get(twilioMarkEvent.streamSid)!.closeConnection(),
            5000
          );
        }
        break;
      case MessageEvent.Stop:
        console.log(`Call Has Ended`);
        const twilioStopMsg = msg as StopEvent;
        streamService.get(twilioStopMsg.streamSid)!.closeConnection();
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
  const otherHostName = req.getHeader('x-forwarded-host') ?? '';
  console.log('otherHostName', otherHostName);
  console.log('hostName', hostName);
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
  const apotheco = '+12128890022';
  const naturesCure = '+12125459393';
  const avenueChemists = '+17185451010';
  const kissenaDrugs = '+17187937658';
  const davidsPharmacy = '+12124777788';
  const northSide = '+17183876566';
  const central = '+19293970331';
  const omm = '+17185004928';
  const santaMaria = '+17183880745';
  const southside = '+17187827200';
  const saiApteak = '+17183498989';
  const cityChemist = '+17183870124';
  const kings = '+17182303535';
  phoneToCall = nimi;

  twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
  /* Can't return or yield from here without responding or attaching an abort handler */
  res.onAborted(() => {
    res.aborted = true;
  });

  /* Awaiting will yield and effectively return to C++, so you need to have called onAborted */
  await twilioClient
    .incomingPhoneNumbers('PN62be7bf578ccd82b025fe80d103f1cd3')
    .update({ voiceUrl: process.env.VOICE_URL });
  const call = await twilioClient.calls.create({
    url: process.env.VOICE_URL,
    to: phoneToCall,
    from: '+18883422703',
    record: true,
    statusCallback: `${process.env.VOICE_URL}/record`,
  });
  callSid = call.sid;
  /* If we were aborted, you cannot respond */
  if (!res.aborted) {
    res.cork(() => {
      res.end('Call completed');
    });
  }
});
app.post('/terminate_call', async (res: HttpResponse, req: HttpRequest) => {
  streamService.get(req.getHeader('call_sid'))?.closeConnection();
  res.end('Call terminated');
});
app.post('/record', async (res: HttpResponse, req: HttpRequest) => {
  res.onAborted(() => {
    res.aborted = true;
  });
  res.onData((data) => {
    const encodedData = stringifyArrayBuffer(data);
    const recordingUrl = encodedData.split('RecordingUrl=')[1]?.split('&')[0];
    const decodedRecordingUrl = decodeURIComponent(recordingUrl);
    recordConversation(
      fileName,
      'admin',
      decodedRecordingUrl,
      null,
      phoneToCall
    );
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
