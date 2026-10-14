// OSC 7 format: ESC ] 7 ; file://<host>/<path> BEL
//   Windows: file://localhost/C:/path/to/dir
//   POSIX:   file://my-laptop/home/user/dir
const OSC7_REGEX = /\x1b\]7;file:\/\/[^/]*(\/[^\x07\x1b]*)[\x07\x1b]/

export function extractCwdFromOsc7(data: string): string | null {
  const match = data.match(OSC7_REGEX)
  if (!match) return null
  const path = safeDecode(match[1])
  if (/^\/[A-Za-z]:/.test(path)) {
    return path.slice(1).replace(/\//g, "\\")
  }
  return path
}

// A shell that doesn't percent-encode may send a literal "%" that is not a valid escape
function safeDecode(path: string): string {
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}
