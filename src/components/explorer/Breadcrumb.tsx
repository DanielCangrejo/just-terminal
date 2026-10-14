import { ChevronRight } from "lucide-react"
import { useExplorerStore } from "@/store/explorer.store"
import { useTerminalsStore, cdCommandFor } from "@/store/terminals.store"
import { writeInput } from "@/lib/tauri-bridge"
import { handleCommandError } from "@/lib/error-handler"
import { pathPrefix, splitPath } from "@/lib/path-utils"

export function Breadcrumb() {
  const cwd = useExplorerStore((s) => s.cwd)
  const activeId = useTerminalsStore((s) => s.activeId)

  if (!cwd) return null

  const parts = splitPath(cwd)

  const navigateTo = (index: number) => {
    if (!activeId) return
    const path = pathPrefix(cwd, index + 1)
    writeInput(activeId, cdCommandFor(activeId, path)).catch((e) =>
      handleCommandError("Breadcrumb", e)
    )
  }

  return (
    <div
      className="flex items-center px-3 h-6 text-xs overflow-x-auto whitespace-nowrap border-t gap-0.5"
      style={{
        background: "hsl(var(--statusbar-bg))",
        borderColor: "hsl(var(--border))",
        color: "hsl(var(--muted-foreground))",
      }}
    >
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-0.5">
          {i > 0 && <ChevronRight size={14} className="opacity-30" />}
          <button
            className="hover:text-foreground transition-colors px-0.5 rounded hover:bg-white/5"
            onClick={() => navigateTo(i)}
          >
            {part}
          </button>
        </span>
      ))}
    </div>
  )
}
