"use client"

import { useEffect, useState } from "react"
import { SET_GLOBALS_EVENT_TYPE, type OpenAIGlobals } from "./types"

export function useOpenAIGlobal<K extends keyof OpenAIGlobals>(key: K): OpenAIGlobals[K] | null {
  const [value, setValue] = useState<OpenAIGlobals[K] | null>(() => {
    if (typeof window === "undefined" || !window.openai) {
      return null
    }
    return window.openai[key] ?? null
  })

  useEffect(() => {
    if (typeof window === "undefined" || !window.openai) {
      return
    }

    // Set initial value
    setValue(window.openai[key] ?? null)

    // Listen for updates
    const handleSetGlobals = (event: CustomEvent<{ globals: Partial<OpenAIGlobals> }>) => {
      if (key in event.detail.globals) {
        setValue(event.detail.globals[key] as OpenAIGlobals[K])
      }
    }

    window.addEventListener(SET_GLOBALS_EVENT_TYPE, handleSetGlobals as EventListener)

    return () => {
      window.removeEventListener(SET_GLOBALS_EVENT_TYPE, handleSetGlobals as EventListener)
    }
  }, [key])

  return value
}
