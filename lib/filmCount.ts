export const filmWord = (n: number) => (n === 1 ? "film" : "films");

export const filmCount = (n: number) => `${n} ${filmWord(n)}`;
