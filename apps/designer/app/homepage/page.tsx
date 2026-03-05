"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomepageRedirect() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to root path
    router.replace('/')
  }, [router])

  return null
} 