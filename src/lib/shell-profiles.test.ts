import { beforeEach, describe, expect, it } from "vitest"
import { buildCdCommand, getShellKind, resolveShell } from "./shell-profiles"
import { usePlatformStore } from "@/store/platform.store"
import type { ShellProfile } from "@/types/terminal.types"

const shell = (name: string, executable: string): ShellProfile => ({ name, executable, args: [] })

const zsh = shell("zsh", "/bin/zsh")
const bash = shell("bash", "/bin/bash")
const pwsh = shell("PowerShell", "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe")
const cmd = shell("CMD", "C:\\Windows\\System32\\cmd.exe")

describe("getShellKind", () => {
  it("classifies shells by executable name", () => {
    expect(getShellKind(pwsh)).toBe("powershell")
    expect(getShellKind(shell("PowerShell", "/usr/bin/pwsh"))).toBe("powershell")
    expect(getShellKind(cmd)).toBe("cmd")
    expect(getShellKind(zsh)).toBe("posix")
  })
})

describe("buildCdCommand", () => {
  it("quotes for POSIX shells, escaping single quotes", () => {
    expect(buildCdCommand(zsh, "/home/me/it's here")).toBe(`cd '/home/me/it'\\''s here'\r`)
  })

  it("uses a literal path in PowerShell", () => {
    expect(buildCdCommand(pwsh, "C:\\it's [1]")).toBe(`cd -LiteralPath 'C:\\it''s [1]'\r`)
  })

  it("switches drives in CMD", () => {
    expect(buildCdCommand(cmd, "D:\\work")).toBe(`cd /d "D:\\work"\r`)
  })
})

describe("resolveShell", () => {
  beforeEach(() => {
    usePlatformStore.setState({ info: { os: "linux", homeDir: "/home/me", shells: [zsh, bash] } })
  })

  it("returns the current profile with the same name", () => {
    expect(resolveShell({ ...bash, executable: "/old/bash" })).toBe(bash)
  })

  it("falls back to the default shell for unknown or missing profiles", () => {
    expect(resolveShell(pwsh)).toBe(zsh)
    expect(resolveShell(undefined)).toBe(zsh)
  })
})
