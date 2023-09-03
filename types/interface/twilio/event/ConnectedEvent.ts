import { TwilioMessage } from '../TwilioMessage.ts';

export interface ConnectedEvent extends TwilioMessage {
  protocol: string;
  version: string;
}
