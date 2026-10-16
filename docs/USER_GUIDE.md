# Windows Cat Companion: user guide

A little pixel cat that lives on your desktop, plus a quiet toolbox for clipboard history, notes and snippets.
It never needs the internet, and your cat never gets hungry, sad or upset. Nothing bad happens if you ignore it.

## Getting started

1. Run the installer (or the portable file). Windows may say "protected your PC" because the app is not code-signed:
   choose **More info → Run anyway**.
2. The cat appears at the bottom of your screen. The app has no taskbar button: look for the cat icon in the
   **system tray** (bottom-right, maybe behind the ^ arrow). Right-click it for the menu, including **Quit**.

## Your cat

* **Click** the cat for the care menu: pet, treat, play, rest. **Double-click** to open Cat's Desk. **Drag** it anywhere.
* It wanders along the bottom of the screen, climbs the sides, hangs from the top, naps, chases your mouse and sits on
  top of your open windows. It holds still while your mouse is on it.
* Don't overdo it: too many treats, pets or play in a short time makes it sick, grumpy or hyper. It passes in seconds
  and never costs you anything.
* Caring for your cat raises its **bond level**, which unlocks hats, neckwear, colours, furniture, room decorations,
  and little finds. Nothing ever expires or is taken away.
* **Focus mode** (tray menu or `Ctrl+Alt+F`): the cat naps quietly with no bubbles, sounds or surprises.
* **Cat's own room:** from bond level 2 your cat asks once for a room of its own, a framed box on your desktop with
  wallpaper, a window, furniture and decorations that you can customize in **Cat's Desk → Cat → Room**.
  Say "Not now" and it keeps roaming; you can change your mind any time.

## Cat's Desk (double-click the cat, or `Ctrl+Alt+C`)

| Page | What it does |
| --- | --- |
| Home | Quick actions and your recent clipboard, snippets and notes. **Customize** to move, pin or hide widgets. |
| Clipboard | A temporary history of what you copy (off until you turn it on). Click an item to copy it back. Pasting is always up to you. |
| Notes / Snippets | Plain-text or Markdown notes and click-to-copy snippets, with folders and favorites. Snippets can have `{placeholders}`; `{date}` and `{time}` fill in automatically. |
| Private | Notes and snippets encrypted with their own password (see below). |
| Cat | Care, personality, sounds, wardrobe, room, collection and achievements. |
| Settings | Theme, text size, density, reduced motion, keyboard shortcuts, backups and snapshots. |

Press `Ctrl+K` to search all notes and snippets. `Esc` closes the desk.

## Quick picker (`Ctrl+Alt+V`)

Opens a small search box over whatever you are doing. Type, use the arrow keys, press **Enter** to copy a snippet, note
or recent copy, then paste it yourself. `Esc` closes it. Change any shortcut in **Settings → Keyboard shortcuts**.

## Clipboard privacy

* Clipboard capture is **off** each time you start the app. Turn it on in the Clipboard page, or with `Ctrl+Alt+P`.
* History is kept in memory only, up to 500 items, and disappears when you quit.
* If something you copy looks like a password or key, the app holds it and asks before keeping it. It never shows the
  text in the warning. Detection is a guess, not a guarantee. You can add your own patterns.

## Private vault

Create it in **Private**. You choose a password and get a **one-time recovery key**. Write it down and keep it off
this computer. If you lose both the password and the recovery key, the notes cannot be recovered by anyone. The vault
locks after a few idle minutes and when Windows locks. It is never part of search, the picker or backups.

## Backups

**Settings → Backup & restore** exports your notes, snippets, cat progress and settings to a file, optionally protected
with a password (there is no recovery if you forget it). Restoring can **merge** (keeps what you have and lets you
review differences) or **replace**. A safety snapshot is saved automatically about daily and before every restore.

## Uninstalling

The uninstaller asks whether to delete your notes and cat progress. Choose **No** to keep them for a future reinstall.

More detail on privacy and security: [SECURITY.md](SECURITY.md).
