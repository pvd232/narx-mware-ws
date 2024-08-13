import { WebSocket } from 'uWebSockets.js';
import { TwilioUserData } from '../types/interface/twilio/TwilioUserData.ts';
import { LiveTranscription } from '@deepgram/sdk/dist/transcription/liveTranscription';
import { XIStream } from './XIStream.ts';
import { ChatCompletionMessage } from 'openai/resources/chat';
import { recordConversation } from './recordConversation.ts';
import { StreamingStatus } from '../types/enums/StreamingStatus.ts';
import { getGptReplyAzure } from '../helpers/getGptReplyAzure.ts';
import { deepgramConfig } from '../config/deepgramConfig.ts';
import pkg from '@deepgram/sdk';
const { Deepgram } = pkg;
export class Stream {
  private twilioWSConnection: WebSocket<TwilioUserData>;

  private deepgramStream: LiveTranscription;
  private xiStream: XIStream;
  public streamingStatus: StreamingStatus = StreamingStatus.PHARM;
  private messages: ChatCompletionMessage[] = [];
  public callSid: string;
  public streamSid: string;
  private fileName: string;
  private regExpresion = new RegExp(/[a-z]/i);
  private isFirstMessage = true;
  private responseTime = 0;
  private receivedTime = 0;
  private queuedMsgs: string[] = [];

  constructor(
    twilioWSConnection: WebSocket<TwilioUserData>,
    deepgramStream: LiveTranscription,
    xiStream: XIStream,
    messages: ChatCompletionMessage[],
    callSid: string,
    streamSid: string,
    fileName: string
  ) {
    this.twilioWSConnection = twilioWSConnection;
    this.deepgramStream = deepgramStream;
    this.deepgramStream.on('open', this.prepareWebsockets.bind(this));
    this.xiStream = xiStream;
    this.messages = messages;
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
    this.deepgramStream.on('close', () => {
      console.log('Deepgram transcription closed');
    });
    if (this.queuedMsgs.length > 0) {
      this.queuedMsgs.forEach((msg) => {
        this.deepgramStream.send(Buffer.from(msg, 'base64'));
      });
      this.queuedMsgs = [];
    }
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

            this.streamingStatus = StreamingStatus.GPT;
            this.messages.push({
              role: 'user',
              content: 'hello',
            });
          } else {
            this.streamingStatus = StreamingStatus.GPT;
            this.messages.push({
              role: 'user',
              content: pharmReply,
            });
          }
          console.log('pharmReply', pharmReply);
          recordConversation(this.fileName, 'user', pharmReply);

          const gptStream = await getGptReplyAzure(this.messages, 'gpt-4');
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
                continue;
              } else {
                this.xiStream.sendXIMessage(response);
                response = text;
                continue;
              }
            }
          }
          console.log('response', response);
          if (response !== '') {
            this.xiStream.sendXIMessage(response);
          }
          this.xiStream.endStream();
          if (completeResponse === 'hi') {
            completeResponse =
              'Hi, I was just calling to see if you had a medication in stock?';
          }
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
      this.streamingStatus === StreamingStatus.PHARM &&
      this.deepgramStream.getReadyState() === 1
    ) {
      this.deepgramStream.send(Buffer.from(message, 'base64'));
    } else if (
      this.streamingStatus === StreamingStatus.PHARM &&
      this.deepgramStream.getReadyState() !== 1
    ) {
      this.queuedMsgs.push(message);
      this.deepgramStream.removeAllListeners();

      this.deepgramStream = new Deepgram(
        process.env.DEEPGRAM_API_KEY!
      ).transcription.live(deepgramConfig);
      this.deepgramStream.on('open', this.prepareWebsockets.bind(this));
    }
  }
  public closeConnection() {
    if (this.streamingStatus !== StreamingStatus.CLOSED) {
      this.streamingStatus = StreamingStatus.CLOSED;
      if (this.deepgramStream.getReadyState() === 1) {
        this.deepgramStream.send(JSON.stringify({ type: 'CloseStream' }));
      }
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
