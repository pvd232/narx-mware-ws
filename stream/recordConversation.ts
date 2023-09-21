import * as fs from 'fs';

export const recordConversation = (
  fileName: string,
  role: string,
  message: string,
  gptTime: number | null = null,
  pharmacyName: string | null = null,
  callback?: () => void
) => {
  if (!gptTime) {
    let data = (() => {
      if (!pharmacyName) {
        return `\n${role}: ${message}`;
      } else {
        return `\n${role}: ${pharmacyName}`;
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
  } else {
    let data = `\nGPT Time: ${gptTime}`;
    fs.appendFile(`${fileName}`, data, (err) => {
      if (err) {
        console.log('error recording conversation', err);
      } else {
        if (callback) {
          callback();
        }
      }
    });
  }
};
