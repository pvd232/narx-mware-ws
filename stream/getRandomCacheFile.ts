export const getRandomCacheFile = () => {
  const randomInt1 = Math.floor(Math.random() * 2) + 1;
  const randomInt2 = Math.floor(Math.random() * 3) + 1;
  const fileName = `./voice/intro_${randomInt1}/new_intro_${randomInt1}_${randomInt2}.wav`;
  return fileName;
};
