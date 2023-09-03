import { TwilioMessage } from '../TwilioMessage.ts';
import { StopPayload } from '../payload/StopPayload.ts';
export class EndEvent extends TwilioMessage {
  public sequenceNumber: number;
  public streamSid: string;
  public stop: StopPayload;
  constructor(message: { [key: string]: any }) {
    super(message);
    this.sequenceNumber = message.sequenceNumber;
    this.streamSid = message.streamSid;
    this.stop = new StopPayload(message.stop);
  }
}
