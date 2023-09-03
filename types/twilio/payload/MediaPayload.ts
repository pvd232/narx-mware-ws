export class MediaPayload {
  public track: string;
  public chunk: number;
  public timestamp: number;
  public payload: string;

  constructor(mediaPayload: { [key: string]: string }) {
    this.track = mediaPayload.track;
    this.chunk = parseInt(mediaPayload.chunk, 0);
    this.timestamp = parseInt(mediaPayload.timestamp, 0);
    this.payload = mediaPayload.payload;
  }
  toJSON() {
    return {
      track: this.track,
      chunk: this.chunk,
      timestamp: this.timestamp,
      payload: this.payload,
    };
  }
}
