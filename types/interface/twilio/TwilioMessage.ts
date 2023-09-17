import { MessageEvent } from '../../enums/MessageEvent.ts';

export type TwilioMessage = {
  event: MessageEvent;
};
