import type { ShellProfile } from "@/types/terminal.types"
import { getPlatform } from "@/store/platform.store"

// Shell profiles are detected by the Rust backend (platform/shells.rs), which
// also attaches the OSC 7 integration for each shell. See ARCHITECTURE.md §8.2.

export type ShellKind = "powershell" | "cmd" | "posix"

export function getShellProfiles(): ShellProfile[] {
  return getPlatform().shells
}

export function getDefaultShell(): ShellProfile {
  return getShellProfiles()[0]
}

/**
 * Maps a shell saved in a previous session to one available now. Saved profiles
 * may come from another machine or an older version, so they are matched by name
 * and the current profile (with up-to-date args and env) is returned.
 */
export function resolveShell(saved: ShellProfile | undefined): ShellProfile {
  return getShellProfiles().find((s) => s.name === saved?.name) ?? getDefaultShell()
}

export function getShellKind(shell: ShellProfile): ShellKind {
  const exe = (shell.executable.split(/[/\\]/).pop() ?? "").toLowerCase()
  if (exe.startsWith("pwsh") || exe.startsWith("powershell")) return "powershell"
  if (exe === "cmd.exe" || exe === "cmd") return "cmd"
  return "posix"
}

/** Builds the line to type into a shell to change its directory to `path`. */
export function buildCdCommand(shell: ShellProfile, path: string): string {
  switch (getShellKind(shell)) {
    case "powershell":
      return `cd -LiteralPath '${path.replace(/'/g, "''")}'\r`
    case "cmd":
      return `cd /d "${path}"\r`
    case "posix":
      return `cd '${path.replace(/'/g, `'\\''`)}'\r`
  }
}
