import { useState, useEffect } from "react";

export type StripeMode = "test" | "live";

export function useStripeMode() {
  const [mode, setMode] = useState<StripeMode>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("stripeMode") as StripeMode) || "test"
    }
    return "test"
  })

  useEffect(() => {
    localStorage.setItem("stripeMode", mode)
  }, [mode])

  return { mode, setMode }
} 