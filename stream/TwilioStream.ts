import { WebSocket } from 'uWebSockets.js';
import { TwilioUserData } from '../types/interface/twilio/TwilioUserData.ts';
import { LiveTranscription } from '@deepgram/sdk/dist/transcription/liveTranscription';
import { XIStream } from './XIStream.ts';
import {
  ChatCompletionChunk,
  ChatCompletionMessage,
} from 'openai/resources/chat';
import { recordConversation } from './recordingConversation.ts';
import { getGptReply } from '../helpers/getGptReply.ts';
import { Stream } from 'openai/streaming';
import { Twilio } from 'twilio';
import { StreamingStatus } from '../types/enums/StreamingStatus.ts';
import { isNumber } from '../utils/isNumber.ts';

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
    this.deepgramStream.send(JSON.stringify({ type: 'CloseStream' }));
    if (this.streamingStatus !== StreamingStatus.CLOSED) {
      this.streamingStatus = StreamingStatus.CLOSED;
      this.twilioWSConnection.end();
    }
  }
}
