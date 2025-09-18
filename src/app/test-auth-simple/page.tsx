'use client'

import { useState } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'

export default function SimpleTestAuthPage() {
  const { data: session, status } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const doSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })
      console.log('SignIn result:', result)
    } catch (error) {
      console.error('Signin error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl mb-4">Simple Auth Test</h1>
      
      <div className="mb-4 p-4 border">
        <h2 className="font-bold">Session Status: {status}</h2>
        <pre className="text-sm">
          {JSON.stringify(session, null, 2)}
        </pre>
      </div>

      <form onSubmit={doSignIn} className="space-y-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="border p-2 w-full"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="border p-2 w-full"
        />
        <button 
          type="submit" 
          disabled={loading}
          className="bg-blue-500 text-white p-2 rounded"
        >
          {loading ? 'Loading...' : 'Sign In'}
        </button>
        
        <button
          type="button"
          onClick={() => signOut({ redirect: false })}
          className="bg-red-500 text-white p-2 rounded ml-2"
        >
          Sign Out
        </button>
      </form>
    </div>
  )
}