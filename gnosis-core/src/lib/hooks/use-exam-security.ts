"use client"

import { useEffect, useRef, useCallback } from "react"

interface UseExamSecurityOptions {
  enabled: boolean
  browserLockdown: boolean
  disableCopyPaste: boolean
  tabSwitchWarnings: boolean
  tabSwitchLimit: number
  onTabSwitch: (count: number) => void
  onLimitExceeded: () => void
}

export function useExamSecurity({
  enabled,
  browserLockdown,
  disableCopyPaste,
  tabSwitchWarnings,
  tabSwitchLimit,
  onTabSwitch,
  onLimitExceeded,
}: UseExamSecurityOptions) {
  const tabSwitchCount = useRef(0)
  const limitExceededRef = useRef(false)

  // Browser Lockdown: request full-screen
  const requestFullscreen = useCallback(async () => {
    if (!browserLockdown || !enabled) return
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
      }
    } catch {
      // Browser rejected full-screen — allowed per spec (best effort)
    }
  }, [browserLockdown, enabled])

  // Tab-Switch detection via visibilitychange
  useEffect(() => {
    if (!enabled || !tabSwitchWarnings) return

    const handleVisibility = () => {
      if (document.hidden && !limitExceededRef.current) {
        tabSwitchCount.current += 1
        onTabSwitch(tabSwitchCount.current)
        if (tabSwitchCount.current >= tabSwitchLimit) {
          limitExceededRef.current = true
          onLimitExceeded()
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibility)
    return () => document.removeEventListener("visibilitychange", handleVisibility)
  }, [enabled, tabSwitchWarnings, tabSwitchLimit, onTabSwitch, onLimitExceeded])

  // Disable copy / paste / context menu
  useEffect(() => {
    if (!enabled || !disableCopyPaste) return

    const block = (e: Event) => e.preventDefault()
    document.addEventListener("copy", block)
    document.addEventListener("cut", block)
    document.addEventListener("paste", block)
    document.addEventListener("contextmenu", block)

    return () => {
      document.removeEventListener("copy", block)
      document.removeEventListener("cut", block)
      document.removeEventListener("paste", block)
      document.removeEventListener("contextmenu", block)
    }
  }, [enabled, disableCopyPaste])

  // Inject print-hide CSS
  useEffect(() => {
    if (!enabled || !disableCopyPaste) return
    const style = document.createElement("style")
    style.id = "exam-no-print"
    style.textContent = "@media print { body { display: none !important; } }"
    document.head.appendChild(style)
    return () => document.getElementById("exam-no-print")?.remove()
  }, [enabled, disableCopyPaste])

  return { requestFullscreen, tabSwitchCount: tabSwitchCount.current }
}
