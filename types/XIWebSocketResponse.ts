export type XIWebSocketResponse = {
  audio: string;
  isFinal: boolean;
  normalizedAlignment: {
    charStartTimes: Array<number>;
    charsDurationsMs: Array<number>;
    chars: Array<string>;
  };
};
