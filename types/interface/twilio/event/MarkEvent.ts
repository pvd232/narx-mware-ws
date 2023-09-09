import { TwilioMessage } from '../TwilioMessage.ts';
import { MarkPayload } from '../payload/MarkPayload.ts';
export interface MarkEvent extends TwilioMessage {
  sequenceNumber: number;
  streamSid: string;
  mark: MarkPayload;
}
