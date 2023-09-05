import { Base64String } from './Base64String';

export type XIWebSocketResponse = {
  audio: Base64String;
  isFinal: boolean;
  normalizedAlignment: {
    charStartTimes: Array<number>;
    charsDurationsMs: Array<number>;
    chars: Array<string>;
  };
};
