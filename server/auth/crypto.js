import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(crypto.scrypt);

const SCRYPT_PARAMS = {
  N: 131072,
  r: 8,
  p: 1,
  maxmem: 256 * 1024 * 1024, // 256 MiB
  keylen: 64,
};

export async function hashPassword(password) {
  if (!password || typeof password !== 'string' || password.length < 12 || password.length > 128) {
    throw new Error('Password must be between 12 and 128 characters.');
  }

  const salt = crypto.randomBytes(16);
  const derivedKey = await scryptAsync(password, salt, SCRYPT_PARAMS.keylen, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
    maxmem: SCRYPT_PARAMS.maxmem,
  });

  return `$scrypt$N=${SCRYPT_PARAMS.N},r=${SCRYPT_PARAMS.r},p=${SCRYPT_PARAMS.p}$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password, storedHash) {
  if (!password || !storedHash || typeof storedHash !== 'string') {
    return false;
  }

  const parts = storedHash.split('$');
  // Format: ["", "scrypt", "N=...,r=...,p=...", saltHex, keyHex]
  if (parts.length !== 5 || parts[1] !== 'scrypt') {
    return false;
  }

  const paramStr = parts[2];
  const saltHex = parts[3];
  const expectedKeyHex = parts[4];

  const params = {};
  for (const pair of paramStr.split(',')) {
    const [k, v] = pair.split('=');
    params[k] = parseInt(v, 10);
  }

  const salt = Buffer.from(saltHex, 'hex');
  const expectedKey = Buffer.from(expectedKeyHex, 'hex');

  try {
    const derivedKey = await scryptAsync(password, salt, expectedKey.length, {
      N: params.N || SCRYPT_PARAMS.N,
      r: params.r || SCRYPT_PARAMS.r,
      p: params.p || SCRYPT_PARAMS.p,
      maxmem: SCRYPT_PARAMS.maxmem,
    });

    if (derivedKey.length !== expectedKey.length) {
      return false;
    }

    return crypto.timingSafeEqual(derivedKey, expectedKey);
  } catch {
    return false;
  }
}

export function sha256Digest(token) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export function generateRandomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}
