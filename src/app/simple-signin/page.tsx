"use client"

import { useEffect } from 'react'

export default function SimpleSigninRedirect() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL('/auth/signin', window.location.origin)
      url.searchParams.set('callbackUrl', '/dashboard')
      window.location.replace(url.toString())
    }
  }, [])

  return null
}
