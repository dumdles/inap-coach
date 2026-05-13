'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

type Theme = 'light' | 'dark' | 'auto'
export type GoalMode = 'bulk' | 'cut' | 'maintain' | 'ippt'

interface ThemeContextType {
    theme: Theme
    setTheme: (t: Theme) => void
    goalMode: GoalMode
    setGoalMode: (g: GoalMode) => void
}

const ThemeContext = createContext<ThemeContextType>({
    theme: 'auto',
    setTheme: () => {},
    goalMode: 'bulk',
    setGoalMode: () => {},
})

export function useTheme() {
    return useContext(ThemeContext)
}

const GOAL_CLASSES: GoalMode[] = ['bulk', 'cut', 'maintain', 'ippt']

function applyTheme(theme: Theme) {
    const root = document.documentElement
    if (theme === 'dark') {
        root.classList.add('dark')
    } else if (theme === 'light') {
        root.classList.remove('dark')
    } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        root.classList.toggle('dark', prefersDark)
    }
}

function applyGoalMode(goal: GoalMode) {
    const root = document.documentElement
    GOAL_CLASSES.forEach(g => root.classList.remove(`goal-${g}`))
    // bulk is the default — no class needed
    if (goal !== 'bulk') root.classList.add(`goal-${goal}`)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>('auto')
    const [goalMode, setGoalModeState] = useState<GoalMode>('bulk')

    useEffect(() => {
        // Restore theme preference
        const storedTheme = (localStorage.getItem('pref_theme') as Theme | null) ?? 'auto'
        setThemeState(storedTheme)
        applyTheme(storedTheme)

        // Restore goal mode preference
        const storedGoal = (localStorage.getItem('pref_goal') as GoalMode | null) ?? 'bulk'
        setGoalModeState(storedGoal)
        applyGoalMode(storedGoal)

        const mq = window.matchMedia('(prefers-color-scheme: dark)')
        const handler = () => {
            if ((localStorage.getItem('pref_theme') ?? 'auto') === 'auto') applyTheme('auto')
        }
        mq.addEventListener('change', handler)
        return () => mq.removeEventListener('change', handler)
    }, [])

    const setTheme = useCallback((t: Theme) => {
        setThemeState(t)
        localStorage.setItem('pref_theme', t)
        applyTheme(t)
    }, [])

    const setGoalMode = useCallback((g: GoalMode) => {
        setGoalModeState(g)
        localStorage.setItem('pref_goal', g)
        applyGoalMode(g)
    }, [])

    return (
        <ThemeContext.Provider value={{ theme, setTheme, goalMode, setGoalMode }}>
            {children}
        </ThemeContext.Provider>
    )
}
