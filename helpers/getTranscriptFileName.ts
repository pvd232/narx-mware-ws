export const getTranscriptFileName = () => {
  const date = new Date();
  const dateString = `${date.getMonth()}-${date.getDate()}-${date.getFullYear()}-${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}`;
  return `./transcripts/${dateString}`;
};
