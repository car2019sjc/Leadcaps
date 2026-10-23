import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
export const tokenHash = token => createHash('sha256').update(token).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');
export async function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${key.toString('hex')}`;
}
export async function passwordMatches(password, encoded) {
  const [, salt, hex] = encoded.split(':');
  const key = await scrypt(password, salt, 64);
  const stored = Buffer.from(hex, 'hex');
  return stored.length === key.length && timingSafeEqual(stored, key);
}
