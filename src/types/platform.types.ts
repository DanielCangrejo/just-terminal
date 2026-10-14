import type { ShellProfile } from "./terminal.types"

export type PlatformOs = "windows" | "linux" | "macos"

export interface PlatformInfo {
  os: PlatformOs
  homeDir: string
  /** Shells detected by the backend; the first one is the default. */
  shells: ShellProfile[]
}
