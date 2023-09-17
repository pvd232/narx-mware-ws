import { TwilioMessage } from '../TwilioMessage.ts';
import { StopPayload } from '../payload/StopPayload.ts';
export interface StopEvent extends TwilioMessage {
  sequenceNumber: number;
  streamSid: string;
  stop: StopPayload;
}
