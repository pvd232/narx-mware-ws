export class StopPayload {
  public accountSid: string;
  public callSid: string;
  constructor(stopPayload: { [key: string]: string }) {
    this.accountSid = stopPayload.accountSid;
    this.callSid = stopPayload.callSid;
  }
}
