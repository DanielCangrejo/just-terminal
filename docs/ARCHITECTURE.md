# ARCHITECTURE.md
# PSExplorer — PowerShell Explorer Terminal

**Version:** 1.1.0
**Audience:** Contributors and maintainers

---

## Table of Contents

1. [Philosophy](#1-philosophy)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Frontend Architecture](#3-frontend-architecture)
4. [Backend Architecture (Rust)](#4-backend-architecture-rust)
5. [IPC Layer](#5-ipc-layer)
6. [Data Flow Diagrams](#6-data-flow-diagrams)
7. [State Management](#7-state-management)
8. [Terminal Subsystem Deep Dive](#8-terminal-subsystem-deep-dive)
9. [CWD Synchronization](#9-cwd-synchronization)
10. [Drag & Drop System](#10-drag--drop-system)
11. [Adding New Features](#11-adding-new-features)
12. [Error Handling](#12-error-handling)
13. [Code Style & Conventions](#13-code-style--conventions)
14. [Release Checklist](#14-release-checklist)

---

## 1. Philosophy

**Separation of concerns is non-negotiable.**
Rust backend owns all system operations. React frontend owns all UI. Neither reaches into the other's domain directly.

**IPC is the only bridge.**
Frontend never spawns processes or accesses native APIs directly. Everything goes through typed Tauri commands in `tauri-bridge.ts`.

**The terminal is a first-class citizen.**
Every architectural decision preserves terminal correctness. A broken ANSI sequence is more harmful than a missing UI feature.

**Fail gracefully, always.**
A crashed shell must not crash the app. Errors bubble to the user as readable toast notifications via `notification.store`.

**No premature abstraction.**
Rule of Three — abstract only when duplication appears three times.

---

## 2. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  React Frontend (WebView2 / WebKitGTK / WKWebView)                │
│                                                                   │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌──────────┐ ┌────────┐  │
│  │ Terminal │ │ Explorer │ │   Git   │ │ Session  │ │Settings│  │
│  │ (xterm)  │ │(FileTree)│ │ Graph   │ │  Store   │ │ Store  │  │
│  └────┬─────┘ └────┬─────┘ └────┬────┘ └────┬─────┘ └───┬────┘  │
│       └────────────┴────────────┴────────────┴───────────┘       │
│                               │                                   │
│                     ┌─────────▼──────────┐                        │
│                     │   tauri-bridge.ts  │  (typed invoke/listen) │
│                     └─────────┬──────────┘                        │
└───────────────────────────────┼──────────────────────────────────┘
                                │  Tauri IPC
┌───────────────────────────────┼──────────────────────────────────┐
│  Rust Backend                 │                                   │
│                     ┌─────────▼──────────┐                        │
│                     │     AppState       │  (Arc<Mutex<...>>)     │
│                     └─────────┬──────────┘                        │
│        ┌──────────┬───────────┴──────────┬────────────┐           │
│  ┌─────▼────┐ ┌───▼───┐  ┌──────────────▼─┐ ┌────────▼──────┐    │
│  │ Terminal │ │  FS   │  │      Git        │ │  Persistence  │    │
│  │ Manager  │ │  Ops  │  │  git2 + git_log │ │  (SQLite)     │    │
│  │(port-pty)│ │notify │  │  search_files   │ │               │    │
│  └─────┬────┘ └───────┘  └─────────────────┘ └───────────────┘    │
└────────┼───────────────────────────────────────────────────────────┘
         │  ConPTY (Windows) / Unix PTY (Linux, macOS)
┌────────▼─────────────────────┐
│  powershell.exe / CMD / WSL  │  Windows
│  $SHELL, zsh, bash, fish ... │  Linux, macOS
└──────────────────────────────┘
```

### 2.1 Boundary Rules

| Rule | Rationale |
|---|---|
| Frontend never imports `fs`, `path`, or native modules | WebView2 is sandboxed |
| Rust commands return serializable types only | IPC via serde_json |
| Events fire-and-forget from Rust | Frontend subscribes; Rust never waits for UI |
| AppState is single source of truth for backend | No global mutable state outside AppState |
| HTML5 Drag & Drop API not used | WebView2 `dataTransfer.getData()` unreliable in `onDrop` |

---

## 3. Frontend Architecture

### 3.1 Component Tree

```
App
├── useKeyBindings()          — global keyboard shortcuts + zoom
├── useApplySettings()        — applies CSS vars and --app-zoom
├── useActiveTerminalSync()   — syncs explorer CWD on tab switch
└── MainLayout
    ├── Sidebar
    │   ├── [Tab: Explorer]
    │   │   ├── Favorites          (resizable section)
    │   │   ├── ── drag handle ──
    │   │   ├── FileTreeToolbar    (new file, new folder, search, refresh)
    │   │   ├── FileTree
    │   │   │   └── FileTreeNode (recursive)
    │   │   ├── ── drag handle ──
    │   │   └── RecentDirs         (resizable section)
    │   └── [Tab: Source Control]
    │       └── GitGraphPanel
    │           ├── GitStatusBar
    │           └── GitGraph       (SVG lane visualization)
    │
    ├── TerminalTabBar             (VERTICAL left panel, 192px wide)
    │   ├── TabItem × N            (pinnable, renameable, drag-reorderable)
    │   └── SettingsPanel          (Radix Dialog)
    │
    └── TerminalArea
        ├── TerminalTab (active)
        │   └── TerminalPane
        │       ├── xterm.js canvas
        │       └── DragOverlay    (shown during DragManager drag)
        └── EmptyState + DragDropZone
```

### 3.2 Component Responsibilities

**`TerminalPane`** renders one xterm.js instance. It also renders a transparent `DragOverlay` during folder drags (see §10). Logic lives in `useTerminal`.

**`GitGraph`** renders the full commit graph as a single SVG (not per-row SVGs). Uses a lane-assignment algorithm similar to `git log --graph` with cubic bezier curves for smooth branch/merge lines.

**`FileTreeToolbar`** manages `ExplorerUIStore` mode: `idle | new-file | new-folder | search`. Inline inputs replace `window.prompt()`. Search uses Rust `search_files` (recursive, max 60 results, debounced 250ms).

**`TerminalTabBar`** is a **vertical** 192px panel on the left of the terminal area. Tabs support: right-click context menu (Pin, Rename, Close), drag reorder via `onMouseDown` + `onMouseEnter`.

**`tauri-bridge.ts`** is the only file that calls `invoke()` and `listen()`.

### 3.3 Rule: Dumb Components, Smart Hooks

Components render. Hooks orchestrate. No `invoke()` calls inside components — only in hooks or via `tauri-bridge.ts`.

```typescript
// ✅ Correct
function TerminalPane({ terminalId, shell, initialCwd }) {
  const { containerRef, ptyIdRef } = useTerminal(terminalId, shell, initialCwd)
  return <div ref={containerRef} />
}
```

---

## 4. Backend Architecture (Rust)

### 4.1 Module Responsibilities

```
src-tauri/src/
├── main.rs          → entry point
├── lib.rs           → AppState init, all command registration, setup hook
├── state.rs         → AppState struct
├── terminal/
│   ├── pty_manager.rs   → spawn(shell, args, env, cwd, app), write, resize, kill
│   ├── session.rs       → PtySession struct
│   └── commands.rs      → create_terminal(shell, args, env, cwd, ...) etc.
├── explorer/
│   ├── fs_ops.rs        → list_dir, create_file, delete_entry, search_files (recursive)
│   ├── watcher.rs       → FsWatcher with notify, emits "fs_change"
│   └── commands.rs
├── git/
│   ├── repository.rs    → get_status, get_log (CommitInfo with parents/refs), get_branches
│   ├── actions.rs       → fetch, pull, push, checkout, stash, stash_pop
│   └── commands.rs      → git_log(path, limit) added in v1.1
├── session/
│   ├── persistence.rs   → SQLite save/load SessionSnapshot
│   └── commands.rs
└── platform/
    ├── shells.rs        → detect(): shells available on this OS, with OSC 7 integration
    ├── integration.rs   → install(): writes shell-integration/ scripts to the app data dir
    └── commands.rs      → get_platform_info → { os, homeDir, shells }

src-tauri/shell-integration/   → bash/zsh startup scripts (embedded with include_str!)
```

### 4.2 Key Change: `create_terminal` now accepts `args`

Shell profiles include startup args (including OSC 7 injection). The command signature is:

```rust
#[tauri::command]
pub async fn create_terminal(
    shell: String,
    args: Vec<String>,    // ← new in v1.1
    env: Option<HashMap<String, String>>,  // ← extra env vars (e.g. ZDOTDIR for zsh)
    cwd: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<String, String>
```

### 4.3 New Commands in v1.1

| Command | Module | Purpose |
|---|---|---|
| `search_files` | `explorer` | Recursive file search (depth ≤ 8, max 60 results) |
| `git_log` | `git` | Returns `CommitInfo[]` with parents + refs for graph |
| `get_platform_info` | `platform` | OS, home dir and detected shell profiles (first = default) |

---

## 5. IPC Layer

### 5.1 tauri-bridge.ts — Actual Signatures

```typescript
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"   // ← listen is NOT in /core

// Terminal — shell args added in v1.1
export const createTerminal = (shell: ShellProfile, cwd: string) =>
  invoke<string>("create_terminal", {
    shell: shell.executable,
    args: shell.args ?? [],
    env: shell.env ?? null,
    cwd,
  })

// Platform — OS, home dir and detected shells, loaded once at startup
export const getPlatformInfo = () => invoke<PlatformInfo>("get_platform_info", {})

// Explorer — new in v1.1
export const searchFiles = (root: string, query: string) =>
  invoke<DirEntry[]>("search_files", { root, query })

// Git — new in v1.1
export const getGitLog = (path: string, limit?: number) =>
  invoke<CommitInfo[]>("git_log", { path, limit })
```

**Important:** `listen` must be imported from `@tauri-apps/api/event`, not `@tauri-apps/api/core`.

### 5.2 Tauri Capabilities

Capabilities live in `src-tauri/capabilities/default.json`. The `"capabilities": ["default"]` key must be present in `tauri.conf.json` under `app.security` or the permissions are not loaded.

Required permissions:
```json
{
  "permissions": [
    "core:default",
    "core:event:default",
    "core:event:allow-listen",
    "core:event:allow-unlisten",
    "core:event:allow-emit"
  ]
}
```

---

## 6. Data Flow Diagrams

### 6.1 User Types in Terminal

```
User keystroke
  → xterm.js onData(data)
    → useTerminal hook
      → writeInput(ptyId, data)        [tauri-bridge]
        → invoke("write_pty_input")    [IPC]
          → PtyManager.write_input()   [Rust]
            → PTY stdin                [OS]
              → powershell.exe         [Process]
```

### 6.2 Shell Output → Screen

```
powershell.exe writes stdout
  → PTY stdout pipe
    → PtyManager read loop (std::thread, 4KB chunks)
      → app.emit("pty_output_{id}", chunk)
        → onPtyOutput listener         [Frontend]
          → extractCwdFromOsc7(data)   [osc-parser.ts]
            → if CWD found: updateCwd + setCwd
          → term.write(data)           [xterm.js canvas]
```

### 6.3 User Drags Folder to Active Terminal

```
User holds mousedown on FileTreeNode (isDir=true)
  → DragManager.beginWatch(entry, x, y)   [lib/drag-manager.ts]
    → document mousemove listener starts
      → after 6px movement: DragManager active
        → notifies listeners via onStateChange()
          → TerminalPane shows DragOverlay   [z-index above xterm canvas]
          → MainLayout shows EmptyDropZone   [if no active terminal]

User releases mouseup over DragOverlay
  → DragOverlay.onMouseUp
    → DragManager.consume() → returns entry
      → writeInput(ptyId, `cd "${entry.path}"\r`)

User releases mouseup over EmptyDropZone
  → DragManager.consume() → returns entry
    → createTerminal(shell, args, entry.path)
      → addSession + setCwd
```

> **Note:** HTML5 Drag & Drop (`dataTransfer.getData`) is not used because WebView2 returns empty strings in `onDrop` handlers. The `DragManager` module uses native mouse events as a reliable alternative.

### 6.4 File System Change Detected

```
File changed on disk
  → notify watcher (Rust)
    → app.emit("fs_change", FsChangeEvent)
      → useFileWatcher hook
        → explorerStore.refresh()
          → FileTree re-renders
```

### 6.5 Tab Switch → Explorer Sync

```
User clicks different terminal tab
  → setActive(id)                      [terminals.store]
    → useActiveTerminalSync useEffect fires
      → reads sessions[activeId].cwd
        → explorerStore.setCwd(cwd)
          → FileTree shows new directory
```

---

## 7. State Management

### 7.1 Store Breakdown

| Store | Owns |
|---|---|
| `terminals.store` | sessions, order[], activeId, splits, pinned state |
| `explorer.store` | cwd, entries, expandedPaths, showHidden, watchedPath |
| `explorer-ui.store` | mode (idle/new-file/new-folder/search), searchQuery |
| `git.store` | statusByPath, logByPath (commit graph data) |
| `session.store` | favorites[], recentDirs[], quickCommands[], sidebarWidth, theme |
| `settings.store` | fontSize, fontFamily, zoom, activeThemeName, customVars |
| `notification.store` | toast notifications (5s auto-dismiss) |

### 7.2 New: terminals.store additions (v1.1)

```typescript
interface TerminalsState {
  sessions: Record<string, TerminalSession>
  order: string[]          // display order (separate from sessions object key order)
  activeId: string | null

  togglePin: (id: string) => void      // sets session.pinned
  renameTab: (id: string, title: string) => void
  reorder: (dragId: string, dropId: string | null) => void
}
```

Rendering order: pinned sessions always first, then unpinned in `order[]` sequence.

### 7.3 Rules

- Stores hold UI state only. No PTY buffers, no file blobs.
- Cross-store coordination goes in hooks (`useActiveTerminalSync`, `useGitStatus`, etc.) — not in stores.
- Async operations live in hooks. Stores are synchronous.

---

## 8. Terminal Subsystem Deep Dive

### 8.1 PTY Lifecycle

The PTY is created **once in `App.tsx`** via `openInitialTerminal()`, not inside `useTerminal`. This is critical — `useTerminal` connects to an existing PTY using `terminalId` as the PTY ID directly.

```
App.tsx openInitialTerminal():
  → createTerminal(shell, cwd)                          [IPC → Rust]
    → PtyManager.spawn(shell, args, env, cwd, app)
      → builds CommandBuilder with args + env (falls back to home dir if cwd is gone)
      → opens PTY pair (ConPTY on Windows)
      → spawns shell process
      → starts read loop thread
      → returns uuid as session ID
  → addSession(makeSession(id, shell, cwd))             [Zustand]

TerminalPane mounts with terminalId = id:
  → useTerminal(terminalId, shell, initialCwd)
    → ptyIdRef.current = terminalId    ← uses existing PTY, does NOT create new one
    → opens xterm.js canvas
    → registers onPtyOutput listener
    → wires term.onData → writeInput(ptyIdRef.current, data)
```

**StrictMode guard**: `App.tsx` uses `sessionInitialized = useRef(false)` to prevent double-invocation of session restore in React 18 StrictMode dev mode.

**Platform first**: before restoring the session, `App.tsx` loads `platform.store` (`get_platform_info`). Nothing renders until it is loaded, so `getDefaultShell()` and `getPlatform().homeDir` are always available to components and hooks.

### 8.2 OSC 7 Injection — Shell Integration

OSC 7 is **not** injected via `writeInput` after shell start (that caused the function definition to be echoed visibly). Each shell gets its integration through its startup arguments or environment. Profiles are built by the backend in `platform/shells.rs` and sent to the frontend with `get_platform_info`:

| Shell | OS | How OSC 7 is installed |
|---|---|---|
| PowerShell / pwsh | all | `-NoExit -Command <prompt function>` |
| bash | Linux, macOS | `--rcfile shell-integration/bash/integration.bash -i`, which sources `~/.bashrc` and appends to `PROMPT_COMMAND` |
| zsh | Linux, macOS | `ZDOTDIR=shell-integration/zsh`; each startup file sources the user's own (`PSE_USER_ZDOTDIR`) and the `.zshrc` adds a `precmd` hook. Login shell (`-l`) on macOS |
| fish | Linux, macOS | `-C <fish_prompt event handler>` |
| CMD, WSL, others | — | none (explorer does not follow the terminal) |

PowerShell executes the `-Command` silently before entering interactive mode — no echo, no `>>` continuation prompts. The bash/zsh scripts live in `src-tauri/shell-integration/`, are embedded in the binary with `include_str!` and written to the app data dir on every launch (`platform/integration.rs`).

### 8.3 Resize Handling

```typescript
const handleResize = useCallback(() => {
  fitRef.current?.fit()
  const { cols, rows } = termRef.current!
  resizePty(ptyIdRef.current, cols, rows).catch(() => {})
}, [])

useEffect(() => {
  const observer = new ResizeObserver(handleResize)
  observer.observe(containerRef.current!)
  return () => observer.disconnect()
}, [handleResize])
```

### 8.4 PTY Kill Logic

`useTerminal` cleanup calls `killTerminal` **only when the session no longer exists in the store** (real unmount). In React StrictMode, the cleanup runs but the session still exists → no kill → PTY survives the re-mount cycle.

```typescript
return () => {
  term.dispose()
  const sessionGone = !useTerminalsStore.getState().sessions[terminalId]
  if (sessionGone) killTerminal(ptyIdRef.current).catch(() => {})
}
```

---

## 9. CWD Synchronization

### 9.1 Mechanism

1. Shell startup: OSC 7 prompt function injected via `-Command` arg (see §8.2)
2. On every prompt display, shell emits `ESC]7;file://<host>/<path>\x07` — `file://localhost/C:/path` on Windows, `file://my-host/home/me/path` on Linux/macOS. `osc-parser.ts` turns the first into `C:\path` and leaves POSIX paths as they are
3. `useTerminal` parses this before passing data to `term.write()`
4. On detection: `updateCwd(terminalId, cwd)` + `explorerStore.setCwd(cwd)`

### 9.2 Tab Switch Sync

`useActiveTerminalSync` hook in `App.tsx` reacts to `activeId` changes and calls `explorerStore.setCwd(sessions[activeId].cwd)`. New terminals always start in the user's home directory (`PlatformInfo.homeDir`) — they do not inherit the previous terminal's CWD.

### 9.3 Explorer → Terminal Navigation

Clicking a Favorite or Recent directory calls `writeInput(activeId, cdCommandFor(activeId, path))` to navigate the active terminal. `buildCdCommand` (`lib/shell-profiles.ts`) quotes the path for the target shell: `cd -LiteralPath '…'` in PowerShell, `cd /d "…"` in CMD and `cd '…'` in POSIX shells.

Paths are never built with a hardcoded separator: use `lib/path-utils.ts` (`joinPath`, `splitPath`, `basename`, `pathPrefix`), which infers `\` or `/` from the path itself. The resulting OSC 7 from the next prompt confirms the navigation in the file tree.

Folders in the FileTree expand/collapse on single click. **Double-click does NOT cd** — use drag & drop instead (see §10).

---

## 10. Drag & Drop System

HTML5 DnD is not used. `DragManager` (`lib/drag-manager.ts`) implements drag via mouse events.

### 10.1 DragManager

```typescript
// Singleton module
DragManager.beginWatch(entry, mouseX, mouseY)
// → adds document mousemove/mouseup listeners
// → activates after 6px movement
// → notifies via onStateChange(entry | null)

DragManager.consume()
// → returns current entry and clears state
// → triggers onStateChange(null) to hide overlays
```

### 10.2 Drop Zones

| Zone | Component | Action |
|---|---|---|
| Active terminal | `TerminalPane` DragOverlay | `writeInput(ptyId, 'cd "path"\r')` |
| Empty terminal area | `MainLayout` EmptyDropZone | `createTerminal(shell, args, entry.path)` |

Only **folders** (`entry.isDir === true`) can be dropped. Files are not draggable (`draggable={entry.isDir}`).

### 10.3 Why Not HTML5 DnD

WebView2 (Tauri's renderer on Windows) does not reliably return `dataTransfer.getData()` in `onDrop` handlers — the value is always an empty string. Mouse-event-based drag is the correct approach for in-app DnD in Tauri on Windows.

---

## 11. Adding New Features

### 11.1 Adding a New Sidebar Panel

1. Create `src/components/sidebar/MyPanel.tsx` — reads from store, no direct IPC
2. If backend data needed: Rust command → register in `lib.rs` → `tauri-bridge.ts` wrapper → Zustand store → hook
3. Add to `Sidebar.tsx` tab content

### 11.2 Adding a Keyboard Shortcut

1. Add to `useKeyBindings.ts` bindings array: `{ ctrl: true, key: "x", action: () => ... }`
2. Document in SRS shortcuts table

### 11.3 Adding a New Shell Profile

Shell profiles are detected in `src-tauri/src/platform/shells.rs` (`detect()`, one implementation per OS). Add the shell there with its OSC 7 integration in `args` or `env`; if it needs a startup script, add it under `src-tauri/shell-integration/` and to `SCRIPTS` in `platform/integration.rs`. Shells without OSC 7 support (CMD, WSL) get no integration. If its `cd` syntax is not POSIX, extend `getShellKind`/`buildCdCommand` in `lib/shell-profiles.ts`.

---

## 12. Error Handling

### 12.1 Rust Commands

All return `Result<T, String>`. Human-readable error strings:
```rust
.map_err(|e| format!("Failed to open repo at {}: {}", path, e))
```

### 12.2 Frontend

`handleCommandError(context, error)` in `lib/error-handler.ts` logs and dispatches to `notification.store` (toast). Never let a failed `invoke` silently disappear.

### 12.3 Terminal Process Exit

Rust emits `terminal_closed_{id}`. `useTerminal` displays: `"Process exited with code X. Press any key to restart."` On keypress, `createTerminal` is called with the same shell/args and the session's last known CWD.

---

## 13. Code Style & Conventions

### 13.1 TypeScript

- Strict mode, no `any`
- `kebab-case.ts` for utilities/hooks, `PascalCase.tsx` for components
- Named exports, one component per file
- No barrel `index.ts` files

### 13.2 Rust

- `rustfmt` defaults
- `clippy` warnings = errors in CI
- `anyhow::Result` internally; `String` only at command boundary
- No `unwrap()`/`expect()` outside tests

### 13.3 CSS / Theming

All colors use HSL CSS variables: `hsl(var(--foreground))`. Variable definitions live in `src/styles/themes/dark.css` and `light.css`. Custom user overrides go through `settings.store.customVars` applied via `useApplySettings`.

Global zoom via `--app-zoom` on `#root`:
```css
#root {
  width: calc(100vw / var(--app-zoom, 1));
  height: calc(100vh / var(--app-zoom, 1));
  transform: scale(var(--app-zoom, 1));
  transform-origin: top left;
}
```
Keyboard: `Ctrl+=` zoom in, `Ctrl+-` zoom out, `Ctrl+0` reset.

---

## 14. Release Checklist

**Code Quality**
- [ ] `pnpm lint` passes
- [ ] `cargo clippy -- -D warnings` passes
- [ ] All tests pass (`pnpm test`, `cargo test`)

**Functionality**
- [ ] Terminal spawns correctly (Windows: PowerShell, CMD — Linux/macOS: zsh, bash)
- [ ] OSC 7 CWD sync works (navigate in terminal → explorer updates)
- [ ] Tab switch → explorer updates to that terminal's CWD
- [ ] Drag folder → active terminal: executes `cd`
- [ ] Drag folder → empty area: opens new terminal at that path
- [ ] Git graph renders for repos with branches/merges
- [ ] File search (recursive) returns correct results
- [ ] Session restores after close/reopen
- [ ] Zoom Ctrl+= / Ctrl+- / Ctrl+0 works and is responsive
- [ ] App exits cleanly, no orphan processes

**Build**
- [ ] `pnpm tauri build` succeeds
- [ ] Tested on Windows 10 (build 1903+) and Windows 11
- [ ] Tested on Linux (WebKitGTK 4.1) and macOS
