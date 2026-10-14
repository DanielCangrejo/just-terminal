import { useEffect } from "react"
import { onFsChange } from "@/lib/tauri-bridge"
import { useExplorerStore } from "@/store/explorer.store"

// Bursts of changes (git checkout, npm install, builds) arrive as hundreds of
// events; refresh the listing once they settle.
const REFRESH_DEBOUNCE_MS = 150

export function useFileWatcher() {
  const refresh = useExplorerStore((s) => s.refresh)
  const cwd = useExplorerStore((s) => s.cwd)

  useEffect(() => {
    let unlisten: (() => void) | null = null
    let timer: ReturnType<typeof setTimeout> | undefined

    onFsChange(() => {
      clearTimeout(timer)
      timer = setTimeout(refresh, REFRESH_DEBOUNCE_MS)
    }).then((fn) => {
      unlisten = fn
    })

    return () => {
      clearTimeout(timer)
      unlisten?.()
    }
  }, [cwd, refresh])
}
