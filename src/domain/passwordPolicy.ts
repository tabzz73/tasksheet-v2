/**
 * Pure password-length policy (ACCESS-CONTROL.md §5). Kept separate from
 * application/auth/passwordHashing.ts, which pulls in node:crypto and the
 * hash-wasm WASM binary — those must never enter the renderer bundle, but
 * these two numbers are needed there for a `minLength` hint/validation.
 */
export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_MAX_LENGTH = 128;
