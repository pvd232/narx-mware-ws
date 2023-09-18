export const getRandomCacheFile = () => {
  // random number between 1 and 2
  const randomInt1 = Math.floor(Math.random() * 3) + 1;
  const fileName = `./voice/intro/intro_${randomInt1}.wav`;
  return fileName;
};
