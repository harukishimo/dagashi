import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
const KEY_LENGTH = 32;
const DEFAULT_COST = 16_384;
const DEFAULT_BLOCK_SIZE = 8;
const DEFAULT_PARALLELIZATION = 1;
const HASH_PREFIX = "scrypt";

export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 8;
export const MAX_PIN_FAILURES = 5;
export const PIN_LOCKOUT_MS = 30_000;

/** Stable single-register limiter identity; client forwarding headers are untrusted. */
export function stablePinRateLimitKey(_request?: Request): string {
  void _request;
  return "register-global";
}

export function isValidPinFormat(pin: string): boolean {
  return new RegExp(`^[0-9]{${PIN_MIN_LENGTH},${PIN_MAX_LENGTH}}$`, "u").test(pin);
}

export interface PinHashOptions {
  cost?: number;
  blockSize?: number;
  parallelization?: number;
  salt?: Buffer;
}

export async function hashPin(pin: string, options: PinHashOptions = {}): Promise<string> {
  if (!isValidPinFormat(pin)) {
    throw new Error(`PIN must be ${PIN_MIN_LENGTH}-${PIN_MAX_LENGTH} digits`);
  }

  const cost = options.cost ?? DEFAULT_COST;
  const blockSize = options.blockSize ?? DEFAULT_BLOCK_SIZE;
  const parallelization = options.parallelization ?? DEFAULT_PARALLELIZATION;
  const salt = options.salt ?? randomBytes(16);
  const derived = await deriveKey(pin, salt, KEY_LENGTH, {
    N: cost,
    r: blockSize,
    p: parallelization,
    maxmem: Math.max(32 * 1024 * 1024, 128 * cost * blockSize + 1024),
  });

  return [
    HASH_PREFIX,
    cost,
    blockSize,
    parallelization,
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

export async function verifyPin(pin: string, encodedHash: string): Promise<boolean> {
  if (!isValidPinFormat(pin)) return false;
  const parsed = parsePinHash(encodedHash);
  if (!parsed) return false;

  const derived = await deriveKey(pin, parsed.salt, parsed.hash.length, {
    N: parsed.cost,
    r: parsed.blockSize,
    p: parsed.parallelization,
    maxmem: Math.max(32 * 1024 * 1024, 128 * parsed.cost * parsed.blockSize + 1024),
  });

  return derived.length === parsed.hash.length && timingSafeEqual(derived, parsed.hash);
}

function deriveKey(
  pin: string,
  salt: Buffer,
  keyLength: number,
  options: { N: number; r: number; p: number; maxmem: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(pin, salt, keyLength, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey as Buffer);
    });
  });
}

interface ParsedPinHash {
  cost: number;
  blockSize: number;
  parallelization: number;
  salt: Buffer;
  hash: Buffer;
}

function parsePinHash(encodedHash: string): ParsedPinHash | null {
  const [prefix, costValue, blockValue, parallelValue, saltValue, hashValue] = encodedHash.split("$");
  const cost = Number(costValue);
  const blockSize = Number(blockValue);
  const parallelization = Number(parallelValue);
  if (
    prefix !== HASH_PREFIX ||
    !Number.isInteger(cost) ||
    cost < 1_024 ||
    cost > 1_048_576 ||
    (cost & (cost - 1)) !== 0 ||
    !Number.isInteger(blockSize) ||
    blockSize < 1 ||
    blockSize > 32 ||
    !Number.isInteger(parallelization) ||
    parallelization < 1 ||
    parallelization > 16 ||
    !saltValue ||
    !hashValue
  ) {
    return null;
  }
  try {
    const salt = Buffer.from(saltValue, "base64url");
    const hash = Buffer.from(hashValue, "base64url");
    if (salt.length < 8 || hash.length !== KEY_LENGTH) return null;
    return { cost, blockSize, parallelization, salt, hash };
  } catch {
    return null;
  }
}

export interface PinFailureState {
  count: number;
  lockedUntil: number | null;
}

/** In-memory limiter for the single-instance MVP. It should be replaced by shared state for multi-instance hosting. */
export class PinFailureTracker {
  private readonly states = new Map<string, PinFailureState>();

  isLocked(key: string, now = Date.now()): boolean {
    const state = this.states.get(key);
    if (!state?.lockedUntil) return false;
    if (state.lockedUntil <= now) {
      this.states.set(key, { count: 0, lockedUntil: null });
      return false;
    }
    return true;
  }

  recordFailure(key: string, now = Date.now()): PinFailureState {
    if (this.isLocked(key, now)) return this.getState(key);
    const previous = this.states.get(key) ?? { count: 0, lockedUntil: null };
    const count = previous.count + 1;
    const lockedUntil = count >= MAX_PIN_FAILURES ? now + PIN_LOCKOUT_MS : null;
    const next = { count, lockedUntil };
    this.states.set(key, next);
    return next;
  }

  reset(key: string): void {
    this.states.delete(key);
  }

  getState(key: string): PinFailureState {
    const state = this.states.get(key);
    return state ? { ...state } : { count: 0, lockedUntil: null };
  }
}
