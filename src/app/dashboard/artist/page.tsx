"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import ArtistDashboard from "@/components/dashboard/artist-dashboard"
import { LoadingSpinner } from '@/components/ui/loading'

export default function ArtistDashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "loading") return // Still loading

    if (!session) {
      router.push("/auth/signin")
      return
    }

    if (session.user.role !== "ARTIST") {
      router.push("/dashboard/fan")
      return
    }
  }, [session, status, router])

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" suppressHydrationWarning>
        <div className="flex flex-col items-center">
          <LoadingSpinner size="lg" />
          <p className="mt-3 text-sm text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!session || session.user.role !== "ARTIST") {
    return null // Router will redirect
  }

  return <ArtistDashboard />
}