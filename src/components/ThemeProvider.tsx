'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

export type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')

  useEffect(() => {
    // 1. Check existing DOM attribute set by head script
    const currentAttr = document.documentElement.getAttribute('data-theme') as Theme | null
    // 2. Check localStorage
    let saved: Theme | null = null
    try {
      saved = localStorage.getItem('desa-ai-theme') as Theme | null
    } catch (e) {
      console.error(e)
    }

    let initialTheme: Theme = 'light'
    if (saved === 'light' || saved === 'dark') {
      initialTheme = saved
    } else if (currentAttr === 'light' || currentAttr === 'dark') {
      initialTheme = currentAttr
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      initialTheme = 'dark'
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(initialTheme)
    document.documentElement.setAttribute('data-theme', initialTheme)
  }, [])

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    try {
      localStorage.setItem('desa-ai-theme', newTheme)
    } catch (e) {
      console.error(e)
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === 'light' ? 'dark' : 'light'
      document.documentElement.setAttribute('data-theme', next)
      try {
        localStorage.setItem('desa-ai-theme', next)
      } catch (e) {
        console.error(e)
      }
      return next
    })
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
