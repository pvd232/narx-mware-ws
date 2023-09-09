import { TwilioMessage } from '../TwilioMessage.ts';
import { StartPayload } from '../payload/StartPayload.ts';

export interface StartEvent extends TwilioMessage {
  sequenceNumber: number;

  streamSid: string;
  start: StartPayload;
}
