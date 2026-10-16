import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

/**
 * Password-protected backups. No home-made cryptography: Node's built-in scrypt (key derivation)
 * and AES-256-GCM (authenticated encryption). A wrong password or any tampering fails the
 * authentication check. Losing the password means the backup cannot be opened.
 */
export const ENCRYPTED_FORMAT = 'wincat-backup-encrypted'

export interface Envelope {
  format: typeof ENCRYPTED_FORMAT
  version: 1
  kdf: 'scrypt'
  N: number
  r: number
  p: number
  salt: string
  iv: string
  tag: string
  data: string
}

const N = 1 << 15
const R = 8
const P = 1

function key(password: string, salt: Buffer, n: number, r: number, p: number): Buffer {
  return scryptSync(password.normalize('NFKC'), salt, 32, { N: n, r, p, maxmem: 128 * n * r * 2 })
}

export function encryptText(plain: string, password: string): Envelope {
  if (!password) throw new Error('A password is required')
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(password, salt, N, R, P), iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return {
    format: ENCRYPTED_FORMAT,
    version: 1,
    kdf: 'scrypt',
    N,
    r: R,
    p: P,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64')
  }
}

export function isEnvelope(v: unknown): v is Envelope {
  const e = v as Partial<Envelope> | null
  return !!e && e.format === ENCRYPTED_FORMAT && e.version === 1 && e.kdf === 'scrypt' && typeof e.salt === 'string' && typeof e.iv === 'string' && typeof e.tag === 'string' && typeof e.data === 'string' && typeof e.N === 'number'
}

/** @throws Error('Wrong password or damaged file') when authentication fails */
export function decryptText(env: Envelope, password: string): string {
  try {
    // refuse absurd cost parameters from an untrusted file
    if (env.N > 1 << 20 || env.r > 16 || env.p > 4 || env.N < 1024) throw new Error('bad parameters')
    const d = createDecipheriv('aes-256-gcm', key(password, Buffer.from(env.salt, 'base64'), env.N, env.r, env.p), Buffer.from(env.iv, 'base64'))
    d.setAuthTag(Buffer.from(env.tag, 'base64'))
    return Buffer.concat([d.update(Buffer.from(env.data, 'base64')), d.final()]).toString('utf8')
  } catch {
    throw new Error('Wrong password or damaged file')
  }
}
