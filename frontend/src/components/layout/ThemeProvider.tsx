import { useEffect } from 'react'
import { applyTheme, useThemeStore } from '@/stores/themeStore'

interface Props {
  children: React.ReactNode
}

export default function ThemeProvider({ children }: Props) {
  const preference = useThemeStore((s) => s.preference)

  useEffect(() => {
    applyTheme(preference)
  }, [preference])

  useEffect(() => {
    if (preference !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [preference])

  return <>{children}</>
}
