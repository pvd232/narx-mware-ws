import { getTwilioReply } from './audio_codec/getTwilioReply.ts';
import { WebSocket } from 'uWebSockets.js';
import WebSocketClient from 'ws';
import { XIWebSocketResponse } from './XIWebSocketResponse.ts';

import { log } from './log';
import { TwilioUserData } from './UserData.ts';
export class MediaStream {
  private twilioWSConnection: WebSocket<TwilioUserData>;
  private xiWSClient: WebSocketClient;
  private streamSid: string;
  private gptReply: string;

  constructor(
    twilioWSConnection: WebSocket<TwilioUserData>,
    xiWSClient: WebSocketClient,
    gptReply: string
  ) {
    this.twilioWSConnection = twilioWSConnection;
    this.xiWSClient = xiWSClient;
    this.streamSid = '-1';
    this.gptReply = gptReply;
    this.xiWSClient.on('connectFailed', (error: any) =>
      console.log('Connect Error: ' + error.toString())
    );
    this.xiWSClient.on('open', this.prepareWebsockets.bind(this));
  }

  private prepareWebsockets() {
    console.log('WebSocket connected to eleven labs');
    this.xiWSClient.on('message', this.handleMessageFromXI.bind(this));
    this.xiWSClient.on('error', console.error);
    this.xiWSClient.on('close', function (data) {
      console.log('WebSocket closed');
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
    const textMessage = {
      text: formattedGptReply,
      try_trigger_generation: true,
    };

    this.xiWSClient!.send(JSON.stringify(textMessage));

    // 4. Send the EOS message with an empty string
    const eosMessage = {
      text: '',
    };

    this.xiWSClient!.send(JSON.stringify(eosMessage));
  }

  private handleMessageFromXI(data: string) {
    let response: XIWebSocketResponse = JSON.parse(data);
    console.log('response', response);

    if (response.audio) {
      const twilioReply = JSON.stringify(
        getTwilioReply(response.audio, this.streamSid)
      );
      this.twilioWSConnection.send(twilioReply);
    } else {
      console.log('No audio data in the response');
      console.log('response', response);
    }
    if (response.isFinal) {
      console.log('Generation is complete');
    }
    if (response.normalizedAlignment) {
      console.log('Alignment info is available');
      // use the alignment info if needed
    }
  }
}
