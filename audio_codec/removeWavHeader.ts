export const removeWavHeader = (
  arrayBuffer: ArrayBuffer,
  bytesToSkip: number
): ArrayBuffer => {
  const audioWithoutHeader = arrayBuffer.slice(
    bytesToSkip,
    arrayBuffer.byteLength
  );
  return audioWithoutHeader;
};
