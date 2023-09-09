import WebSocketClient from 'ws';
import { XIWebSocketResponse } from '../types/interface/xi/XIWebSocketResponse.ts';
import { Cargo } from './Cargo.ts';
import { convertToWav } from '../helpers/convertToWav.ts';
import { recordConversation } from './recordingConversation.ts';
import { StreamingStatus } from '../types/enums/StreamingStatus.ts';

export class XIStream {
  private xiWSClient: WebSocketClient;
  private cargo: Cargo;
  private taskIndex = 0;
  private fileName = '';
  private queuedMessages: string[] = [];
  public streamingStatus = StreamingStatus.PHARM;
  constructor(xiWSClient: WebSocketClient, cargo: Cargo, fileName: string) {
    this.xiWSClient = xiWSClient;
    this.xiWSClient.on('open', this.prepareWebsockets.bind(this));
    this.xiWSClient.on('connectFailed', (error: any) =>
      console.log('XI WebSocket client connect error: ' + error.toString())
    );
    this.cargo = cargo;
    this.fileName = fileName;
  }
  private prepareWebsockets() {
    console.log('XI WebSocket client connected');
    this.xiWSClient.on('message', this.handleMessageFromXI.bind(this));
    this.xiWSClient.on('error', console.error);
    this.xiWSClient.on('close', function (_data) {
      console.log('xiWSClient WebSocket closed');
    });
    this.initStream();
  }
  private initStream() {
    const streamInit = {
      text: ' ',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.7,
      },
      generation_config: {
        chunk_length_schedule: [120, 160, 250, 290],
      },
      xi_api_key: process.env.ELEVEN_LABS_API_KEY,
    };
    this.xiWSClient!.send(JSON.stringify(streamInit));

    while (this.queuedMessages.length > 0) {
      this.sendXIMessage(this.queuedMessages.shift() ?? '');
    }
  }
  public reinitializeConnection() {
    this.streamingStatus = StreamingStatus.GPT;
    this.cargo.streamingStatus = StreamingStatus.GPT;
    if (this.xiWSClient.readyState !== 1 && this.xiWSClient.readyState !== 0) {
      this.xiWSClient = new WebSocketClient(
        `wss://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVEN_LABS_VOICE_ID}/stream-input?model_type=${process.env.ELEVEN_LABS_MODEL_ID}&optimize_streaming_latency=4`
      );
      this.xiWSClient.on('open', this.prepareWebsockets.bind(this));
      this.xiWSClient.on('connectFailed', (error: any) =>
        console.log('XI WebSocket client connect error: ' + error.toString())
      );
    }
  }
  public sendXIMessage(text: string) {
    const formattedGptReply = text + ' ';
    const textMessage = {
      text: formattedGptReply,
      try_trigger_generation: true,
    };
    if (this.xiWSClient.readyState === 1) {
      this.xiWSClient!.send(JSON.stringify(textMessage));
    } else if (this.xiWSClient.readyState === 0) {
      console.log('XI WebSocket client opening');
      this.queuedMessages.push(text);
    } else {
      console.log('XI WebSocket client closing or closed, recording message');
      recordConversation(this.fileName, 'failed assistant', formattedGptReply);
    }
  }
  public endStream = () => {
    // Send the EOS message with an empty string
    const eosMessage = {
      text: '',
    };
    if (this.xiWSClient.readyState === 1) {
      this.xiWSClient!.send(JSON.stringify(eosMessage));
    }
  };

  private handleMessageFromXI(jsonString: string) {
    console.log('Received message from XI');
    let response: XIWebSocketResponse = JSON.parse(jsonString);
    if (response.audio) {
      this.cargo.addTask({
        task: convertToWav.bind(null, Buffer.from(response.audio, 'base64')),
        index: this.taskIndex++,
      });
    }
    if (response.isFinal) {
      this.cargo.xiStreamComplete = true;
    }
  }
  public closeConnection() {
    this.streamingStatus = StreamingStatus.CLOSED;
    this.cargo.streamingStatus = StreamingStatus.CLOSED;
  }
  public closingConnection() {
    this.streamingStatus = StreamingStatus.CLOSING;
    this.cargo.streamingStatus = StreamingStatus.CLOSING;
  }
}
