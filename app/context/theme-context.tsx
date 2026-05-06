'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

type Theme = 'light' | 'dark' | 'auto'

interface ThemeContextType {
    theme: Theme
    setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextType>({
    theme: 'auto',
    setTheme: () => {},
})

export function useTheme() {
    return useContext(ThemeContext)
}

function applyTheme(theme: Theme) {
    const root = document.documentElement
    if (theme === 'dark') {
        root.classList.add('dark')
    } else if (theme === 'light') {
        root.classList.remove('dark')
    } else {
        // auto — follow OS preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        root.classList.toggle('dark', prefersDark)
    }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>('auto')

    // On mount, read from localStorage and apply immediately
    useEffect(() => {
        const stored = (localStorage.getItem('pref_theme') as Theme | null) ?? 'auto'
        setThemeState(stored)
        applyTheme(stored)

        // Keep "auto" in sync when the OS preference changes
        const mq = window.matchMedia('(prefers-color-scheme: dark)')
        const handler = () => {
            if ((localStorage.getItem('pref_theme') ?? 'auto') === 'auto') {
                applyTheme('auto')
            }
        }
        mq.addEventListener('change', handler)
        return () => mq.removeEventListener('change', handler)
    }, [])

    const setTheme = useCallback((t: Theme) => {
        setThemeState(t)
        localStorage.setItem('pref_theme', t)
        applyTheme(t)
    }, [])

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}
