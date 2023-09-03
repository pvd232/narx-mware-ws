export class StartPayload {
  public accountSid: string;
  public streamSid: string;
  public callSid: string;
  public tracks: string[];
  public mediaFormat: { [key: string]: any };

  constructor(startPayload: { [key: string]: any }) {
    this.accountSid = startPayload.accountSid;
    this.streamSid = startPayload.streamSid;
    this.callSid = startPayload.callSid;
    this.tracks = new Array(startPayload.tracks);
    this.mediaFormat = startPayload.mediaFormat;
  }
}
