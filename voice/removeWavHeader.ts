export const removeWavHeader = (
  arrayBuffer: ArrayBuffer,
  bytesToSkip: number
) => {
  const audioWithoutHeader = arrayBuffer.slice(
    bytesToSkip,
    arrayBuffer.byteLength
  );
  return audioWithoutHeader;
};
