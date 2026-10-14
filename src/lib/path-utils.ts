// Path helpers for paths that come from the backend. The separator is inferred
// from the path itself, so they work for Windows ("C:\dir") and POSIX ("/dir")
// paths without asking which OS the app runs on.

export function isWindowsPath(path: string): boolean {
  return /^[A-Za-z]:/.test(path) || path.includes("\\")
}

export function pathSeparator(path: string): "\\" | "/" {
  return isWindowsPath(path) ? "\\" : "/"
}

export function splitPath(path: string): string[] {
  return path.split(/[/\\]/).filter(Boolean)
}

export function basename(path: string): string | undefined {
  return splitPath(path).pop()
}

export function joinPath(base: string, name: string): string {
  const sep = pathSeparator(base)
  return base.endsWith(sep) ? `${base}${name}` : `${base}${sep}${name}`
}

/** Rebuilds an absolute path from the first `count` segments of `path`. */
export function pathPrefix(path: string, count: number): string {
  const parts = splitPath(path).slice(0, count)
  if (!isWindowsPath(path)) return `/${parts.join("/")}`
  // "C:" alone means "current dir on drive C"; the drive root needs the trailing "\"
  return parts.length === 1 ? `${parts[0]}\\` : parts.join("\\")
}
