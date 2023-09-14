import { WebSocket } from 'uWebSockets.js';
import { TwilioUserData } from '../types/interface/twilio/TwilioUserData.ts';
import { LiveTranscription } from '@deepgram/sdk/dist/transcription/liveTranscription';
import { XIStream } from './XIStream.ts';
import { ChatCompletionMessage } from 'openai/resources/chat';
import { recordConversation } from './recordConversation.ts';
import { getGptReply } from '../helpers/getGptReply.ts';
import { Twilio } from 'twilio';
import { StreamingStatus } from '../types/enums/StreamingStatus.ts';
import { isNumber } from '../utils/isNumber.ts';
import { getGptReplyAzure } from '../helpers/getGptReplyAzure.ts';
import { detectIVR } from '../helpers/detectIVR.ts';

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
  private isFirstMessage = true;
  public responseTime = 0;

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
            }
          } else {
            if (this.streamingStatus !== StreamingStatus.IVR) {
              this.streamingStatus = StreamingStatus.GPT;
            }
          }
          console.log('this.streamingStatus', this.streamingStatus);
          this.messages.push({
            role: 'user',
            content: pharmReply,
          });

          console.log('pharmReply', pharmReply);
          recordConversation(this.fileName, 'user', pharmReply);

          const gptStream = await (async () => {
            if (this.streamingStatus === StreamingStatus.IVR) {
              const chat = await getGptReply(this.messages);
              return chat;
            } else {
              const chat = await getGptReply(this.messages);
              // const chat = await getGptReplyAzure(this.messages);
              return chat;
            }
          })();

          let response = '';
          let completeResponse = '';

          for await (const part of gptStream) {
            const text = part.choices[0]?.delta?.content || '';
            // For IVR handling response will be empty
            if (text !== '') {
              completeResponse += text;
              // Test is text is an integer using parseInt
              if (response.toLowerCase().includes('goodbye')) {
                this.streamingStatus = StreamingStatus.CLOSING;
                this.xiStream.closingConnection();
              } else if (
                response.toLowerCase().includes('press') &&
                isNumber(text)
              ) {
                // Close out everything
                this.streamingStatus = StreamingStatus.CLOSED;
                this.xiStream.closeConnection();
                const ivrResponse = text;
                recordConversation(this.fileName, 'assistant', response);
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
    const responseTime = this.xiStream.responseTime - this.responseTime;
    recordConversation(this.fileName, 'assistant', '', responseTime);
  }
}
