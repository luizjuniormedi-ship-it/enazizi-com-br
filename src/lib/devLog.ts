/**
 * devLog — wrapper de console.log que só imprime em ambiente de desenvolvimento.
 * Use no lugar de console.log para logs de debug.
 * console.error e console.warn permanecem inalterados (são logs operacionais).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const devLog = (...args: any[]): void => {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
};
