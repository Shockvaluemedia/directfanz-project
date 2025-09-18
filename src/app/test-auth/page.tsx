'use client'

import AuthTestForm from './AuthTestForm'

export default function TestAuthPage() {
  return (
    <div className="min-h-screen p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Auth Test</h1>
        <AuthTestForm />
        <div className="rounded border p-4">
          <div className="font-semibold mb-2">Quick Links</div>
          <ul className="list-disc list-inside text-sm space-y-1">
            <li><a className="text-indigo-600 underline" href="/api/auth/session" target="_blank" rel="noreferrer">GET /api/auth/session</a></li>
            <li><a className="text-indigo-600 underline" href="/auth/signin">Signin Page</a></li>
            <li><a className="text-indigo-600 underline" href="/dashboard/artist">Artist Dashboard</a></li>
            <li><a className="text-indigo-600 underline" href="/dashboard/fan">Fan Dashboard</a></li>
          </ul>
        </div>
      </div>
    </div>
  )
}
