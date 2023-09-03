export const getMediaMsg = (audio: string, streamSid: string) => {
  // remove header meta data from audio
  const mediaMessage = {
    streamSid,
    event: 'media',
    media: {
      payload: audio,
    },
  };
  return mediaMessage;
};
