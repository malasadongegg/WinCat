# Implementation Status

## SPEC CHANGE (2026-10-16, user decision): 2D cat instead of 3D
The user prefers a 2D desktop-pet cat that "lives inside the computer". The React Three Fiber / Three.js requirement from the spec is dropped; three, @react-three/fiber and the 3D room were removed. The cat is now a vector SVG (`renderer/src/cat/Cat2D.tsx`, CSS animation in `cat.css`) with no room box: the window is transparent and click-through except over the cat, its care buttons and the panel. Sprite/art can replace the SVG later. Renderer JS bundle dropped from 2.7 MB to ~0.6 MB. The cozy room/furniture/day-night items in the spec are on hold until a 2D equivalent is designed.

### Desktop-pet architecture (2026-10-16, DPET-style)
- Two windows: a transparent, click-through, non-focusable overlay covering the primary display's work area (`?view=pet`), and the Cat's Desk panel window (`?view=panel`, hidden when closed). Main process is the single source of truth and broadcasts companion/low-power state to both.
- The cat (112 px) walks along the bottom edge, climbs the left/right screen edges, crawls along the top edge, falls with gravity, and can be dragged anywhere (drops and lands when released). Personality changes pace/climb tendency. Pure movement engine in `renderer/src/pet/engine.ts` (5 unit tests: stays on-screen, climbs, lands, freezes during reactions).
- Verified by scripted run: cat spawns, lands, walks, panel toggles beside the cat, a pet request from the panel animates the cat on the overlay. NOT verified by hand: climbing/ceiling/falling visuals, drag feel, click-through over other apps, multi-monitor (overlay covers the primary display only), DPI scaling.
- Art (2026-10-16, pixel style like vscode-pets): the SVG cat was replaced by a side-view 32x32 pixel-art black cat drawn procedurally in code (`cat/catSprites.ts`, no external assets, nothing to license) and animated frame-by-frame by `cat/PixelCat.tsx`: 4-frame walk cycle, sitting with tail wag + blinks, happy petting (hearts), eating (fish), play (crouch/swat + rolling yarn), sleeping loaf (Zzz), falling, dangling when dragged; wall climbing and ceiling crawling reuse the walk frames rotated/flipped. Click-through is per-pixel (transparent sprite pixels pass clicks through). Low power slows the idle/sleep animation to 0.5 fps. The `ANIMS` table is the only contract, so hand-drawn PNG sheets can replace the generated frames later. Not verified by hand: climbing/ceiling/fall/drag appearance on real desktop.
- Fullscreen auto-hide now uses foreground-window geometry (covers its monitor, not shell/desktop, not our own pid) instead of SHQueryUserNotificationState. Dev-only env `WINCAT_NO_FULLSCREEN_HIDE=1` disables it for testing (if VS Code itself is in fullscreen the cat correctly hides).

### First-run welcome and README (2026-10-16)
- On the very first launch the cat says hello once and explains the two clicks (flag saved as `welcomed`; verified). Project `README.md` added for GitHub (what it is, develop/build commands, structure, status).

### Crash recovery, user guide, fresh installer (2026-10-16)
- If a window's renderer process crashes it is reloaded automatically (up to 5 times); verified by force-crashing the cat overlay (it came back). Data lives in the main process and on disk, so nothing is lost.
- `docs/USER_GUIDE.md` (plain-language guide, written to be shared with a friend) and `docs/SECURITY.md` (threat model).
- Installer and portable exe rebuilt with every feature above; packaged app smoke test passed (both windows load, no native-module warnings). Installer UI / uninstaller / another PC still NOT tested.

### Private vault (2026-10-16)
- Sidebar > Private: encrypted notes and snippets with their own password. scrypt + AES-256-GCM (Node crypto), random master key wrapped by the password AND by a one-time recovery key (never stored), optional Windows (DPAPI/safeStorage) unlock. Locks on demand, after idle minutes (default 5, configurable), on Windows lock-screen and on sleep; the master key buffer is zeroed on lock. Excluded from global search, picker, backups, snapshots and clipboard history; copies from the vault are wiped from the clipboard after 30 s. Folder names hidden while locked unless allowed. Delete needs typing DELETE.
- Verified in-app end to end: weak password refused, recovery key format, vault.json has no plaintext or recovery key, normal workspace unaffected, locked saves refused, wrong password refused, unlock by password / recovery key (typed loosely) / Windows, password change keeps recovery key, clipboard wipe, 1-minute auto-lock, delete confirmation, UI states. 89 unit tests (8 for the crypto core).
- NOT verified: lock-on-Windows-lock-screen and on-sleep events (wired to powerMonitor, not triggered), very large vaults. Threat model and limits: `docs/SECURITY.md`.

### Clipboard privacy settings (2026-10-16)
- Clipboard page > Privacy settings: switch built-in detection categories on/off, add your own patterns (plain text, `*` wildcard, case-insensitive; matches are held for review like any suspected secret), and set image limits (per image / total, MB, clamped 1-50 / 5-500). Applied immediately. Verified in-app and by 81 unit tests.
- Pattern matching is implemented WITHOUT regular expressions (bounded linear scan) after a test exposed catastrophic backtracking with a regex version; a test now guards against hostile text.
- Detection is still labelled as imperfect in the UI.

### Configurable hotkeys and Focus mode (2026-10-16)
- Settings > Keyboard shortcuts: click a shortcut and press new keys (Esc cancels, Backspace turns it off, reset to default). Four global hotkeys: open/close desk (Ctrl+Alt+C), quick picker (Ctrl+Alt+V), pause/resume clipboard capture (Ctrl+Alt+P, new), focus mode (Ctrl+Alt+F, new). Needs at least one modifier; duplicates and malformed keys are rejected; keys owned by another program are reported ("in use elsewhere"). Verified in-app (register/unregister, rejections, saved to disk). 73 tests. The pause hotkey press itself and the key-capture UI were not exercised with a real keyboard.
- Focus mode (tray, hotkey, Home button): the cat naps where it is, with no bubbles, sounds, finds or achievement popups; care menu still works; resumes when switched off. Verified in-app.

### Small finishing features (2026-10-16)
- Real pixel-cat tray icon (generated from the sprite, embedded as a PNG so packaging needs no extra files).
- "Start when I sign in to Windows" toggle in Settings (off by default; only offered for the installed app, never registers the dev build).
- Undo after deleting a note/snippet: a 10-second "Undo" bar re-creates it exactly (verified).
- Uninstall prompt (NSIS macro `build/installer.nsh`): when uninstalling - not on updates, not silently - the uninstaller asks whether to delete notes, snippets and cat progress (default: keep). The installer builds with it; I have NOT run the uninstaller UI.
- Packaged app re-checked: launches, both windows load, no native-module warnings.

### Backup, restore and snapshots (2026-10-16)
- Settings > Backup & restore: export notes, snippets, folders, cat progress/look/room and appearance (never clipboard history) as JSON, optionally password-encrypted (scrypt + AES-256-GCM via Node's crypto; wrong password/tampering fails cleanly; losing the password makes the file unrecoverable and the UI says so). Restore either MERGES (adds what is missing, keeps yours, shows differing items for you to resolve: keep mine / use backup / keep both; cat progress merges upward) or REPLACES (explicit confirmation). A safety snapshot is always saved before any restore.
- Automatic local snapshots about daily and before restores, in `snapshots/` under app data, trimmed oldest-first to a configurable cap (default 1 GB, min 50 MB), restorable from the list; snapshot names are validated (no path traversal).
- Verified in-app with stubbed file dialogs: plain + encrypted export (no plaintext leak), merge with conflict + keep-both, wrong/right password, replace, junk file rejected, snapshots list/create/cap/restore, traversal rejected, UI renders. 70 unit tests. NOT verified: the real native file dialogs, very large workspaces.

### Quick picker, bigger wardrobe, the cat's own room (2026-10-16)
- Click fix (Twitch pausing when the cat was clicked): hit area is now forgiving (any opaque pixel within ~9 px), the cat stands still while the pointer is over it or its menu is open, and click capture is toggled synchronously so the first click cannot leak to the app underneath. Real-mouse behaviour over a video NOT verified by me - please test on Twitch.
- Quick picker: global `Ctrl+Alt+V` (also tray + Home button) opens a small search window over snippets, notes and recent clipboard copies; arrows/Enter copy (template snippets ask for values first), Esc closes; it never pastes. Verified: opens, filters, plain-snippet Enter copies and closes, template form appears. Final template copy + Esc not re-verified after a test-script error.
- Wardrobe: new neckwear slot (scarf, bandana, bow tie, medal), 6 new hats (flower crown, headphones, sunglasses, wizard, Santa, halo), more collar/eye/fur colours; all unlock by level (existing levels unchanged). Verified visually.
- Cat's room (opt-in): at bond level 2 the cat asks once "Can I have my own room?" (Yes / Not now); accepting puts it in a framed pixel-art room box on the desktop (wall, floor, window with day/sunset/night/snow or follows the clock, rug, wall art, plants, lamp, night lighting and lamp glow) with your furniture inside; the cat is confined to the room (no climbing/perching), uses the furniture and still chases the pointer when it is over the room. Drag the room by its title bar; Decorate opens the desk; Leave returns the cat to roaming. Desk > Cat > Room has the toggle, sizes (small/medium/large), a live preview and all decor choices with unlock levels. Verified in-app: offer shown, accepting works, cat stayed inside the box for 160 samples, Leave works, screenshots of day and night rooms. 61 tests.

### Packaging (2026-10-16)
- `npm run dist` builds, into `dist/` (git-ignored): `WindowsCatCompanion-Setup-0.1.0.exe` (NSIS installer, choose folder, desktop + Start menu shortcuts, per-user so no admin needed) and `WindowsCatCompanion-Portable-0.1.0.exe` (no install). `npm run pack` makes only the unpacked folder for quick checks. App icon (`build/icon.ico`) is generated from the cat sprite. koffi's native binary is unpacked from the asar.
- Verified: the unpacked build launches on a fresh profile, loads both windows, no native-module warnings, writes settings. NOT verified: running the installer itself, install/uninstall flow, any other PC, antivirus reactions.
- Known gaps: executables are NOT code-signed (Windows SmartScreen will warn); no auto-update; uninstall keeps user data silently (the spec's keep/remove prompt is not built); tray icon is still a plain placeholder square; launch-at-sign-in not built.

### Cat life, chibi redraw, warm desk (2026-10-16)
- Look: sprites redrawn chibi (big round head, 3x3 sparkly eyes, chunky body, thick tail); 6-frame walk cycle with diagonal leg swing + bob; sit-down transition (settle frames) when stopping; sitting idle now includes ear twitch, sleepy/normal blinks, glances left/right; new faces (sleepy, surprised, angry, look L/R), hop, scratch frames. Sprite generator split into `cat/pixelGrid.ts` (toolkit) + `cat/catSprites.ts` (cat) + `cat/items.ts` (collectibles/furniture art). Previous version kept as `catSprites.v1.bak.txt`.
- Behavior ("too still" fix): shorter rests, hops, more walking, zoomies, cursor chase; personalities scale all of it; time-of-day mood (livelier mornings, sleepier nights); seasonal comments (local date only).
- Window perching: main polls EnumWindows (geometry only: rect + class name/visibility flags to skip shell/hidden windows, never titles or process names) and sends top edges to the overlay; the cat leaps onto reachable window tops, walks along them, hops down, falls if the window moves/closes. Toggle in Cat > Overview. Verified: detects an external Notepad window.
- Furniture: yarn ball (L1), bed (L2), cardboard box (L3), scratching post (L4); place/remove/drag on the desktop floor (Cat > Room); the cat walks to them and naps / sits in the box (front panel covers it) / scratches / bats the ball. Positions stored as screen fractions; main validates type, unlock level, uniqueness, cap of 8.
- Collectibles: 13 kinds (seasonal ones only in season); the cat occasionally finds one while wandering; click to pick up or it joins the collection automatically after 60 s. Collection grid in Cat > Collection.
- Achievements: 20 gentle milestones (stats are whitelisted counters), unlock bubble, list in Cat > Achievements. No timers, streaks or expiry.
- Desk: warm cat-themed palette (amber accent, cream light theme), paw-print sidebar, live mini cat, Cat page split into Overview / Wardrobe / Room / Collection / Achievements.
- Weather moods NOT built: needs a network weather service, which conflicts with local-first; could be added as an explicit opt-in.
- Verified in the running app (real windows, scripted): perching detects an external window's top edge, the cat leaps/drops onto it (stood at exactly top-minus-half-cat-height, ~50 s on average at curious), counts the stat, and falls back to the floor when the window closes; it visits and uses the bed/box/post, finds and collects items, unlocks achievements (bubble shown), and furniture/collection/room pages render. Windows behind a full-screen or covering window are ignored. NOT verified: drag-to-arrange furniture with the mouse, climbing wall -> ceiling -> drop onto window in the app (unit tested only), multiple monitors.
- Tests: 57 unit tests (engine incl. perching/furniture/hops/ceiling drop + a randomized simulation, overdo, catlife, search, workspace).

### Cat's Desk redesign, notes/snippets, overdoing (2026-10-16)
- Desk: left sidebar (Home, Clipboard, Notes, Snippets, Cat, Settings) + global search (Ctrl+K) over notes and snippets only (filters: type, folder, date, favorites). Clipboard history is never indexed/saved; a clipboard item can be saved as a snippet on purpose.
- Notes (plain/Markdown with safe renderer, edit/preview) and snippets (click-to-copy, `{placeholder}` templates, `{date}`/`{time}` built in) with folders, favorites and autosave. Stored in `workspace.json` via atomic writes + `.bak`; unreadable file is renamed aside, backup restored, notice shown. Unit tests: workspace ops, search, templates, ui settings (34 -> 39 total with overdo).
- Home widgets (quick actions, recent clipboard, snippets, recent notes, performance): customize with move up/down, pin, hide. Settings page: theme (system/dark/light/high contrast), text size, density, reduce motion (also calms the cat), larger targets, low power.
- Cat interaction: single click = care menu (pet/treat/play/rest, auto-closes after 5 s), double-click = Cat's Desk (verified with real mouse events). Menu no longer opens on hover.
- Overdoing (user request, designed to respect the no-punishment rule): 4 treats within 5 min -> pukes (warning on the 3rd); 12 pets within 30 s -> grumpy, hisses and stalks off (warning at 8); 4 plays within 90 s -> zoomies then tired panting (warning at the 3rd). Only comes from spamming; no bond is awarded for the overdone action, nothing is lost, nothing persists or happens while away; a puddle fades by itself after 20 s. Tracker is pure and unit-tested (`shared/overdo.ts`); verified end-to-end in the app.
- NOT done: keyboard picker hotkey, backup/restore, private folders, folder-wide drag/drop, undo for delete.

### Sounds, behaviors, wardrobe (2026-10-16)
- Decisions (user): sounds quiet by default (off until enabled); chase cursor sometimes; primary monitor only; wardrobe unlocked by bond level.
- Sounds: synthesized with Web Audio (`audio/sfx.ts`): meow, purr, chirp, munch, squeak, sigh. Off by default, volume slider, tray toggle, silent while the overlay is hidden (fullscreen apps). AudioContext confirmed running in Electron; actual audio quality NOT heard by me.
- Behaviors: lick, stretch, zoomies (run + wall bounce), cursor chase with pounce (pointer position kept in memory only, only while it moves over the overlay, never stored), calm cats nap by themselves at night (22:00-06:00) and wake on their own. Personality scales zoomies/chase. 23 engine/shared tests pass.
- Wardrobe: collar/eye/fur colours and accessories (bow, glasses, party hat, crown) unlock by level (`shared/cosmetics.ts`); main process rejects locked items (verified: bond 100 accepted purple collar + violet eyes, rejected level-6 cream fur + crown; bond 0 rejected everything locked). Level-up shows a gentle bubble listing new items. Colours/hats verified in screenshots.
- NOT done: mouse-follow without click, window-edge perching, multi-monitor, more furniture/room, achievements, notes/snippets.

### Companion layer (2026-10-16)
- Pet / treat / play / rest (hover buttons on the cat, or the Cat tab), distinct expressions (happy eyes + hearts, munching + fish, yarn chase + paw swat, sleeping + Zzz), speech bubbles (toggleable), personality presets (change idle lines, bubble frequency, tail speed), bond level that only ever increases, friendly greeting on launch. No needs, decay or penalties by design.
- Verified: 15 unit tests, screenshots of all five states. NOT verified by hand: click-through behaviour, hover bar, bubbles timing. Sound, accessories, collectibles, achievements, furniture, walking around the desktop: not built.

## Earlier milestone (3D prototype, superseded): M1 — Electron shell + R3F prototype (done, partly verified)

### Implemented
- Electron + React + TypeScript (electron-vite), sandboxed renderer, contextIsolation, narrow preload API, IPC inputs validated in main, CSP set.
- Frameless transparent always-on-top window, collapsed (cat + room) and expanded (Cat's Desk) states; bottom-right anchored, clamped to display work area.
- Drag vs click distinction (4 px threshold); placement saved per display id in `settings.json` (atomic write).
- Tray menu (open desk, show/hide cat, low-power, quit), `Ctrl+Alt+C` global hotkey, `Esc` closes panel, single-instance lock (second launch focuses the panel).
- (superseded) Procedural R3F cat (blink, look-around, breathing, tail sway, collar) in a room (bed, cushion, scratching post, window, toy ball, day/night by clock). Cat is isolated in `scene/CatScene.tsx` for later replacement by a rigged glTF.
- Low-power mode: demand frameloop at 12 fps, DPR 1, no shadows/AA, simpler tail.
- Overview widget showing live fps, app CPU and memory.

### Verified (this machine, Windows 10)
- `tsc --noEmit` clean; `vitest` 3/3 (window clamping); production build succeeds.
- App launches; screenshot confirms scene + dashboard render.
- Measured via smoke run: normal 144 fps / 1.9 % CPU / ~323 MB; low-power 12 fps / 0.3 % CPU / ~332 MB (single short sample, not a benchmark; GPU not measured).

### Clipboard history (M2, built 2026-10-16)
- Session-only history (500 cap, dedupe-to-top with copy count, pin, remove, clear), categories text/code/link/image, image per-image/total limits with over-limit flag, suspected-secret review (content never shown or stored until the user chooses Keep), capture OFF by default each launch, tray + panel pause, history cleared on quit.
- Electron 44 has only the async web-style clipboard API (no readImage/readText sync); the service polls `clipboard.read()` every 500 ms.
- Tests: 11 unit tests pass (history, categorize, sensitive). Smoke run against the real clipboard confirmed: off-by-default, no capture while off, dedupe, link category, secret held pending then discarded, image captured, copy-back without re-capture.
- NOT done: configurable global pause hotkey, user-defined sensitive patterns, configurable limits UI, image thumbnails untested visually (test image was 1x1), keyboard navigation of the list beyond default focus, snippets/notes/search.

### Manually verified by user (2026-10-16)
- Drag (doesn't open panel), click, Ctrl+Alt+C, Esc, tray menu, fullscreen auto-hide, low-power checkbox all work.

### NOT yet verified / not implemented
- Tray icon is a generated placeholder; tray clicks, hotkey, drag, multi-monitor, DPI scaling untested by hand.
- Transparent window still captures clicks on its transparent area (no click-through yet).
- Fullscreen auto-hide implemented (SHQueryUserNotificationState via koffi). Focus mode, auto low-power adaptation, GPU metrics: not started.
- Notes, snippets, search, privacy/encryption, backups, installer, updates, personality/progression: not started (dashboard tabs are labelled placeholders).
- No rigged cat asset chosen; license review pending (procedural prototype in use).
- Renderer bundle is 2.7 MB (three.js); code-splitting is a later concern.

### Notes
- `ELECTRON_RUN_AS_NODE=1` is set inside VS Code terminals and makes `electron` run as plain Node; unset it to launch (`unset ELECTRON_RUN_AS_NODE`).
- Settings storage is a plain JSON file for now; the database choice for Phase 2 (likely SQLite) is still open.

### Next
1. Manually test tray, hotkey, drag, and multi-monitor; fix click-through on transparent areas.
2. Fullscreen detection + auto-hide; focus mode.
3. Phase 2: clipboard capture service with session history and pause.

## Commands
- `npm run dev` — dev with HMR; `npm run build` then `npm start` — preview build
- `npm run typecheck`, `npm test`
