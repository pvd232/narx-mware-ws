import { Stream } from '../../../../stream/Stream.ts';
export class StreamService {
  private streams: Map<string, Stream>;
  constructor() {
    this.streams = new Map();
  }
  add(stream: Stream) {
    this.streams.set(stream.streamSid, stream);
  }
  get(streamSid: string) {
    return this.streams.get(streamSid);
  }
  remove(streamSid: string) {
    this.streams.delete(streamSid);
  }
}
