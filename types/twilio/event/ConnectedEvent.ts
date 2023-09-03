import { TwilioMessage } from '../TwilioMessage.ts';

export class ConnectedEvent extends TwilioMessage {
  public protocol: string;
  public version: string;
  constructor(message: { [key: string]: any }) {
    super(message);
    this.protocol = message.protocol;
    this.version = message.version;
  }
}
