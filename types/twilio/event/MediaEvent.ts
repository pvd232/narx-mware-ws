import { MediaPayload } from '../payload/MediaPayload.ts';
import { TwilioMessage } from '../TwilioMessage.ts';

export class MediaEvent extends TwilioMessage {
  public sequenceNumber: number;
  public media: MediaPayload;
  public streamSid: string;
  constructor(message: { [key: string]: any }) {
    super(message);
    this.sequenceNumber = message.sequenceNumber;
    this.media = new MediaPayload(message.media);
    this.streamSid = message.streamSid;
  }
}
