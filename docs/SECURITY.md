# Security and privacy notes

Windows Cat Companion is local-first. There is no account, no cloud sync and no telemetry, and the app makes
no network requests. This document says what is protected, how, and where the limits are.

## What the app reads, and what it never reads

| Thing | Behaviour |
| --- | --- |
| Clipboard | Capture is **off at every launch** until you turn it on. History is kept in memory only, capped at 500 items, never written to disk, never searched, never in backups, and cleared on exit. Possible secrets are held for your decision (not shown, not stored) before anything is kept. Detection is a heuristic and can miss things. |
| Keyboard | No keylogging. The only global key handling is the few hotkeys you configure (Electron `globalShortcut`), which are the only keys the app is told about. |
| Screen | No screenshots or screen monitoring. |
| Other apps | No app names, window titles or usage history are read or stored. Two features read **geometry only**: (1) window top-edges, so the cat can sit on windows; (2) whether the foreground window covers its whole monitor, to hide the cat during fullscreen apps. The mouse position is used only live while it moves over the cat overlay (to chase it) and is never stored or sent. |
| Network | None. |

## Where data lives

All data is under `%APPDATA%\windows-cat-companion\` (the app-data folder), as ordinary files:
`settings.json`, `workspace.json` (+ `.bak`), `vault.json` (+ `.bak`), and `snapshots\`.
Writes are atomic (temp file then rename) and the previous copy is kept as `.bak`. A file that cannot be read is
renamed aside, never deleted or overwritten.

Ordinary notes, snippets and settings are **not encrypted**, like any normal document on your disk. Use the private
vault for anything sensitive.

## Private vault

Private notes and snippets are stored in `vault.json`.

* **Primitives:** scrypt (N=32768, r=8, p=1) for key derivation and AES-256-GCM for encryption, both from Node's
  built-in `crypto`. No custom cryptography.
* **Structure:** a random 32-byte master key encrypts the vault contents. The master key is stored twice, wrapped by a
  key derived from your password and by a key derived from a random 160-bit **recovery key** that is shown once.
  Optionally it is stored a third time, wrapped by Windows (DPAPI through Electron `safeStorage`), if you turn on
  "unlock with my Windows account".
* **The recovery key is never stored.** Only a wrap that needs it to open is written. Losing both the password and the
  recovery key makes the contents permanently unrecoverable. That is intentional and the app says so.
* **Locking:** the vault locks on demand, after a configurable idle time (default 5 minutes), when Windows locks the
  screen, and when the PC sleeps. Locking zeroes the master key buffer and drops decrypted data from the app.
* **Exclusions:** vault contents are not part of global search, the quick picker, backups, snapshots or clipboard
  history. Text you copy from the vault is removed from the clipboard after 30 seconds (if it is still there).
* **Folder names** are hidden while locked unless you choose to show them.

### What it does not protect against

* Malware or another program running as you **while the vault is unlocked**, keyloggers, or screen capture.
* Someone looking at your screen while it is unlocked.
* Decrypted text lingering in process memory while unlocked: JavaScript strings cannot be reliably wiped, so only the
  key is zeroed.
* If you enable "unlock with my Windows account", anyone signed in to that account can open the vault.
* A weak password. Use a long passphrase; short ones can be guessed offline if someone copies `vault.json`.

## Backups and snapshots

* Backups contain notes, snippets, folders, the cat's progress and look, and appearance settings. They never contain
  clipboard history or the private vault.
* A backup can be password-encrypted with the same scrypt + AES-256-GCM scheme. A wrong password or any modification of
  the file fails the authentication check. There is no recovery if you forget the backup password.
* Restoring can merge (keeping what you have and showing differences for review) or replace (explicit confirmation).
  A safety snapshot is always taken first. Snapshots are plain files in the app-data folder, trimmed to a size cap.

## Electron hardening

* Renderer windows are sandboxed with context isolation; no Node access.
* The preload script exposes a small, typed API; every IPC input is validated in the main process (types, ranges,
  allow-lists). Unlock levels for cosmetics, furniture and room styles are enforced in the main process, not only in the UI.
* Clipboard content is treated as untrusted text: it is rendered as text, never as HTML, and Markdown notes are rendered
  to React elements (no raw HTML injection).
* Windows cannot open new windows or navigate away.

## Known limits

* Executables are not code-signed, so Windows SmartScreen will warn on first run.
* No automatic updates yet.
* Sensitive-content detection is heuristic.
