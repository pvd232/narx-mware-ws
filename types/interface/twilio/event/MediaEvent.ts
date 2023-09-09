import { MediaPayload } from '../payload/MediaPayload.ts';
import { TwilioMessage } from '../TwilioMessage.ts';

export interface MediaEvent extends TwilioMessage {
  sequenceNumber: number;
  streamSid: string;
  media: MediaPayload;
}
