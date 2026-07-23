// Bundlers statically replace `process.env.NODE_ENV`; we only need the type
// guard here (no @types/node dependency).
declare const process: { env: { NODE_ENV?: string } } | undefined;

export const isDev =
  typeof process !== 'undefined' && process?.env?.NODE_ENV !== 'production';
