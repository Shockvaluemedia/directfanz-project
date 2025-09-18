/**
 * Secure cryptographic utilities for the Direct Fan Platform
 * Provides cryptographically secure random generation as replacement for insecure random functions
 */

import crypto from 'crypto';

/**
 * Generate a cryptographically secure random integer between min and max (inclusive)
 */
export function secureRandomInt(min: number, max: number): number {
  if (min > max) {
    throw new Error('min must be less than or equal to max');
  }
  
  const range = max - min + 1;
  const bytesNeeded = Math.ceil(Math.log2(range) / 8);
  const maxValid = Math.floor(Math.pow(256, bytesNeeded) / range) * range - 1;
  
  let randomValue: number;
  do {
    const randomBytes = crypto.randomBytes(bytesNeeded);
    randomValue = 0;
    for (let i = 0; i < bytesNeeded; i++) {
      randomValue = (randomValue << 8) + randomBytes[i];
    }
  } while (randomValue > maxValid);
  
  return min + (randomValue % range);
}

/**
 * Generate a cryptographically secure random float between 0 and 1
 * Secure alternative to the standard library's random function
 */
export function secureRandom(): number {
  const bytes = crypto.randomBytes(4);
  const max = 0xFFFFFFFF;
  const value = bytes.readUInt32BE(0);
  return value / (max + 1);
}

/**
 * Generate a cryptographically secure random float between min and max
 */
export function secureRandomFloat(min: number, max: number): number {
  if (min > max) {
    throw new Error('min must be less than or equal to max');
  }
  
  return min + (secureRandom() * (max - min));
}

/**
 * Generate a cryptographically secure random string
 */
export function secureRandomString(length: number, charset?: string): string {
  const defaultCharset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const chars = charset || defaultCharset;
  
  let result = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = secureRandomInt(0, chars.length - 1);
    result += chars[randomIndex];
  }
  
  return result;
}

/**
 * Generate a cryptographically secure random hex string
 */
export function secureRandomHex(length: number): string {
  const bytes = crypto.randomBytes(Math.ceil(length / 2));
  return bytes.toString('hex').substring(0, length);
}

/**
 * Generate a cryptographically secure UUID v4
 */
export function secureUUID(): string {
  return crypto.randomUUID();
}

/**
 * Generate a cryptographically secure random ID for various use cases
 */
export function generateSecureId(prefix?: string, length: number = 16): string {
  const randomPart = secureRandomString(length, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789');
  return prefix ? `${prefix}_${randomPart}` : randomPart;
}

/**
 * Secure random array shuffling using Fisher-Yates algorithm
 */
export function secureArrayShuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = secureRandomInt(0, i);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
}

/**
 * Secure random selection from an array
 */
export function secureRandomChoice<T>(array: T[]): T {
  if (array.length === 0) {
    throw new Error('Cannot select from empty array');
  }
  
  const index = secureRandomInt(0, array.length - 1);
  return array[index];
}

/**
 * Generate a secure random delay for timing attacks prevention
 */
export function secureRandomDelay(minMs: number = 100, maxMs: number = 500): Promise<void> {
  const delay = secureRandomInt(minMs, maxMs);
  return new Promise(resolve => setTimeout(resolve, delay));
}