import { TwilioMessage } from '../TwilioMessage.ts';
import { StartPayload } from '../payload/StartPayload.ts';

export class StartEvent extends TwilioMessage {
  public sequenceNumber: number;

  public start: StartPayload;
  public streamSid: string;
  constructor(message: { [key: string]: any }) {
    super(message);
    this.event = message.event;
    this.sequenceNumber = message.sequenceNumber;
    this.start = message.start;
    this.streamSid = message.streamSid;
  }
}
