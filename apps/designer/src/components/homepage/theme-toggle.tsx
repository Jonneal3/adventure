"use client"

import { useTheme } from "next-themes"
import { Button } from "../ui/button"
import { Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="relative h-8 w-8 rounded-full border border-border bg-background/60 text-muted-foreground"
        disabled
      >
        <Sun className="h-4 w-4" />
      </Button>
    )
  }

  const isDark = resolvedTheme === 'dark'

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => {
        const newTheme = isDark ? "light" : "dark"
        setTheme(newTheme)
      }}
      aria-label="Toggle theme"
      className="relative h-8 w-8 rounded-full border border-border bg-background/60 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
    >
      <Sun className={`h-4 w-4 transition-all duration-500 ${
        isDark ? '-rotate-90 scale-0' : 'rotate-0 scale-100'
      }`} />
      <Moon className={`absolute h-4 w-4 transition-all duration-500 ${
        isDark ? 'rotate-0 scale-100' : 'rotate-90 scale-0'
      }`} />
    </Button>
  );
}
