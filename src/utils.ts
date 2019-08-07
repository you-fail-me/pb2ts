export const stripScope = (name: string) => {
  const re = /^@.+\//;

  return name.replace(re, '');
};
