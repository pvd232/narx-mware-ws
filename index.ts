import uWS, {
  HttpRequest,
  HttpResponse,
  WebSocket,
  us_listen_socket,
} from 'uWebSockets.js';
import speech from '@google-cloud/speech';
import { protos } from '@google-cloud/speech';
import Pumpify from 'pumpify';
import twilio from 'twilio';
import { stringifyArrayBuffer } from './helpers/stringifyArrayBuffer.ts';
import WebSocketClient from 'ws';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import url from 'url';
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
import { respondWithVoice } from './stream/responseWithVoice.ts';
import { recordConversation } from './stream/recordingConversation.ts';
dotenv.config({ path: findConfig('.env') ?? undefined });

let hostName = '';
const googleSpeechClient = new speech.SpeechClient();
let recognizeStream: Pumpify | null;
let streamSid: string | null;
let stream: MediaStream | null;
let twilioClient: twilio.Twilio;
let callSid: string | null;
let ivrDigits = '';
let fileName = '';
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
    // Confirm twilio message schema
    const date = new Date();
    const dateString = `${date.getMonth()}-${date.getDate()}-${date.getFullYear()}-${date.getHours()}-${callSid}`;
    fileName = `./transcripts/${dateString}`;
    let gptResponseTime = 0;
    const voiceFiles = new Map([
      ["hi, i'm", './voice/intro.wav'],
      ['great, thanks', './voice/great_thanks.wav'],
      ["it's adderall", './voice/what_medication.wav'],
    ]);
    const wordRegExp = /[a-z]/i;

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
                stream = new MediaStream(
                  new WebSocketClient(
                    `wss://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVEN_LABS_VOICE_ID}/stream-input?model_type=${process.env.ELEVEN_LABS_MODEL_ID}`
                  ),
                  new Cargo(ws, streamSid ?? '-1'),
                  fileName
                );
                // Let receiver speak first
                const pharmReply: string =
                  data.results[0].alternatives[0].transcript;

                recordConversation(fileName, 'user', pharmReply);
                let completeResponse = '';
                let startTime = Date.now();
                const gptStream = (await getGptReply(
                  pharmReply,
                  true
                )) as Stream<ChatCompletionChunk>;

                let response = '';
                let sent = false;

                for await (const part of gptStream) {
                  const text = part.choices[0]?.delta?.content || '';
                  completeResponse += text;
                  if (
                    response.split(' ').length < 2 ||
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
                    if (!sent) {
                      gptResponseTime = Date.now() - startTime;
                      sent = true;
                    }
                    // Cached audio responses
                    if (voiceFiles.has(response.toLowerCase())) {
                      stream.isStreaming = false;
                      respondWithVoice(
                        response.toLowerCase(),
                        ws,
                        voiceFiles,
                        streamSid
                      );
                      break;
                    } else {
                      stream.sendXIMessage(response);
                      response = text;
                    }
                  }
                }
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
                  gptResponseTime,
                  stream.latency,
                  () => {
                    if (completeResponse.toLowerCase().includes('goodbye')) {
                      setTimeout(() => {
                        console.log('closing stream');
                        recognizeStream?.destroy();
                        ws.close();
                        return;
                      }, 3000);
                    }
                  }
                );
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
        if (recognizeStream !== null) {
          recognizeStream.write(twilioMediaEvent.media.payload);
        }
        break;
      case MessageEvent.Stop:
        console.log(`Call Has Ended`);
        if (recognizeStream !== null) {
          recognizeStream.destroy();
          recognizeStream = null;
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
