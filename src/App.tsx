import { useEffect, useRef, useState } from "react"
import { MainLayout } from "@/components/layout/MainLayout"
import { useSessionStore } from "@/store/session.store"
import { useTerminalsStore, makeSession } from "@/store/terminals.store"
import { useExplorerStore } from "@/store/explorer.store"
import { useNotificationStore } from "@/store/notification.store"
import { getPlatform, usePlatformStore } from "@/store/platform.store"
import { useKeyBindings } from "@/hooks/useKeyBindings"
import { useActiveTerminalSync } from "@/hooks/useActiveTerminalSync"
import { useApplySettings } from "@/components/settings/SettingsPanel"
import { loadSession, saveSession, createTerminal } from "@/lib/tauri-bridge"
import { getDefaultShell, resolveShell } from "@/lib/shell-profiles"
import { handleCommandError } from "@/lib/error-handler"
import type { SessionSnapshot } from "@/types/session.types"

function NotificationToast() {
  const { notifications, dismiss } = useNotificationStore()
  if (notifications.length === 0) return null
  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`px-3 py-2 rounded text-sm shadow-lg flex items-center gap-2 ${
            n.type === "error"
              ? "bg-red-900 text-red-100"
              : n.type === "warn"
              ? "bg-yellow-900 text-yellow-100"
              : "bg-gray-800 text-gray-100"
          }`}
        >
          <span className="flex-1">{n.message}</span>
          <button onClick={() => dismiss(n.id)} className="opacity-60 hover:opacity-100">
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const { theme, setTheme, setSidebarWidth, favorites, recentDirs, quickCommands } =
    useSessionStore()
  const { addSession, sessions } = useTerminalsStore()
  const { setCwd } = useExplorerStore()
  const loadPlatform = usePlatformStore((s) => s.load)
  const [ready, setReady] = useState(false)

  useKeyBindings()
  useApplySettings()
  useActiveTerminalSync()

  // Apply theme to body
  useEffect(() => {
    document.body.className = theme
  }, [theme])

  // Guard against React StrictMode double-invoke
  const sessionInitialized = useRef(false)

  // Restore session on launch. Platform info (shells, home dir) must be loaded
  // first: every terminal is created from it.
  useEffect(() => {
    if (sessionInitialized.current) return
    sessionInitialized.current = true
    loadPlatform()
      .then(() => {
        setReady(true)
        return restoreSession()
      })
      .catch((e) => handleCommandError("App.platform", e))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const restoreSession = () =>
    loadSession()
      .then((snapshot: SessionSnapshot | null) => {
        if (!snapshot) {
          openInitialTerminal()
          return
        }
        setTheme(snapshot.theme as "dark" | "light")
        setSidebarWidth(snapshot.sidebarWidth)
        snapshot.favorites.forEach((f) =>
          useSessionStore.getState().addFavorite(f)
        )
        snapshot.recentDirs.forEach((d) =>
          useSessionStore.getState().pushRecentDir(d)
        )
        snapshot.quickCommands.forEach((c) =>
          useSessionStore.getState().addQuickCommand(c)
        )
        if (snapshot.tabs.length > 0) {
          snapshot.tabs.forEach((tab) => {
            const shell = resolveShell(tab.shell)
            createTerminal(shell, tab.cwd)
              .then((id) => addSession(makeSession(id, shell, tab.cwd)))
              .catch((e) => handleCommandError("Session.restore", e))
          })
          const firstTab = snapshot.tabs[0]
          if (firstTab) setCwd(firstTab.cwd).catch(() => {})
        } else {
          openInitialTerminal()
        }
      })
      .catch(() => openInitialTerminal())

  const openInitialTerminal = () => {
    const shell = getDefaultShell()
    const cwd = getPlatform().homeDir
    createTerminal(shell, cwd)
      .then((id) => {
        addSession(makeSession(id, shell, cwd))
        setCwd(cwd).catch(() => {})
      })
      .catch((e) => handleCommandError("App.init", e))
  }

  // Save session on window unload
  useEffect(() => {
    const handler = () => {
      const sessionIds = Object.keys(sessions)
      const snapshot: SessionSnapshot = {
        tabs: sessionIds.map((id) => {
          const s = sessions[id]
          return {
            id,
            title: s.title,
            shell: s.shell,
            cwd: s.cwd,
            splits: [],
          }
        }),
        activeTabId: useTerminalsStore.getState().activeId ?? "",
        sidebarWidth: useSessionStore.getState().sidebarWidth,
        favorites: useSessionStore.getState().favorites,
        recentDirs: useSessionStore.getState().recentDirs,
        quickCommands: useSessionStore.getState().quickCommands,
        theme: useSessionStore.getState().theme,
      }
      saveSession(snapshot).catch(() => {})
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [sessions])

  if (!ready) return null

  return (
    <>
      <MainLayout />
      <NotificationToast />
    </>
  )
}
