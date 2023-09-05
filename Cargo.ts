import * as async from 'async';
import { AsyncTask } from './types/interface/AsyncTask';
import { TwilioUserData } from './types/interface/twilio/TwilioUserData';
import { WebSocket } from 'uWebSockets.js';
import { getMediaMsg } from './helpers/getMediaMsg.ts';
export class Cargo {
  private twilioWSConnection: WebSocket<TwilioUserData>;
  private streamSid: string;
  public taskResults: Map<number, any> = new Map();
  private tasksCompleted = 0;
  public cargo = async.cargoQueue((tasks: AsyncTask[], callback) => {
    // let promiseChain = Promise.resolve();
    tasks.forEach((task: AsyncTask) => {
      task.task((err: any, result: Buffer) => {
        console.log(`Finished task: ${task.index}`);
        if (err) {
          console.error(`AsyncTask failed with error: ${err}`);
        } else {
          console.log('this.tasksCompleted', this.tasksCompleted);
          // Add the result to taskResults Map
          this.taskResults.set(task.index, result);
          while (this.taskResults.get(this.tasksCompleted) !== undefined) {
            console.log(`Finishing task at position: ${this.tasksCompleted}`);
            const wavBufferNoHeader = this.taskResults
              .get(this.tasksCompleted)
              .subarray(80);
            const wavB64 = wavBufferNoHeader.toString('base64');
            const responseMsg = getMediaMsg(wavB64, this.streamSid);
            this.twilioWSConnection.send(JSON.stringify(responseMsg));
            this.tasksCompleted++;
          }
        }
      });
    });
    // promiseChain.then(() => callback()).catch((err) => callback(err));
  }, 10); // Set payload to 2
  constructor(
    twilioWSConnection: WebSocket<TwilioUserData>,
    streamSid: string
  ) {
    this.twilioWSConnection = twilioWSConnection;
    this.streamSid = streamSid;
  }
  public addTask(task: AsyncTask) {
    console.log(`Added task at position: ${task.index}`);
    this.cargo.push(task);
  }
}
