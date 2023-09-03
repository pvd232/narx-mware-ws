export interface StartPayload {
  accountSid: string;
  streamSid: string;
  callSid: string;
  tracks: string[];
  mediaFormat: { [key: string]: any };
}
