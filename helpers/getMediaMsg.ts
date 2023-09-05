export const getMediaMsg = (audio: string, streamSid: string) => {
  const mediaMessage = {
    streamSid,
    event: 'media',
    media: {
      payload: audio,
    },
  };
  return mediaMessage;
};
