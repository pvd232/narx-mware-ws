import * as fs from 'fs';

export const recordConversation = (
  fileName: string,
  role: string,
  message: string,
  callback?: () => void
) => {
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
};
