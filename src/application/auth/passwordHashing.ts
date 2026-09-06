import { randomBytes } from "node:crypto";
import { argon2id, argon2Verify } from "hash-wasm";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "../../domain/passwordPolicy.js";

export { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH };

/**
 * Argon2id verifier hashing (ACCESS-CONTROL.md §5): "Store a salted
 * Argon2id verifier with parameters at least 19 MiB memory, 2 iterations,
 * parallelism 1." hash-wasm is a pure WASM implementation — no native
 * module rebuild is needed for this, unlike better-sqlite3 (see
 * docs/adr/ADR-0001-production-persistence-boundary.md and the
 * rebuild:node/rebuild:electron package.json scripts).
 */
const ARGON2ID_PARAMS = {
  parallelism: 1,
  iterations: 2,
  memorySize: 19_456, // KiB = 19 MiB
  hashLength: 32
} as const;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return argon2id({
    password,
    salt,
    ...ARGON2ID_PARAMS,
    outputType: "encoded"
  });
}

export async function verifyPassword(password: string, verifier: string): Promise<boolean> {
  try {
    return await argon2Verify({ password, hash: verifier });
  } catch {
    // A malformed/foreign verifier string must fail closed, not throw past the caller.
    return false;
  }
}
