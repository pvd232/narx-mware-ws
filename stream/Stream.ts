import { WebSocket } from 'uWebSockets.js';
import { TwilioUserData } from '../types/interface/twilio/TwilioUserData.ts';
import { LiveTranscription } from '@deepgram/sdk/dist/transcription/liveTranscription';
import { XIStream } from './XIStream.ts';
import { ChatCompletionMessage } from 'openai/resources/chat';
import { recordConversation } from './recordConversation.ts';
import { Twilio } from 'twilio';
import { StreamingStatus } from '../types/enums/StreamingStatus.ts';
import { isNumber } from '../utils/isNumber.ts';
import { getGptReplyAzure } from '../helpers/getGptReplyAzure.ts';
import { detectIVR } from '../helpers/detectIVR.ts';
import { respondWithVoice } from './responseWithVoice.ts';
import { getRandomCacheFile } from './getRandomCacheFile.ts';

export class Stream {
  private twilioClient: Twilio;
  private twilioWSConnection: WebSocket<TwilioUserData>;

  private deepgramStream: LiveTranscription;
  private xiStream: XIStream;
  public streamingStatus: StreamingStatus = StreamingStatus.PHARM;
  private messages: ChatCompletionMessage[] = [];
  private hostName: string;
  public callSid: string;
  public streamSid: string;
  private fileName: string;
  private regExpresion = new RegExp(/[a-z]/i);
  private isFirstMessage = true;
  private responseTime = 0;
  private receivedTime = 0;
  private numberLookup = new Map([
    ['zero', 0],
    ['one', 1],
    ['two', 2],
    ['three', 3],
    ['four', 4],
    ['five', 5],
    ['six', 6],
    ['seven', 7],
    ['eight', 8],
    ['nine', 9],
  ]);

  constructor(
    twilioClient: Twilio,
    twilioWSConnection: WebSocket<TwilioUserData>,
    deepgramStream: LiveTranscription,
    xiStream: XIStream,
    messages: ChatCompletionMessage[],
    hostName: string,
    callSid: string,
    streamSid: string,
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
    this.streamSid = streamSid;
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
    const data = JSON.parse(message);
    switch (data.type) {
      case 'Results':
        const pharmReply: string = data.channel.alternatives[0].transcript;
        if (
          pharmReply !== '' &&
          this.streamingStatus !== StreamingStatus.CLOSED
        ) {
          this.xiStream.reinitializeConnection();
          if (this.isFirstMessage) {
            this.responseTime = Date.now();
            this.isFirstMessage = false;
            if (detectIVR(pharmReply)) {
              this.streamingStatus = StreamingStatus.IVR;
            } else {
              this.streamingStatus = StreamingStatus.GPT;
              this.messages.push({
                role: 'user',
                content: 'hello',
              });
            }
          } else {
            if (this.streamingStatus !== StreamingStatus.IVR) {
              this.streamingStatus = StreamingStatus.GPT;
            }
            this.messages.push({
              role: 'user',
              content: pharmReply,
            });
          }
          console.log('pharmReply', pharmReply);
          recordConversation(this.fileName, 'user', pharmReply);

          const gptStream = await (async () => {
            if (this.streamingStatus === StreamingStatus.IVR) {
              const chat = await getGptReplyAzure(this.messages, 'gpt-4');
              return chat;
            } else {
              const chat = await getGptReplyAzure(
                this.messages,
                'gpt-3.5-turbo'
              );
              return chat;
            }
          })();
          // const gptStream = await getGptReplyAzure(this.messages, 'gpt-4');
          let response = '';
          let completeResponse = '';

          for await (const part of gptStream) {
            const text: string = part.choices[0]?.delta?.content || '';
            // For IVR handling response will be empty
            if (text !== '') {
              completeResponse += text;
              if (
                response.split(' ').length < 1 ||
                !text.includes(' ') ||
                !text.match(this.regExpresion)
              ) {
                response += text;
              } else {
                this.xiStream.sendXIMessage(response);
                response = text;
              }
            }
          }
          if (response !== '') {
            this.xiStream.sendXIMessage(response);
          }
          this.xiStream.endStream();

          this.messages.push({
            role: 'assistant',
            content: completeResponse,
          });
          recordConversation(
            this.fileName,
            'assistant',
            completeResponse,
            null,
            null,
            () => {
              console.log('Recording complete');
            }
          );
        } else {
          console.log('Pharm reply empty');
        }
    }
  }
  public handleMessageFromTwilio(message: string) {
    if (
      (this.streamingStatus === StreamingStatus.PHARM ||
        this.streamingStatus === StreamingStatus.IVR) &&
      this.deepgramStream.getReadyState() === 1
    ) {
      this.deepgramStream.send(Buffer.from(message, 'base64'));
    }
  }
  public closeConnection() {
    if (this.streamingStatus !== StreamingStatus.CLOSED) {
      this.streamingStatus = StreamingStatus.CLOSED;
      this.deepgramStream.send(JSON.stringify({ type: 'CloseStream' }));
      this.xiStream.closeConnection();
      this.twilioWSConnection.end(1000);
    }
  }
  public recordGPTTime() {
    const timeToUse =
      this.receivedTime === 0 ? this.xiStream.responseTime : this.receivedTime;
    const responseTime = timeToUse - this.responseTime;
    recordConversation(this.fileName, 'assistant', '', responseTime);
  }
}
