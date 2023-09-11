export const isNumber = (n: string): boolean => {
  let parsed = parseInt(n);
  return !isNaN(parsed) && parsed.toString() === n;
};
