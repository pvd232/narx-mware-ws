import uWS, {
  HttpRequest,
  HttpResponse,
  WebSocket,
  us_listen_socket,
} from 'uWebSockets.js';
import twilio from 'twilio';
import { stringifyArrayBuffer } from './helpers/stringifyArrayBuffer.ts';
import WebSocketClient from 'ws';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import url from 'url';
import pkg from '@deepgram/sdk';
import findConfig from 'find-config';
import { getGptReply } from './helpers/getGptReply.ts';
import { MediaStream } from './stream/MediaStream.ts';
import { TwilioUserData } from './types/interface/twilio/TwilioUserData.ts';
import { MessageEvent } from './types/enums/MessageEvent.ts';
import { StartEvent } from './types/interface/twilio/event/StartEvent.ts';
import { MediaEvent } from './types/interface/twilio/event/MediaEvent.ts';
import { convertAudio } from './helpers/convertAudio.ts';
import { Cargo } from './stream/Cargo.ts';
import { ChatCompletionChunk } from 'openai/resources/chat/index';
import { Stream } from 'openai/streaming';
// import { respondWithVoice } from './stream/responseWithVoice.ts';
import { recordConversation } from './stream/recordingConversation.ts';
import { LiveTranscription } from '@deepgram/sdk/dist/transcription/liveTranscription';
const { Deepgram } = pkg;
import { messages } from './helpers/messages.ts';
dotenv.config({ path: findConfig('.env') ?? undefined });

let hostName = '';
const deepgramClient = new Deepgram(process.env.DEEPGRAM_API_KEY!);
let deepgramStream: LiveTranscription | null;

let streamSid: string | null;
let stream: MediaStream | null;
let twilioClient: twilio.Twilio;
let callSid: string | null;
let ivrDigits = '';
let fileName = '';
const app = uWS.App();
const date = new Date();
const dateString = `${date.getMonth()}-${date.getDate()}-${date.getFullYear()}-${date.getHours()}-${date.getMinutes()}`;
let isOpen = false;
fileName = `./transcripts/${dateString}`;
const messagesClone = [...messages];
app.ws('/*', {
  // Twilio client opens new connection
  open: async (ws: WebSocket<TwilioUserData>) => {
    // Conditional IVR logic, wait 2 seconds for user to say something
    console.log('New Connection Initiated');
    isOpen = true;
  },
  message: (
    ws: WebSocket<TwilioUserData>,
    message: ArrayBuffer,
    _isBinary: boolean
  ) => {
    // const voiceFiles = new Map([
    //   ["hi, i'm", './voice/intro.wav'],
    //   ['great, thanks', './voice/great_thanks.wav'],
    //   ["it's adderall", './voice/what_medication.wav'],
    // ]);
    const wordRegExp = /[a-z]/i;
    const msg = JSON.parse(stringifyArrayBuffer(message));
    switch (msg.event as MessageEvent) {
      case MessageEvent.Connected:
        console.log('Connected');

        deepgramStream = deepgramClient.transcription
          .live({
            punctuate: true,
            interim_results: false,
            language: 'en-US',
            model: 'nova',
            encoding: 'mulaw',
            sample_rate: 8000,
          })
          .on('error', (e) => console.log('Deepgram transcription error', e))
          .on('transcriptReceived', async (message) => {
            const data = JSON.parse(message);
            switch (data.type) {
              case 'Results':
                // Let receiver speak first
                const pharmReply: string =
                  data.channel.alternatives[0].transcript;
                if (pharmReply !== '') {
                  messages.push({
                    role: 'user',
                    content: pharmReply,
                  });
                  stream = new MediaStream(
                    new WebSocketClient(
                      `wss://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVEN_LABS_VOICE_ID}/stream-input?model_type=${process.env.ELEVEN_LABS_MODEL_ID}&optimize_streaming_latency=4`
                    ),
                    new Cargo(ws, streamSid ?? '-1'),
                    fileName
                  );

                  console.log('pharmReply', pharmReply);
                  recordConversation(fileName, 'user', pharmReply);

                  const gptStream = (await getGptReply(
                    messages,
                    true
                  )) as Stream<ChatCompletionChunk>;

                  let response = '';
                  let completeResponse = '';

                  for await (const part of gptStream) {
                    const text = part.choices[0]?.delta?.content || '';
                    completeResponse += text;
                    if (
                      response.split(' ').length < 1 ||
                      !text.includes(' ') ||
                      !text.match(wordRegExp)
                    ) {
                      response += text;
                      continue;
                    } else if (response.toLowerCase().includes('press')) {
                      const ivrResponse = response.split(' ').slice(-1)[0];
                      stream.isStreaming = false;
                      ivrDigits += ivrResponse;
                      twilioClient.calls(callSid!).update({
                        twiml: `<Response>
                        <Play digits="${ivrDigits}"> </Play>
                        <Connect>
                          <Stream url="wss://${hostName}/"> </Stream>
                        </Connect>
                      </Response>`,
                      });
                      break;
                    } else {
                      // Cached audio responses
                      // if (voiceFiles.has(response.toLowerCase())) {
                      //   stream.isStreaming = false;
                      //   respondWithVoice(
                      //     response.toLowerCase(),
                      //     ws,
                      //     voiceFiles,
                      //     streamSid
                      //   );
                      //   break;
                      // } else {
                      stream.sendXIMessage(response);
                      response = text;
                      continue;
                      // }
                    }
                  }
                  messages.push({
                    role: 'assistant',
                    content: completeResponse,
                  });

                  if (response !== '') {
                    if (response.toLowerCase().includes('press')) {
                      const ivrResponse = response.split(' ').slice(-1)[0];
                      stream.isStreaming = false;
                      ivrDigits += ivrResponse;
                      twilioClient.calls(callSid!).update({
                        twiml: `<Response>
                        <Play digits="${ivrDigits}"> </Play>
                        <Connect>
                          <Stream url="wss://${hostName}/"> </Stream>
                        </Connect>
                      </Response>`,
                      });
                    } else {
                      stream.sendXIMessage(response);
                    }
                  }
                  stream.endStream();
                  recordConversation(
                    fileName,
                    'assistant',
                    completeResponse,
                    () => {
                      if (completeResponse.toLowerCase().includes('goodbye')) {
                        setTimeout(() => {
                          console.log('closing stream');
                          deepgramStream?.send(
                            JSON.stringify({ type: 'CloseStream' })
                          );
                          if (isOpen) {
                            ws.end();
                          }
                          return;
                        }, 5000);
                      }
                    }
                  );
                } else {
                  console.log('Pharm reply empty');
                }
            }
          });

        break;

      case MessageEvent.Start:
        const twilioStartMsg = msg as StartEvent;
        if (twilioStartMsg) {
          streamSid = twilioStartMsg.streamSid;
        }
        console.log(`Starting Media Stream ${msg.streamSid}`);

        break;
      case MessageEvent.Media:
        // Write Media Packets to the recognize stream continuously
        const twilioMediaEvent = msg as MediaEvent;
        if (deepgramStream !== null && deepgramStream.getReadyState() === 1) {
          deepgramStream.send(
            Buffer.from(twilioMediaEvent.media.payload, 'base64')
          );
        }
        break;
      case MessageEvent.Stop:
        console.log(`Call Has Ended`);
        if (deepgramStream !== null) {
          deepgramStream?.send(JSON.stringify({ type: 'CloseStream' }));
        }
        isOpen = false;
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
  const phoneToCall = peter;
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
