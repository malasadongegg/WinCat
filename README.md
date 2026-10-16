# Windows Cat Companion

A pixel-art cat that lives on your Windows desktop, with a quiet, privacy-first toolbox: clipboard history,
notes, snippets, an encrypted private vault, backups and a keyboard quick-picker. Everything is local; the app
makes no network requests.

* The cat walks along the taskbar edge, climbs the screen sides, hangs from the top, naps, chases your mouse, sits on
  your open windows and can live in a customizable room of its own.
* You care for it with pets, treats and play (too much of any one gets a funny reaction, never a penalty).
  It has no needs, nothing decays, and nothing happens while the app is closed.
* Bond level unlocks hats, neckwear, colours, furniture, room decorations, finds and achievements.

Read the [user guide](docs/USER_GUIDE.md) and the [security and privacy notes](docs/SECURITY.md).
Project status, decisions and verification notes are in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).

## Develop

Requires Node 22+ and Windows 10/11.

```powershell
npm install
npm run dev        # run with hot reload
npm run typecheck  # TypeScript
npm test           # unit tests (vitest)
npm run dist       # build the installer + portable exe into dist/
```

If you start the app from a VS Code terminal and it crashes immediately with
`Cannot read properties of undefined (reading 'requestSingleInstanceLock')`, run
`Remove-Item Env:ELECTRON_RUN_AS_NODE` first: VS Code sets that variable and it makes Electron behave like plain Node.

## How it is built

Electron (main process + sandboxed renderers) with React and TypeScript, built with electron-vite.
The cat and room art is drawn procedurally in code (no image or audio assets); sounds are synthesized with the Web Audio API.

| Folder | Contents |
| --- | --- |
| `src/main` | windows, tray, hotkeys, clipboard capture, notes storage, backups, private vault, window detection |
| `src/preload` | the small, typed bridge between the main process and the windows |
| `src/renderer` | the desktop overlay (the cat), the Cat's Desk, the quick picker |
| `src/shared` | pure logic shared by both sides: companion rules, wardrobe, room, search, backups, validation (heavily unit-tested) |

## Status

Windows only. The installer is not code-signed, so SmartScreen shows a warning on first run. No auto-update yet.
