import { describe, expect, it } from "vitest"
import { extractCwdFromOsc7 } from "./osc-parser"

const osc7 = (uri: string) => `\x1b]7;${uri}\x07PS > `

describe("extractCwdFromOsc7", () => {
  it("parses Windows paths from PowerShell", () => {
    expect(extractCwdFromOsc7(osc7("file://localhost/C:/Users/me"))).toBe("C:\\Users\\me")
  })

  it("parses POSIX paths with a hostname", () => {
    expect(extractCwdFromOsc7(osc7("file://my-laptop/home/me/src"))).toBe("/home/me/src")
  })

  it("parses the filesystem root", () => {
    expect(extractCwdFromOsc7(osc7("file://my-laptop/"))).toBe("/")
  })

  it("decodes percent-encoded characters", () => {
    expect(extractCwdFromOsc7(osc7("file://h/home/me/100%25%20done"))).toBe("/home/me/100% done")
  })

  it("keeps the raw path when it is not valid percent-encoding", () => {
    expect(extractCwdFromOsc7(osc7("file://h/home/me/100%"))).toBe("/home/me/100%")
  })

  it("returns null when there is no OSC 7 sequence", () => {
    expect(extractCwdFromOsc7("plain output")).toBeNull()
  })
})
