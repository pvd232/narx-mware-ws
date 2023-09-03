import { MessageEvent } from './event/enums/MessageEvent.ts';

export class TwilioMessage {
  public event: MessageEvent;
  constructor(message: { [key: string]: any }) {
    this.event = message.event;
  }
}
