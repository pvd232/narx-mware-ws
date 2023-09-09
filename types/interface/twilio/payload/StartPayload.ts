import { MediaFormatPayload } from './MediaFormatPayload';

export interface StartPayload {
  accountSid: string;
  streamSid: string;
  callSid: string;
  tracks: string[];
  mediaFormat: MediaFormatPayload;
}
