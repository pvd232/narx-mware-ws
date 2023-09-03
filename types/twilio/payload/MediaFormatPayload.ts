export class MediaFormatPayload {
  public encoding: string;
  public sampleRate: number;
  public channels: number;

  constructor(mediaFormatPayload: { [key: string]: any }) {
    this.encoding = mediaFormatPayload.encoding;
    this.sampleRate = mediaFormatPayload.sampleRate;
    this.channels = mediaFormatPayload.channels;
  }
}
