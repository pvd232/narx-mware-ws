import { WebSocket } from 'uWebSockets.js';
import { TwilioUserData } from './types/interface/twilio/TwilioUserData';
import { LiveTranscription } from '@deepgram/sdk/dist/transcription/liveTranscription';
import { XIStream } from './stream/XIStream.ts';
import {
  ChatCompletionChunk,
  ChatCompletionMessage,
} from 'openai/resources/chat';
import { recordConversation } from './stream/recordingConversation.ts';
import { getGptReply } from './helpers/getGptReply.ts';
import { Stream } from 'openai/streaming';
import { Twilio } from 'twilio';
import { StreamingStatus } from './types/enums/StreamingStatus.ts';

export class TwilioStream {
  private twilioClient: Twilio;
  private twilioWSConnection: WebSocket<TwilioUserData>;

  private deepgramStream: LiveTranscription;
  private xiStream: XIStream;
  public streamingStatus: StreamingStatus = StreamingStatus.PHARM;
  private messages: ChatCompletionMessage[] = [];
  private hostName: string;
  private callSid: string;
  private fileName: string;
  private regExpresion = new RegExp(/[a-z]/i);

  constructor(
    twilioClient: Twilio,
    twilioWSConnection: WebSocket<TwilioUserData>,
    deepgramStream: LiveTranscription,
    xiStream: XIStream,
    messages: ChatCompletionMessage[],
    hostName: string,
    callSid: string,
    fileName: string
  ) {
    this.twilioClient = twilioClient;
    this.twilioWSConnection = twilioWSConnection;
    this.deepgramStream = deepgramStream;
    this.deepgramStream.on('open', this.prepareWebsockets.bind(this));

    this.xiStream = xiStream;
    this.messages = messages;
    this.hostName = hostName;
    this.callSid = callSid;
    this.fileName = fileName;
  }
  private prepareWebsockets() {
    console.log('Deepgram WebSocket client connected');
    this.deepgramStream.on('error', (e) =>
      console.log('Deepgram transcription error', e)
    );
    this.deepgramStream.on(
      'transcriptReceived',
      this.handleMessageFromDeepgram.bind(this)
    );
    this.deepgramStream.on('close', () =>
      console.log('Deepgram transcription closed')
    );
  }
  private async handleMessageFromDeepgram(message: string) {
    console.log('message', message);

    const data = JSON.parse(message);
    switch (data.type) {
      case 'Results':
        const pharmReply: string = data.channel.alternatives[0].transcript;
        if (pharmReply !== '') {
          this.streamingStatus = StreamingStatus.GPT;
          this.xiStream.reinitializeConnection();

          this.messages.push({
            role: 'user',
            content: pharmReply,
          });

          console.log('pharmReply', pharmReply);
          recordConversation(this.fileName, 'user', pharmReply);

          const gptStream: Stream<ChatCompletionChunk> = await getGptReply(
            this.messages
          );

          let response = '';
          let completeResponse = '';

          for await (const part of gptStream) {
            const text = part.choices[0]?.delta?.content || '';
            completeResponse += text;
            if (response.toLowerCase().includes('press') && text !== '') {
              // this.xiStream.endStream();

              const ivrResponse = text;
              console.log('ivrResponse', ivrResponse);
              this.twilioClient.calls(this.callSid!).update({
                twiml: `<Response>
                        <Play digits="${ivrResponse}"> </Play>
                        <Connect>
                          <Stream url="wss://${this.hostName}/"> </Stream>
                        </Connect>
                      </Response>`,
              });
              break;
            } else if (
              response.split(' ').length < 1 ||
              !text.includes(' ') ||
              !text.match(this.regExpresion)
            ) {
              response += text;
              continue;
            } else {
              this.xiStream.sendXIMessage(response);
              response = text;
              continue;
            }
          }

          this.messages.push({
            role: 'assistant',
            content: completeResponse,
          });

          if (response !== '') {
            this.xiStream.sendXIMessage(response);
          }
          this.xiStream.endStream();

          recordConversation(
            this.fileName,
            'assistant',
            completeResponse,
            () => {
              if (completeResponse.toLowerCase().includes('goodbye')) {
                setTimeout(() => {
                  this.closeConnection();
                  return;
                }, 5000);
              }
            }
          );
        } else {
          console.log('Pharm reply empty');
        }
    }
  }
  public handleMessageFromTwilio(message: string) {
    if (
      this.streamingStatus === StreamingStatus.PHARM &&
      this.deepgramStream.getReadyState() === 1
    ) {
      this.deepgramStream.send(Buffer.from(message, 'base64'));
    }
  }
  public closeConnection() {
    this.deepgramStream.send(JSON.stringify({ type: 'CloseStream' }));
    this.xiStream.endStream();
    if (this.streamingStatus !== StreamingStatus.CLOSED) {
      this.streamingStatus = StreamingStatus.CLOSED;
      this.twilioWSConnection.end();
    }
  }
}
