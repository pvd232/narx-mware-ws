import { getTwilioReply } from './helpers/getTwilioReply.ts';
import { WebSocket } from 'uWebSockets.js';
import WebSocketClient from 'ws';
import { XIWebSocketResponse } from './types/interface/xi/XIWebSocketResponse.ts';
import { TwilioUserData } from './types/interface/twilio/TwilioUserData.ts';
import { AsyncPriorityQueue } from 'async';

export class MediaStream {
  private twilioWSConnection: WebSocket<TwilioUserData>;
  private xiWSClient: WebSocketClient;
  private streamSid: string;
  private gptReply: string;
  private asyncQueue: AsyncPriorityQueue<unknown>;

  constructor(
    twilioWSConnection: WebSocket<TwilioUserData>,
    xiWSClient: WebSocketClient,
    streamSid: string,
    gptReply: string,
    asyncQueue: AsyncPriorityQueue<unknown>
  ) {
    this.twilioWSConnection = twilioWSConnection;
    this.xiWSClient = xiWSClient;
    this.streamSid = streamSid;
    this.gptReply = gptReply;
    this.asyncQueue = asyncQueue;

    this.xiWSClient.on('connectFailed', (error: any) =>
      console.log('XI WebSocket client connect error: ' + error.toString())
    );
    this.xiWSClient.on('open', this.prepareWebsockets.bind(this));
  }

  private prepareWebsockets() {
    console.log('XI WebSocket client connected');
    this.xiWSClient.on('message', this.handleMessageFromXI.bind(this));
    this.xiWSClient.on('error', console.error);
    this.xiWSClient.on('close', function (_data) {
      console.log('xiWSClient WebSocket closed');
    });
    this.initiateXICommunication(this.gptReply);
  }

  public initiateXICommunication(gptReply: string) {
    const formattedGptReply = gptReply + ' ';
    const streamInit = {
      text: ' ',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
      generation_config: {
        chunk_length_schedule: [120, 160, 250, 290],
      },
      xi_api_key: process.env.ELEVEN_LABS_API_KEY,
    };

    this.xiWSClient!.send(JSON.stringify(streamInit));
    console.log('formattedGptReply', formattedGptReply);
    const textMessage = {
      text: formattedGptReply,
      try_trigger_generation: true,
    };

    this.xiWSClient!.send(JSON.stringify(textMessage));

    // Send the EOS message with an empty string
    const eosMessage = {
      text: '',
    };

    this.xiWSClient!.send(JSON.stringify(eosMessage));
  }

  private handleMessageFromXI(jsonString: string) {
    let response: XIWebSocketResponse = JSON.parse(jsonString);
    if (response.audio) {
      console.log('Audio data in the response');
      getTwilioReply(response.audio, this.streamSid).then((twilioReply) => {
        const twilioReplyJSON = JSON.stringify(twilioReply);
        this.twilioWSConnection.send(twilioReplyJSON);
      });
    } else {
      console.log('No audio data in the response');
      console.log('response', response);
    }
    if (response.isFinal) {
      console.log('Generation is complete');
    }
    if (response.normalizedAlignment) {
      console.log('Alignment info is available');
    }
  }
}
