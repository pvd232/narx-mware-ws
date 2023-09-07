import * as fs from 'fs';

export const recordConversation = (
  fileName: string,
  role: string,
  message: string,
  gptResponseTime?: number,
  xiResponseTime?: number,
  callback?: () => void
) => {
  let data = (() => {
    if (gptResponseTime && xiResponseTime) {
      return `\n${role}: ${message}\nGPT Lag: ${gptResponseTime}ms\nXI Lag: ${xiResponseTime}ms`;
    } else {
      return `\n${role}: ${message}`;
    }
  })();
  fs.appendFile(`${fileName}`, data, (err) => {
    if (err) {
      console.log('error recording conversation', err);
    } else {
      if (callback) {
        callback();
      }
    }
  });
};
