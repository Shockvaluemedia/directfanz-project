'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import ArtistProfile from '@/components/fan/artist-profile'

interface ArtistPageProps {
  params: { id: string }
}

export default function ArtistPage({ params }: ArtistPageProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/auth/signin')
      return
    }

    if (session.user.role !== 'FAN') {
      router.push('/dashboard/artist')
      return
    }

    async function fetchData() {
      try {
        const response = await fetch(`/api/fan/artists/${params.id}`)
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Artist not found')
            return
          }
          throw new Error('Failed to fetch artist data')
        }
        
        const result = await response.json()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [params.id, session, status, router])

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading artist profile...</p>
        </div>
      </div>
    )
  }

  if (!session || session.user.role !== 'FAN') {
    return null
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {error === 'Artist not found' ? 'Artist Not Found' : 'Error'}
          </h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/discover')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Discovery
          </button>
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ArtistProfile 
        artist={data.artist} 
        existingSubscriptions={data.existingSubscriptions} 
      />
    </div>
  )
}