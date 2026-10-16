import { describe, expect, it } from 'vitest'
import { createVault, newRecoveryKey, normalizeRecoveryKey, openWithMaster, openWithPassword, openWithRecovery, resealBody, rewrapPassword, validateVaultFile } from './vaultCrypto'

const BODY = JSON.stringify({ items: [{ title: 'bank pin', body: 'hunter2-top-secret' }] })

describe('private vault crypto', () => {
  it('creates a vault that opens with the password and with the recovery key', () => {
    const { file, recoveryKey, master } = createVault('correct horse battery', BODY)
    expect(openWithPassword(file, 'correct horse battery').body).toBe(BODY)
    expect(openWithRecovery(file, recoveryKey).body).toBe(BODY)
    expect(openWithMaster(file, master)).toBe(BODY)
  })
  it('the file never contains the contents, password or recovery key', () => {
    const { file, recoveryKey } = createVault('correct horse battery', BODY)
    const text = JSON.stringify(file)
    expect(text).not.toContain('hunter2')
    expect(text).not.toContain('bank pin')
    expect(text).not.toContain('correct horse')
    expect(text).not.toContain(recoveryKey)
    expect(text).not.toContain(normalizeRecoveryKey(recoveryKey))
  })
  it('wrong password / recovery key / tampering all fail with a clear message', () => {
    const { file } = createVault('correct horse battery', BODY)
    expect(() => openWithPassword(file, 'wrong password!!')).toThrow('Wrong password or damaged vault')
    expect(() => openWithRecovery(file, 'AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA')).toThrow('Wrong recovery key')
    const flipped = { ...file, body: { ...file.body, data: Buffer.from('x'.repeat(40)).toString('base64') } }
    const { master } = openWithPassword(file, 'correct horse battery')
    expect(() => openWithMaster(flipped, master)).toThrow()
  })
  it('recovery keys are random, well-formed and typed forgivingly', () => {
    const a = newRecoveryKey()
    const b = newRecoveryKey()
    expect(a).toMatch(/^([A-Z2-7]{4}-){7}[A-Z2-7]{4}$/)
    expect(a).not.toBe(b)
    const { file, recoveryKey } = createVault('long enough pw', BODY)
    expect(openWithRecovery(file, recoveryKey.toLowerCase().replace(/-/g, ' ')).body).toBe(BODY)
  })
  it('saving uses a fresh IV and keeps the vault openable', () => {
    const { file, master } = createVault('long enough pw', BODY)
    const next = resealBody(file, master, '{"items":[]}')
    expect(next.body.iv).not.toBe(file.body.iv)
    expect(openWithPassword(next, 'long enough pw').body).toBe('{"items":[]}')
  })
  it('changing the password keeps the contents and the recovery key working', () => {
    const { file, recoveryKey, master } = createVault('old password 1', BODY)
    const changed = rewrapPassword(file, master, 'new password 2')
    expect(() => openWithPassword(changed, 'old password 1')).toThrow()
    expect(openWithPassword(changed, 'new password 2').body).toBe(BODY)
    expect(openWithRecovery(changed, recoveryKey).body).toBe(BODY)
  })
  it('refuses weak passwords and hostile cost parameters', () => {
    expect(() => createVault('short', BODY)).toThrow('at least 8')
    const { file } = createVault('long enough pw', BODY)
    expect(() => openWithPassword({ ...file, kdf: { ...file.kdf, N: 1 << 30 } }, 'long enough pw')).toThrow()
  })
  it('validates files from disk', () => {
    const { file } = createVault('long enough pw', BODY, ['Work'])
    expect(validateVaultFile(JSON.parse(JSON.stringify(file)))?.names).toEqual(['Work'])
    expect(validateVaultFile({ format: 'nope' })).toBeNull()
    expect(validateVaultFile(null)).toBeNull()
  })
})
