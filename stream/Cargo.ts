import * as async from 'async';
import { AsyncTask } from '../types/interface/AsyncTask.ts';
import { TwilioUserData } from '../types/interface/twilio/TwilioUserData.ts';
import { WebSocket } from 'uWebSockets.js';
import { getMediaMsg } from '../helpers/getMediaMsg.ts';
import { Base64String } from '../types/interface/xi/Base64String.ts';
import { StreamingStatus } from '../types/enums/StreamingStatus.ts';
import { Stream } from 'stream';
import { MarkName } from '../types/enums/MarkName.ts';
export class Cargo {
  private twilioWSConnection: WebSocket<TwilioUserData>;
  private streamSid: string;
  public taskResults: Map<number, any> = new Map();
  private tasksCompleted = 0;
  public xiStreamComplete = false;
  public streamingStatus: StreamingStatus = StreamingStatus.PHARM;
  public cargo = async.cargoQueue(
    (tasks: AsyncTask[], callback: () => void) => {
      for (let i = 0; i < tasks.length; i++) {
        let task = tasks[i];
        task.task((err: any, result: Buffer) => {
          console.log(`Task ${task.index} completed`);
          if (err) {
            console.error(`AsyncTask failed with error: ${err}`);
          } else {
            // Add the result to taskResults Map
            this.taskResults.set(task.index, result);
            while (this.taskResults.get(this.tasksCompleted) !== undefined) {
              const wavBufferNoHeader = this.taskResults
                .get(this.tasksCompleted)
                .subarray(80);
              const wavB64 = wavBufferNoHeader.toString('base64');
              this.sendTwilioMessage(wavB64);
              this.tasksCompleted++;
            }
          }
          callback();
        });
      }
    },
    15 // Set concurrency to 15
  );

  constructor(
    twilioWSConnection: WebSocket<TwilioUserData>,
    streamSid: string
  ) {
    this.twilioWSConnection = twilioWSConnection;
    this.streamSid = streamSid;
    this.cargo.drain(() => {
      if (
        this.cargo.idle() &&
        this.tasksCompleted === this.taskResults.size &&
        this.xiStreamComplete
      ) {
        console.log('All tasks completed');

        this.taskResults.clear();
        this.tasksCompleted = 0;
        this.xiStreamComplete = false;
        this.sendTwilioMarkMessage();
      }
    });
  }
  public addTask(task: AsyncTask) {
    this.cargo.push(task);
  }
  private sendTwilioMessage(message: Base64String) {
    if (
      this.streamingStatus === StreamingStatus.GPT ||
      this.streamingStatus === StreamingStatus.CLOSING
    ) {
      console.log('Sending Twilio Message');
      const mediaMsg = getMediaMsg(message, this.streamSid);
      this.twilioWSConnection.send(JSON.stringify(mediaMsg));
    }
  }
  private sendTwilioMarkMessage() {
    const markMsg = {
      event: 'mark',
      streamSid: this.streamSid,
      mark: {
        name:
          this.streamingStatus === StreamingStatus.CLOSING
            ? MarkName.TERMINATE
            : MarkName.COMPLETE,
      },
    };
    if (
      this.streamingStatus === StreamingStatus.GPT ||
      this.streamingStatus === StreamingStatus.CLOSING
    ) {
      this.twilioWSConnection.send(JSON.stringify(markMsg));
    }
  }
  public closeConnection() {
    this.streamingStatus = StreamingStatus.CLOSED;
    this.cargo.kill();
  }
}
