import * as fs from 'fs';

export const recordConversation = (
  fileName: string,
  role: string,
  message: string,
  gptTime: number | null = null,
  callback?: () => void
) => {
  if (!gptTime) {
    let data = `\n${role}: ${message}`;
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
