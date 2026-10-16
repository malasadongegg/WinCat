# Claude Code Master Prompt — Windows Cat Companion

You are a senior Windows desktop application engineer, React/TypeScript developer, 3D interaction designer, and software architect.

Your task is to **build a real, working Windows desktop application called Windows Cat Companion**, following the product specification provided below or in the attached `windows-cat-companion-spec.md` file.

This is a real development project, not a mockup exercise. You must create working code, install and configure dependencies as appropriate, run the application, test important behavior, and fix errors you encounter.

## 1. First, inspect the project

Before writing code:

1. Inspect the current working directory, files, Git status, package configuration, and existing implementation.
2. If a product specification file is available, read it completely.
3. If the repository already contains code, understand it before modifying anything. Preserve working features and avoid unnecessary rewrites.
4. Identify the operating system, available tools, installed runtimes, and any relevant project constraints.
5. Determine whether this is a new project or an existing project that needs to be continued.
6. Give me a concise summary of the current state and the first implementation milestone.

Do not ask me to repeat decisions already established in the specification.

If a necessary technical detail is undecided, choose a sensible, maintainable default, document the choice, and continue unless it would create a significant security risk, irreversible change, or major architectural commitment.

## 2. Required technology stack

Use the following stack:

- **Desktop application:** Electron
- **Frontend:** React + TypeScript
- **3D rendering:** React Three Fiber + Three.js
- **Platform:** Windows desktop
- **Distribution:** Standard Windows installer
- **Persistence:** A robust local storage/database solution chosen after considering reliability, maintenance, and encryption requirements
- **Architecture:** Modular, typed, testable, and maintainable

Do not replace this stack without identifying a concrete technical blocker and explaining it first.

Do not build the app as a website pretending to be a desktop app.

## 3. Product vision

Build a polished desktop utility featuring a sleek, cute, stylized 3D black cat that lives in a cozy miniature room and expands into a desktop control surface.

The app must combine two equally important goals:

1. A distinctive, expressive real-time 3D cat companion.
2. A genuinely useful local productivity utility.

The productivity features must remain usable even when the cat is hidden, animations are disabled, or low-power mode is active.

The first release must include a real-time 3D scene. Do not substitute a static image, emoji, or generic placeholder as the final character implementation.

## 4. Character and 3D requirements

Use React Three Fiber and Three.js to implement the 3D scene.

The intended character is a sleek black cat with expressive eyes, ears, tail, and body language.

Requirements:

- Use a ready-made, rigged 3D asset only if its license explicitly permits the intended distribution and use.
- Inspect the asset's rig, animations, file size, texture requirements, and license before committing to it.
- Never assume a model is free for redistribution merely because it is downloadable.
- If no suitable asset is available, build a temporary procedural prototype while keeping the character-loading system replaceable.
- Support idle, blink, look-around, tail movement, stretch, rest, greeting, and interaction reactions as the asset allows.
- Blend authored animations with lightweight procedural micro-reactions where practical.
- Make the character visually polished rather than relying on primitive geometry for the final result.
- Implement eye colors, markings, collars, ribbons, hats, glasses, charms, and other accessories as the architecture allows.
- Keep the signature black-cat identity as the default.

The room should contain a bed, cushions, toys, scratching post, and a window, with room for future furniture and themes.

Use subtle ambient lighting and day/night changes. Keep the scene performant and allow effects to be reduced.

## 5. Desktop window behavior

Implement the companion as a genuine Windows desktop utility.

Requirements:

- Collapsed state shows the cat and a small portion of its room.
- Expanding it reveals a wide, cozy control surface rather than a generic popup.
- Provide a characterful dashboard and a compact utility layout.
- Support dragging the cat to reposition it.
- Distinguish dragging from clicking so moving the cat does not accidentally open the panel.
- Remember preferred placement per monitor.
- Keep expanded panels within display bounds.
- Avoid unnecessary focus stealing.
- Support a system-tray menu.
- Closing the panel hides the panel; separate commands control hiding the cat or quitting the application.
- Provide configurable global hotkeys.
- A hotkey should focus an existing panel rather than create duplicate windows.
- Escape closes the active panel.
- Hide the cat automatically during fullscreen applications.
- Return the cat intelligently after fullscreen ends.
- Provide a manual focus mode and low-power mode.
- Do not monitor application identities or maintain application-usage histories.

Be careful with Electron transparent windows, click-through behavior, always-on-top settings, focus behavior, DPI scaling, and multi-monitor support. Prototype these early instead of assuming they will work perfectly.

## 6. Productivity features

### Clipboard history

Implement real clipboard capture, not mock data.

- Session-only history, capped at 500 items.
- Deduplicate matching items by moving the existing item to the top and incrementing its copy count.
- Remove the oldest eligible unpinned item when the cap is exceeded.
- Provide categories for text, code, links, images, and saved snippets.
- Allow capture to be paused from the system tray and a configurable keyboard shortcut.
- Show a clear paused indicator.
- Clear temporary clipboard history when the application exits.
- Do not include temporary clipboard history in backups.
- Selecting a history item copies it first.
- Pasting is a separate deliberate action so content is not accidentally sent to the wrong application.
- Support image clipboard entries with configurable per-image and total temporary-storage limits.
- Clear temporary image data on exit.
- Clearly indicate when an image exceeds a retention limit.

### Sensitive clipboard content

Implement configurable detection categories and user-defined patterns for possible secrets, such as passwords and tokens.

- Detection must be treated as imperfect.
- When content is suspected to be sensitive, ask whether the user wants to keep it.
- Do not display the suspected secret in the warning.
- Do not persist the item while waiting for the user's decision.
- Discard pending items if the application closes before a decision.
- Exclude suspected secrets from backups by default.
- Allow capture to be paused immediately.
- Do not claim that detection can identify every secret.

### Persistent snippets and notes

Implement:

- Persistent snippets separate from temporary clipboard history.
- Plain-text notes.
- Markdown notes with code blocks.
- Folders and collections.
- Favorites.
- Global search across persistent content.
- Search filters for content type, folder, date, and favorites.
- Click-to-copy snippets.
- A keyboard-driven picker.
- Optional reusable templates and placeholders.
- Optional suggestions for frequently copied content, requiring explicit approval before saving.

Do not index temporary clipboard history or suspected secrets in persistent global search.

### Cat's Desk dashboard

Create a useful, customizable overview containing:

- Recent clipboard items.
- Saved snippets.
- Recent notes.
- Quick actions.
- Configurable widgets.
- Pinning, rearranging, and hiding widgets.

Use compact tabs plus an overview. The interface should be polished, readable, keyboard-friendly, and fast.

## 7. Cat personality and progression

Implement the companion as a persistent character rather than a collection of disconnected animations.

Personality presets:

- Playful
- Curious
- Affectionate
- Sleepy
- Balanced

Include:

- Time-based morning, afternoon, evening, and night behavior.
- Adaptive idle behavior.
- Resting and return greetings.
- Petting and toy interactions.
- Optional treats and rest controls.
- Subtle sound categories for meows, purring, interaction effects, and room ambience.
- Occasional speech bubbles.
- Levels, bond, achievements, collectibles, and user-created goals.
- Unlockable cosmetics, furniture, room themes, animations, and additional spaces.
- Furniture placement, rotation, alignment guides, optional grid snapping, and named layouts.

There must be no urgent needs, decay, distress, missed-routine penalties, or punishments while the app is closed.

Do not implement progression as an intrusive reward loop. The companion must not interfere with work.

## 8. Performance and accessibility

### Performance

Implement both automatic adaptation and a manual low-power toggle.

When system resources are constrained, reduce:

- Frame rate.
- Animation complexity.
- Lighting and shadows.
- Ambient room effects.
- Rendering frequency while idle or hidden.

Do not track which applications are running to determine workload. Base adaptation on system resource pressure and existing fullscreen/focus signals.

Keep the productivity interface responsive when the 3D scene is throttled, hidden, or disabled.

Measure actual CPU, GPU, memory, and frame performance. Do not claim that performance is optimized until it has been measured.

### Accessibility

Provide:

- Full keyboard navigation.
- Configurable shortcuts.
- Scalable text.
- Visible focus indicators.
- Screen-reader-friendly controls.
- Reduced motion.
- High contrast.
- Reduced visual effects.
- Adjustable interface density.
- Adjustable animation intensity.
- Larger interaction targets.

Accessibility settings and focus mode must override decorative effects.

## 9. Privacy and data protection

The application is local-first.

- No account or cloud sync in v1.
- No keylogging.
- No screenshot monitoring.
- No broad application-usage surveillance.
- No clipboard contents in logs or notification previews.
- Diagnostics stay local and are deletable.
- Do not expose privileged Electron APIs directly to the renderer.
- Validate IPC inputs and treat clipboard content as untrusted data.

### Hybrid protection for persistent data

- Ordinary workspace data uses standard local storage.
- Support private folders and dedicated private collections.
- Private collections require a separate unlock while the ordinary workspace opens normally.
- Private contents lock after a configurable inactivity timeout.
- Support manual locking.
- Allow collection-name visibility to be configured while locked.
- Provide a recovery key and Windows-backed protection where technically supported.
- Explain that losing the password and all valid recovery methods may make encrypted content unrecoverable.
- Never store a recovery key beside the encrypted data it protects.

Do not invent cryptography. Use established, maintained cryptographic libraries and Windows protection APIs where appropriate. Document the threat model and security limitations.

### Backups and recovery

- Manual export/import.
- Normal backup files and password-encrypted backups.
- Include persistent notes, snippets, folders, collections, settings, cat progression, room layouts, and saved layouts.
- Exclude temporary clipboard history and suspected secrets by default.
- Support merge and replace restore.
- Show conflicts for review.
- Create a safety backup before a full replacement restore.
- Create local snapshots periodically and before risky operations.
- Make the snapshot storage cap configurable, with a sensible 1 GB default.
- Display snapshot usage and clean up older snapshots within the configured cap.
- Preserve recoverable data on corruption or failed writes.
- Attempt non-destructive repairs where possible.
- Ask before actions that could discard or overwrite user data.
- After a crash, recover persistent workspace safely and discard temporary clipboard history and pending sensitive items.
- Show a concise recovery notice.

### Uninstall

During uninstall, ask whether to keep or remove user data. Explain what each choice means and do not silently delete the workspace.

## 10. Installation, startup, and updates

- Use a standard Windows installer.
- Launch at Windows sign-in is optional and disabled by default.
- Do not silently enable clipboard capture or startup behavior.
- Stable release channel only for v1.
- Provide configurable manual, notify, or automatic update policy.
- Updates must preserve persistent workspace and progression.
- Use safe data migrations and recoverable update behavior.

## 11. Architecture expectations

Organize the application into clear modules, including:

1. Electron main process and window lifecycle.
2. React renderer and design system.
3. React Three Fiber scene and character controller.
4. Clipboard capture and sensitive-content review service.
5. Persistent workspace service.
6. Search service.
7. Privacy and encryption service.
8. Backup, snapshots, and recovery service.
9. Settings and hotkey service.
10. Diagnostics and update service.

Use strict TypeScript where practical, meaningful types, reusable components, predictable state management, and clear service boundaries.

Keep the 3D scene decoupled from the productivity services so rendering can be reduced without breaking the application.

Avoid unnecessary dependencies and overengineering. Document important architecture decisions.

## 12. Implementation strategy

Do not attempt to implement the entire specification in one enormous code change.

Work in phases.

### Phase 0 — Technical feasibility

- Inspect the project and environment.
- Confirm the cat asset's license and technical suitability.
- Prototype a React Three Fiber cat-and-room scene.
- Test Electron window transparency, tray behavior, dragging, fullscreen hiding, and multi-monitor bounds.
- Measure rendering performance.
- Select local persistence and storage technologies.
- Document major technical decisions and unresolved risks.

### Phase 1 — Desktop foundation

- Electron + React + TypeScript application.
- Window lifecycle and tray.
- Show/hide behavior and configurable hotkey.
- Basic settings and accessibility foundations.
- Multi-monitor positioning and fullscreen behavior.
- Standard installer setup.

### Phase 2 — Productivity core

- Clipboard history and cleanup.
- Capture pause/resume.
- Image limits.
- Sensitive-content review.
- Persistent snippets and notes.
- Folders, favorites, and global search.
- Cat's Desk dashboard.
- Keyboard navigation.

### Phase 3 — Companion experience

- Cat model and animations.
- Cozy room.
- Interactions and personality.
- Furniture and customization.
- Room layouts and progression.
- Adaptive rendering and low-power mode.
- Sound and configurable feedback.

### Phase 4 — Data protection

- Private folders and collections.
- Encryption and selective unlock.
- Recovery key workflow.
- Backup/restore and conflict review.
- Local safety snapshots.
- Crash and corruption recovery.
- Uninstall retention choice.

### Phase 5 — Release readiness

- Achievements and unlocks.
- Notification controls.
- Full accessibility pass.
- Installer/update testing.
- Performance and reliability testing.
- Privacy/security review.
- User-facing documentation.

## 13. Working rules for Claude Code

Follow these rules throughout development:

1. **Inspect before changing.** Never overwrite existing project work without understanding it.
2. **Build working software.** Do not stop after writing a plan, creating a mockup, or generating placeholder data.
3. **Work incrementally.** Implement one coherent milestone at a time.
4. **Run the code.** Use available commands to install dependencies, type-check, lint, test, and launch the app.
5. **Fix errors.** Do not leave obvious build or runtime errors unresolved.
6. **Be honest.** Clearly distinguish implemented, partially implemented, mocked, and untested features.
7. **No fake integrations.** Do not present simulated clipboard capture, encryption, backup, or system-tray behavior as real functionality.
8. **Protect user data.** Do not delete user files, reset databases, overwrite backups, or run destructive migrations without explicit approval.
9. **Avoid unnecessary questions.** Make reversible technical decisions yourself and document them.
10. **Maintain a project log.** Keep a concise `IMPLEMENTATION_STATUS.md` with completed work, current milestone, tests run, known issues, and next steps.
11. **Update documentation.** Include setup instructions, development commands, architecture notes, and packaging instructions.
12. **Do not overclaim.** Report exactly what was tested and what remains unverified.
13. **Preserve the specification.** If implementation constraints require a change, explain the trade-off and record it rather than silently changing the product.

## 14. First action

Start by inspecting the project and reading `windows-cat-companion-spec.md` if it exists.

Then:

1. Summarize the current repository and environment.
2. Identify the largest technical risks.
3. Propose the smallest useful implementation milestone.
4. Begin implementing that milestone immediately after the inspection.
5. Run the relevant checks and fix issues.
6. Report changed files, commands executed, test results, and the next milestone.

Do not stop after giving me a plan. **Inspect, implement, test, and iterate.**

---

# Product specification

Use the attached `windows-cat-companion-spec.md` as the authoritative source for detailed requirements and decisions. If it is unavailable, ask me to provide it before making major assumptions about features.

Keep the first milestone small and complete: a working Electron shell, one dashboard, a real-time React Three Fiber cat-and-room prototype, basic window/tray behavior, and a measured low-power control. Then build the utility core and expand incrementally.