"use client"

import { useState } from 'react'
import { signIn, getSession } from 'next-auth/react'

export default function TestSigninPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const handleTest = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      console.log('Testing signin...')
      
      const signinResult = await signIn('credentials', {
        email,
        password,
        redirect: false
      })
      
      console.log('Signin result:', signinResult)
      
      if (signinResult?.ok) {
        const session = await getSession()
        console.log('Session:', session)
        
        setResult({
          success: true,
          signin: signinResult,
          session: session
        })
        
        // Try to navigate
        if (session?.user?.role === 'ARTIST') {
          console.log('Should redirect to /dashboard/artist')
          window.location.href = '/dashboard/artist'
        } else {
          console.log('Should redirect to /dashboard/fan')
          window.location.href = '/dashboard/fan'
        }
        
      } else {
        setResult({
          success: false,
          error: signinResult?.error || 'Unknown error'
        })
      }
      
    } catch (error) {
      console.error('Test error:', error)
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Simple Signin Test</h1>
      
      <div style={{ marginBottom: '10px' }}>
        <label>Email:</label>
        <input 
          type="email" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: '100%', padding: '5px' }}
        />
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <label>Password:</label>
        <input 
          type="password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: '100%', padding: '5px' }}
        />
      </div>
      
      <button 
        onClick={handleTest} 
        disabled={loading}
        style={{ 
          padding: '10px 20px', 
          background: '#4f46e5', 
          color: 'white', 
          border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? 'Testing...' : 'Test Signin'}
      </button>
      
      {result && (
        <div style={{ 
          marginTop: '20px', 
          padding: '10px', 
          background: result.success ? '#d4edda' : '#f8d7da',
          border: `1px solid ${result.success ? '#c3e6cb' : '#f5c6cb'}`
        }}>
          <h3>{result.success ? '✅ Success' : '❌ Failed'}</h3>
          <pre style={{ whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}