import { getTwilioReply } from './helpers/getTwilioReply.ts';
import { WebSocket } from 'uWebSockets.js';
import WebSocketClient from 'ws';
import { XIWebSocketResponse } from './types/interface/xi/XIWebSocketResponse.ts';
import { TwilioUserData } from './types/interface/twilio/TwilioUserData.ts';
import { AsyncPriorityQueue } from 'async';
import { Cargo } from './Cargo.ts';
import { convertToWav } from './helpers/convertToWav.ts';
import { convertToWavCallback } from './helpers/convertToWavCallback.ts';
import fs from 'fs';

export class MediaStream {
  private xiWSClient: WebSocketClient;
  private gptReply: string;
  private cargo: Cargo;
  private taskIndex = 0;

  constructor(xiWSClient: WebSocketClient, gptReply: string, cargo: Cargo) {
    this.xiWSClient = xiWSClient;
    this.gptReply = gptReply;
    this.cargo = cargo;

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
    this.initiateXICommunication();
  }

  public initiateXICommunication() {
    const formattedGptReply = this.gptReply + ' ';
    const streamInit = {
      text: ' ',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.6,
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

    // Send the EOS message with an empty string
    const eosMessage = {
      text: '',
    };

    this.xiWSClient!.send(JSON.stringify(eosMessage));
  }

  private handleMessageFromXI(jsonString: string) {
    console.log('Received message from XI');
    let response: XIWebSocketResponse = JSON.parse(jsonString);
    if (response.audio) {
      this.cargo.addTask({
        task: convertToWavCallback.bind(
          null,
          Buffer.from(response.audio, 'base64')
        ),
        index: this.taskIndex++,
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
