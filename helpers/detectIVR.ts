export const detectIVR = (text: string): boolean => {
  const commonIVRReponsesSet = new Set();
  commonIVRReponsesSet.add('welcome');
  commonIVRReponsesSet.add('thank');
  commonIVRReponsesSet.add('reached');
  let words = text.split(' ');
  for (let i = 0; i < words.length; i++) {
    if (commonIVRReponsesSet.has(words[i].toLowerCase())) {
      return true;
    }
  }
  return false;
};
