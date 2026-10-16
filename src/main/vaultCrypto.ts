import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

/**
 * Private vault file format. No home-made cryptography: Node's built-in scrypt and AES-256-GCM.
 *
 *   master key (32 random bytes)  --AES-GCM-->  encrypts the vault contents ("body")
 *   master key is stored wrapped twice:
 *     - by a key derived (scrypt) from the user's PASSWORD
 *     - by a key derived (scrypt) from a random RECOVERY KEY shown once at setup
 *   optionally a third wrap by Windows (DPAPI via Electron safeStorage), handled outside this file.
 *
 * The recovery key is never written anywhere; only a wrap that needs it to be opened is stored.
 * Losing both the password and the recovery key makes the contents unrecoverable, by design.
 */
export interface Box {
  iv: string
  tag: string
  data: string
}

export interface VaultFile {
  format: 'wincat-vault'
  version: 1
  kdf: { N: number; r: number; p: number; saltPw: string; saltRec: string }
  wrapPw: Box
  wrapRec: Box
  /** master key protected by the Windows account (safeStorage), base64 - optional */
  wrapOs?: string
  /** folder names kept readable while locked, only if the user chose that */
  names?: string[]
  body: Box
}

const N = 1 << 15
const R = 8
const P = 1
const b64 = (b: Buffer) => b.toString('base64')
const fromB64 = (s: string) => Buffer.from(s, 'base64')

function derive(secret: string, salt: Buffer, n = N, r = R, p = P): Buffer {
  if (n > 1 << 20 || r > 16 || p > 4 || n < 1024) throw new Error('bad parameters')
  return scryptSync(secret.normalize('NFKC'), salt, 32, { N: n, r, p, maxmem: 128 * n * r * 2 })
}

function seal(key: Buffer, plain: Buffer | string): Box {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([c.update(plain), c.final()])
  return { iv: b64(iv), tag: b64(c.getAuthTag()), data: b64(data) }
}

function unseal(key: Buffer, box: Box): Buffer {
  const d = createDecipheriv('aes-256-gcm', key, fromB64(box.iv))
  d.setAuthTag(fromB64(box.tag))
  return Buffer.concat([d.update(fromB64(box.data)), d.final()])
}

// ---------- recovery key ----------
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** 20 random bytes as 32 base32 characters in 8 groups of 4 (about 160 bits). */
export function newRecoveryKey(): string {
  const bytes = randomBytes(20)
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  return out.match(/.{4}/g)!.join('-')
}

/** forgiving input: case, spaces and dashes do not matter */
export function normalizeRecoveryKey(s: string): string {
  return s.toUpperCase().replace(/[^A-Z2-7]/g, '')
}

// ---------- create / open ----------
export function createVault(password: string, body: string, names?: string[]): { file: VaultFile; recoveryKey: string; master: Buffer } {
  if (password.length < 8) throw new Error('Use a password of at least 8 characters')
  const master = randomBytes(32)
  const recoveryKey = newRecoveryKey()
  const saltPw = randomBytes(16)
  const saltRec = randomBytes(16)
  const file: VaultFile = {
    format: 'wincat-vault',
    version: 1,
    kdf: { N, r: R, p: P, saltPw: b64(saltPw), saltRec: b64(saltRec) },
    wrapPw: seal(derive(password, saltPw), master),
    wrapRec: seal(derive(normalizeRecoveryKey(recoveryKey), saltRec), master),
    names,
    body: seal(master, body)
  }
  return { file, recoveryKey, master }
}

function openBody(file: VaultFile, master: Buffer): string {
  return unseal(master, file.body).toString('utf8')
}

const WRONG = 'Wrong password or damaged vault'

export function openWithPassword(file: VaultFile, password: string): { master: Buffer; body: string } {
  try {
    const master = unseal(derive(password, fromB64(file.kdf.saltPw), file.kdf.N, file.kdf.r, file.kdf.p), file.wrapPw)
    return { master, body: openBody(file, master) }
  } catch {
    throw new Error(WRONG)
  }
}

export function openWithRecovery(file: VaultFile, recoveryKey: string): { master: Buffer; body: string } {
  try {
    const master = unseal(derive(normalizeRecoveryKey(recoveryKey), fromB64(file.kdf.saltRec), file.kdf.N, file.kdf.r, file.kdf.p), file.wrapRec)
    return { master, body: openBody(file, master) }
  } catch {
    throw new Error('Wrong recovery key or damaged vault')
  }
}

export function openWithMaster(file: VaultFile, master: Buffer): string {
  try {
    return openBody(file, master)
  } catch {
    throw new Error(WRONG)
  }
}

/** write new contents (fresh random IV every time) */
export function resealBody(file: VaultFile, master: Buffer, body: string, names?: string[]): VaultFile {
  return { ...file, names, body: seal(master, body) }
}

/** change the password; the recovery key and the contents stay valid */
export function rewrapPassword(file: VaultFile, master: Buffer, newPassword: string): VaultFile {
  if (newPassword.length < 8) throw new Error('Use a password of at least 8 characters')
  const saltPw = randomBytes(16)
  return { ...file, kdf: { ...file.kdf, saltPw: b64(saltPw) }, wrapPw: seal(derive(newPassword, saltPw, file.kdf.N, file.kdf.r, file.kdf.p), master) }
}

const isBox = (b: unknown): b is Box => !!b && typeof (b as Box).iv === 'string' && typeof (b as Box).tag === 'string' && typeof (b as Box).data === 'string'

export function validateVaultFile(raw: unknown): VaultFile | null {
  const f = raw as Partial<VaultFile> | null
  if (!f || f.format !== 'wincat-vault' || f.version !== 1 || !f.kdf || !isBox(f.wrapPw) || !isBox(f.wrapRec) || !isBox(f.body)) return null
  if (typeof f.kdf.saltPw !== 'string' || typeof f.kdf.saltRec !== 'string' || typeof f.kdf.N !== 'number') return null
  return {
    ...(f as VaultFile),
    names: Array.isArray(f.names) ? f.names.filter((n): n is string => typeof n === 'string').slice(0, 100) : undefined,
    wrapOs: typeof f.wrapOs === 'string' ? f.wrapOs : undefined
  }
}
