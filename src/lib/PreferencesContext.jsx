import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

const PreferencesContext = createContext(null)
const STORAGE_KEY = 'quex_ui_preferences_v1'

const DEFAULTS = {
  darkMode: false,
  fontSize: 'normal',
  highContrast: false,
}

const FONT_SIZE_PX = {
  small: 14,
  normal: 16,
  large: 18,
}

function readPreferences() {
  if (typeof window === 'undefined') return DEFAULTS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw)
    return {
      darkMode: Boolean(parsed.darkMode),
      fontSize: ['small', 'normal', 'large'].includes(parsed.fontSize) ? parsed.fontSize : 'normal',
      highContrast: Boolean(parsed.highContrast),
    }
  } catch {
    return DEFAULTS
  }
}

export function PreferencesProvider({ children }) {
  const [preferences, setPreferences] = useState(readPreferences)

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = preferences.darkMode ? 'dark' : 'light'
    root.dataset.contrast = preferences.highContrast ? 'high' : 'normal'
    root.dataset.fontSize = preferences.fontSize
    root.style.fontSize = `${FONT_SIZE_PX[preferences.fontSize] || 16}px`
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
    } catch {
      // Mantém as preferências apenas durante a sessão se o navegador bloquear o localStorage.
    }
  }, [preferences])

  const value = useMemo(() => ({
    ...preferences,
    setDarkMode: value => setPreferences(current => ({ ...current, darkMode: Boolean(value) })),
    setFontSize: value => setPreferences(current => ({
      ...current,
      fontSize: ['small', 'normal', 'large'].includes(value) ? value : 'normal',
    })),
    setHighContrast: value => setPreferences(current => ({ ...current, highContrast: Boolean(value) })),
    resetPreferences: () => setPreferences(DEFAULTS),
  }), [preferences])

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  )
}

export function usePreferences() {
  const context = useContext(PreferencesContext)
  if (!context) throw new Error('usePreferences deve ser usado dentro de PreferencesProvider')
  return context
}
