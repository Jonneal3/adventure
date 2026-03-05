"use client";

import { Switch } from "./switch"
import { Label } from "./label"
import { useEffect, useState } from "react"
import { useToast } from "@/hooks"

export function ModeToggle() {
  const [isTestMode, setIsTestMode] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    // Initialize from localStorage
    const savedMode = localStorage.getItem('stripeMode')
    setIsTestMode(savedMode === 'test')
  }, [])

  const handleModeChange = (checked: boolean) => {
    const newMode = checked ? 'test' : 'live'
    localStorage.setItem('stripeMode', newMode)
    setIsTestMode(checked)
    
    toast({
      title: `Switched to ${newMode} mode`,
      description: `All Stripe operations will now use ${newMode} credentials`,
    })
  }

  return (
    <div className="flex items-center space-x-2">
      <Switch
        id="mode-toggle"
        checked={isTestMode}
        onCheckedChange={handleModeChange}
      />
      <Label htmlFor="mode-toggle">
        {isTestMode ? 'Test Mode' : 'Live Mode'}
      </Label>
    </div>
  )
} 