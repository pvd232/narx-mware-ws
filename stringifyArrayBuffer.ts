export const stringifyArrayBuffer = (message: ArrayBuffer) => {
  const decoder = new TextDecoder();
  return decoder.decode(message);
};
