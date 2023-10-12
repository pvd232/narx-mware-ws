import { WebSocket } from 'uWebSockets.js';
import WebSocketClient from 'ws';
import { TwilioUserData } from '../types/interface/twilio/TwilioUserData.ts';
import { LiveTranscription } from '@deepgram/sdk/dist/transcription/liveTranscription';
import { XIStream } from './XIStream.ts';
import { ChatCompletionMessage } from 'openai/resources/chat';
import { recordConversation } from './recordConversation.ts';
import { StreamingStatus } from '../types/enums/StreamingStatus.ts';
import { getGptReplyAzure } from '../helpers/getGptReplyAzure.ts';
import { ConnectionStatus } from '../types/enums/ConnectionStatus.ts';

export class Stream {
  private twilioWSConnection: WebSocket<TwilioUserData>;

  public deepgramStream: LiveTranscription;
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
    this.deepgramStream.on('close', () =>
      console.log('Deepgram transcription closed')
    );
  }
  public reinitializeDeepgramConnection(deepgramStream: LiveTranscription) {
    this.deepgramStream = deepgramStream;
    this.prepareWebsockets();
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
          this.xiStream.reinitializeConnection(
            new WebSocketClient(
              `wss://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVEN_LABS_VOICE_ID}/stream-input?model_type=${process.env.ELEVEN_LABS_MODEL_ID}&optimize_streaming_latency=4`
            )
          );
          this.streamingStatus = StreamingStatus.GPT;

          if (this.isFirstMessage) {
            this.responseTime = Date.now();
            this.isFirstMessage = false;
            this.messages.push({
              role: 'user',
              content: 'hello',
            });
          } else {
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
      this.streamingStatus === StreamingStatus.PHARM &&
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
