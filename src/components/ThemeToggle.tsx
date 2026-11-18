'use client'

import { useState, useEffect } from 'react'
import { useTheme } from './ThemeProvider'
import styles from './ThemeToggle.module.css'

interface ThemeToggleProps {
  variant?: 'segmented' | 'icon'
  className?: string
}

export default function ThemeToggle({ variant = 'segmented', className }: ThemeToggleProps) {
  const { theme, setTheme, toggleTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  if (!mounted) {
    if (variant === 'icon') {
      return (
        <div className={`${styles.iconBtn} ${className || ''}`} style={{ opacity: 0.6, pointerEvents: 'none' }}>
          <span className={styles.iconGraphic}>🌓</span>
        </div>
      )
    }
    return (
      <div className={`${styles.segmentedContainer} ${className || ''}`} style={{ opacity: 0.6 }}>
        <div className={`${styles.segmentedBtn} ${styles.active}`}>
          <span className={styles.segmentedIcon}>☀️</span>
          <span className={styles.segmentedLabel}>Terang</span>
        </div>
        <div className={styles.segmentedBtn}>
          <span className={styles.segmentedIcon}>🌙</span>
          <span className={styles.segmentedLabel}>Gelap</span>
        </div>
      </div>
    )
  }

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`${styles.iconBtn} ${className || ''}`}
        aria-label={theme === 'light' ? 'Beralih ke Mode Gelap' : 'Beralih ke Mode Terang'}
        title={theme === 'light' ? 'Beralih ke Mode Gelap' : 'Beralih ke Mode Terang'}
        id="theme-toggle-icon"
      >
        <span className={styles.iconGraphic}>
          {theme === 'light' ? '☀️' : '🌙'}
        </span>
      </button>
    )
  }

  return (
    <div 
      className={`${styles.segmentedContainer} ${className || ''}`}
      role="radiogroup" 
      aria-label="Pilih Mode Tampilan"
      id="theme-toggle-segmented"
    >
      <button
        type="button"
        role="radio"
        aria-checked={theme === 'light'}
        onClick={() => setTheme('light')}
        className={`${styles.segmentedBtn} ${theme === 'light' ? styles.active : ''}`}
        title="Mode Terang"
      >
        <span className={styles.segmentedIcon}>☀️</span>
        <span className={styles.segmentedLabel}>Terang</span>
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={theme === 'dark'}
        onClick={() => setTheme('dark')}
        className={`${styles.segmentedBtn} ${theme === 'dark' ? styles.active : ''}`}
        title="Mode Gelap"
      >
        <span className={styles.segmentedIcon}>🌙</span>
        <span className={styles.segmentedLabel}>Gelap</span>
      </button>
    </div>
  )
}
