export const detectIVR = (text: string): boolean => {
  const commonIVRReponsesSet = new Set();
  commonIVRReponsesSet.add('welcome');
  commonIVRReponsesSet.add('thank');
  commonIVRReponsesSet.add('thanks');
  commonIVRReponsesSet.add('reached');
  commonIVRReponsesSet.add('calling');
  commonIVRReponsesSet.add('press');
  commonIVRReponsesSet.add('for');
  let words = text.split(' ');
  for (let i = 0; i < words.length; i++) {
    if (commonIVRReponsesSet.has(words[i].toLowerCase())) {
      return true;
    }
  }
  return false;
};
