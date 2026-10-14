import { create } from "zustand"
import type { PlatformInfo } from "@/types/platform.types"
import { getPlatformInfo } from "@/lib/tauri-bridge"

interface PlatformState {
  info: PlatformInfo | null
  load: () => Promise<PlatformInfo>
}

// Loaded once at startup by App, before any terminal is created.
export const usePlatformStore = create<PlatformState>((set) => ({
  info: null,

  load: async () => {
    const info = await getPlatformInfo()
    set({ info })
    return info
  },
}))

export function getPlatform(): PlatformInfo {
  const { info } = usePlatformStore.getState()
  if (!info) throw new Error("Platform info requested before it was loaded")
  return info
}
