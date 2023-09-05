export const log = (message: string, ...args: string[]) => {
  console.log(new Date(), message, ...args);
};
