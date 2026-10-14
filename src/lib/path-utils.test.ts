import { describe, expect, it } from "vitest"
import { basename, isWindowsPath, joinPath, pathPrefix, splitPath } from "./path-utils"

describe("path-utils", () => {
  it("detects Windows paths", () => {
    expect(isWindowsPath("C:\\Users\\me")).toBe(true)
    expect(isWindowsPath("C:")).toBe(true)
    expect(isWindowsPath("/home/me")).toBe(false)
  })

  it("splits and takes the basename of both styles", () => {
    expect(splitPath("C:\\Users\\me")).toEqual(["C:", "Users", "me"])
    expect(splitPath("/home/me/")).toEqual(["home", "me"])
    expect(basename("/home/me")).toBe("me")
    expect(basename("/")).toBeUndefined()
  })

  it("joins with the separator of the base path", () => {
    expect(joinPath("C:\\Users", "a.txt")).toBe("C:\\Users\\a.txt")
    expect(joinPath("C:\\", "a.txt")).toBe("C:\\a.txt")
    expect(joinPath("/home/me", "a.txt")).toBe("/home/me/a.txt")
    expect(joinPath("/", "tmp")).toBe("/tmp")
  })

  it("rebuilds absolute prefixes", () => {
    expect(pathPrefix("C:\\Users\\me", 1)).toBe("C:\\")
    expect(pathPrefix("C:\\Users\\me", 2)).toBe("C:\\Users")
    expect(pathPrefix("/home/me/src", 1)).toBe("/home")
    expect(pathPrefix("/home/me/src", 3)).toBe("/home/me/src")
  })
})
