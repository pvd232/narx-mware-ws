import { MessageEvent } from '../../enums/MessageEvent.ts';

export interface TwilioMessage {
  event: MessageEvent;
}
