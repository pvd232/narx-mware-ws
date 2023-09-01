import { getTwilioReply } from './audio_codec/getTwilioReply.ts';
import { log } from './log';

interface WebSocket {
  on(event: string, callback: (data?: any) => void): void;
  send(data: string): void;
  connect(url: string): void;
}

interface XIWebSocketResponse {
  audio?: string;
  isFinal?: boolean;
  normalizedAlignment?: any;
}

export class MediaStream {
  private twilioWSConnection: WebSocket;
  private xiWSClient: WebSocket;
  private xiWSConnection?: WebSocket;
  private streamSid: string;

  constructor(twilioWSConnection: WebSocket, xiWSClient: WebSocket) {
    this.twilioWSConnection = twilioWSConnection;
    this.xiWSClient = xiWSClient;
    this.streamSid = '-1';

    this.xiWSClient.on('connectFailed', (error: any) =>
      console.log('Connect Error: ' + error.toString())
    );
    this.xiWSClient.on('open', this.prepareWebsockets.bind(this));
    this.xiWSClient.connect('ws://localhost:8888/ws-streaming-twilio');
  }

  private prepareWebsockets(xiWSConnection: WebSocket) {
    console.log('WebSocket connected to eleven labs');
    this.xiWSConnection = xiWSConnection;
    this.xiWSConnection.on('message', this.handleMessageFromXI.bind(this));
    this.xiWSConnection.on('error', console.error);
    this.xiWSConnection.on('close', function (data) {
      const event = JSON.parse(data);
      console.log('event', event);
      if (event.wasClean) {
        console.info(
          `Connection closed cleanly, code=${event.code}, reason=${event.reason}`
        );
      } else {
        console.warn('Connection died');
      }
    });

    // this.twilioWSConnection.on(
    //   'message',
    //   this.handleMessageFromTwilio.bind(this)
    // );
    // this.twilioWSConnection.on('close', this.close.bind(this));

    // this.mode = 'recording';
    this.streamSid = '-1';
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
    this.xiWSConnection!.send(JSON.stringify(streamInit));
    const textMessage = {
      text: formattedGptReply,
      try_trigger_generation: true,
    };

    this.xiWSConnection!.send(JSON.stringify(textMessage));

    // 4. Send the EOS message with an empty string
    const eosMessage = {
      text: '',
    };

    this.xiWSConnection!.send(JSON.stringify(eosMessage));
  }

  private handleMessageFromXI(data: string) {
    let response: XIWebSocketResponse = JSON.parse(data);

    if (response.audio) {
      const twilioReply = JSON.stringify(
        getTwilioReply(response.audio, '1234')
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
