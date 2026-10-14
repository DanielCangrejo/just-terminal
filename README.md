<div align="center">

# PSExplorer

**A modern terminal for Windows, Linux and macOS, built with Tauri 2 + React + Rust**

[![Built with Tauri](https://img.shields.io/badge/Built%20with-Tauri%202-24C8D8?style=flat-square&logo=tauri)](https://tauri.app)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![Rust](https://img.shields.io/badge/Rust-stable-F97316?style=flat-square&logo=rust)](https://www.rust-lang.org)

![PSExplorer Screenshot](docs/screenshot.png)

</div>

---

## What is PSExplorer?

PSExplorer replaces the three-app dance of Windows Terminal + File Explorer + VS Code (as file navigator). It's a single lightweight window that combines a real native PowerShell terminal with an integrated file explorer, Git graph, and session management.

No emulation. No compromise. Full ConPTY with ANSI/VT100 support on Windows, and a native PTY running your own shell (zsh, bash, fish, pwsh) on Linux and macOS.

---

## Features

### Terminal
- **Native PTY** — Real PowerShell, CMD, Git Bash, WSL processes via ConPTY on Windows; your login shell plus zsh, bash, fish or pwsh on Linux and macOS
- **Multi-tab** — Open unlimited terminals, each with its own shell, CWD, and history
- **Vertical tab bar** — Tabs on the left panel with folder name display
- **Tab management** — Pin to top, rename, drag to reorder, right-click context menu
- **Copy/Paste** — `Ctrl+C` copies selection, `Ctrl+V` pastes
- **Auto-restart** — Process exits prompt a one-key restart

### File Explorer
- **Live file tree** — Lazy-loaded, auto-refreshes via file system watcher
- **Colorful icons** — File type colors by extension (`.ts`, `.rs`, `.py`, `.json`, ...)
- **Inline creation** — New file / new folder with inline input (no dialogs)
- **Recursive search** — Rust-powered search across all subdirectories
- **Favorites** — Star directories for one-click navigation
- **Recent dirs** — Last 20 visited folders, auto-tracked

### Git
- **Commit graph** — Visual branch/merge visualization with SVG bezier curves (like VS Code)
- **Branch awareness** — Branch name, dirty status, ahead/behind in sidebar
- **Ref badges** — Branch and tag labels inline on commits

### CWD Sync
- **Terminal → Explorer** — Navigate in the terminal, the file tree follows automatically
- **Explorer → Terminal** — Click a Favorite or Recent dir to `cd` there instantly
- **Tab switch** — Switching tabs updates the explorer to that terminal's directory

### Drag & Drop
- **Folder → active terminal** — Drag a folder onto the terminal to `cd` into it
- **Folder → empty area** — Opens a new terminal directly in that folder
- Files are not draggable (intentional)

### Appearance & Settings
- **Warp-inspired dark theme** — Deep navy background, purple accent, clean typography
- **Light theme** — Full light mode support
- **4 color presets** — Shadcn Dark, Catppuccin Mocha, Dracula, Tokyo Night
- **Custom colors** — Override any HSL CSS variable via the Settings panel
- **Global zoom** — `Ctrl+=` / `Ctrl+-` / `Ctrl+0` scales the entire UI
- **Resizable sidebar sections** — Drag handles between Favorites, File Tree, and Recent

---

## Tech Stack

| Layer | Technology |
|---|---|
| App framework | Tauri 2 |
| UI | React 18 + TypeScript + Vite |
| Terminal renderer | xterm.js 5 (ConPTY backend) |
| Styling | TailwindCSS 3 + Radix UI primitives |
| State | Zustand 4 |
| PTY | portable-pty (ConPTY on Windows) |
| Git | git2-rs (libgit2 bindings) |
| File watching | notify 6 |
| Persistence | SQLite via rusqlite (bundled) |

---

## Getting Started

### Prerequisites

All platforms:

- [Rust](https://rustup.rs) stable
- [Node.js](https://nodejs.org) 18+ and [pnpm](https://pnpm.io)

**Windows** 10 (build 1903+) or 11:

- Rust toolchain `stable-x86_64-pc-windows-msvc`
- [Visual Studio Build Tools 2022](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022) with **Desktop development with C++** workload

> PowerShell 7 (`pwsh.exe`) is optional but recommended. The app falls back to Windows PowerShell 5.1 if not found.

**Linux** (Debian/Ubuntu; for other distros see [Tauri prerequisites](https://tauri.app/start/prerequisites/#linux)):

```bash
sudo apt update
sudo apt install -y build-essential curl wget file pkg-config libssl-dev \
  libwebkit2gtk-4.1-dev libxdo-dev libayatana-appindicator3-dev librsvg2-dev
```

> **WSL2:** works on Windows 11 / Windows 10 with WSLg (GUI apps). Build and run from inside WSL; keep the repo in the Linux filesystem (`~/…`), not under `/mnt/c`, or builds and the file watcher will be very slow.

**macOS** 11+:

```bash
xcode-select --install
```

The default shell is your login shell (`$SHELL`). zsh, bash and fish report their working directory to the file explorer through small startup scripts that load your own `~/.zshrc` / `~/.bashrc` first, so your prompt, aliases and PATH stay as they are.

### Install

```bash
git clone https://github.com/Juandiazcar/just-terminal.git
cd just-terminal
pnpm install
```

### Run (development)

```bash
pnpm tauri dev
```

First run downloads ~300 Rust crates — expect 10–15 minutes. Subsequent builds are incremental (~10s).

### Build (production)

```bash
pnpm tauri build
```

Output: `src-tauri/target/release/bundle/`

---

## Keyboard Shortcuts

| Action | Shortcut |
|---|---|
| New terminal | `Ctrl+T` |
| Close terminal | `Ctrl+W` |
| Switch tab right | `Ctrl+Tab` |
| Switch tab left | `Ctrl+Shift+Tab` |
| Toggle sidebar | `Ctrl+B` |
| Toggle theme | `Ctrl+Shift+L` |
| Zoom in | `Ctrl+=` |
| Zoom out | `Ctrl+-` |
| Reset zoom | `Ctrl+0` |

---

## Project Structure

```
just-terminal/
├── src/                     # React + TypeScript frontend
│   ├── components/          # UI components
│   │   ├── terminal/        # xterm.js wrapper, tab bar, pane
│   │   ├── explorer/        # File tree, toolbar, search
│   │   ├── git/             # Git graph, status bar
│   │   ├── sidebar/         # Favorites, recent dirs
│   │   ├── settings/        # Settings dialog
│   │   └── ui/              # Shadcn-style primitives
│   ├── hooks/               # useTerminal, useDragDrop, useKeyBindings, ...
│   ├── store/               # Zustand stores
│   ├── lib/                 # tauri-bridge, drag-manager, osc-parser, ...
│   └── types/               # Shared TypeScript types
├── src-tauri/               # Rust backend
│   ├── src/
│   │   ├── terminal/        # PTY manager, session
│   │   ├── explorer/        # FS ops, file watcher, recursive search
│   │   ├── git/             # git2-rs: status, log, actions
│   │   ├── session/         # SQLite persistence
│   │   └── platform/        # OS detection, shell profiles, shell integration
│   └── shell-integration/   # bash/zsh scripts that report the CWD (OSC 7)
└── docs/
    └── ARCHITECTURE.md      # Full architecture guide
```

---

## Architecture

The full architecture guide is at [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

Key principle: **IPC is the only bridge.** The Rust backend owns all system operations. The React frontend owns all UI. `src/lib/tauri-bridge.ts` is the only file that calls `invoke()` and `listen()`.

---

## License

MIT
