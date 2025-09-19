'use client';

import { useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';

export default function AuthTestForm() {
  const { data: session, status } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [apiSession, setApiSession] = useState(null);

  const doCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('Signing in...');

    try {
      console.log('🟡 Attempting signin with:', { email, password });
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl: '/dashboard',
      });

      console.log('🟡 SignIn result:', result);

      if (result?.error) {
        setMessage(`Error: ${result.error}`);
      } else if (result?.ok) {
        setMessage(`Success! - ${new Date().toLocaleTimeString()}`);
        setApiSession(null); // Clear cached API session to force refresh
      } else {
        setMessage('Unknown result from signin');
      }
    } catch (error: any) {
      console.error('🔴 Signin error:', error);
      setMessage(`Error: ${error?.message || String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className='rounded border p-4'>
        <div className='font-semibold mb-2'>Session</div>
        <pre className='bg-gray-50 p-3 rounded text-sm overflow-auto'>
          {JSON.stringify({ status, session }, null, 2)}
        </pre>
      </div>

      <div className='rounded border p-4 space-y-2'>
        <div className='font-semibold'>Server Session (GET /api/auth/session)</div>
        <div className='flex items-center gap-2'>
          <button
            type='button'
            onClick={async () => {
              try {
                const res = await fetch('/api/auth/session', { credentials: 'include' });
                const json = await res.json().catch(() => null);
                setApiSession(json);
                setMessage(`GET /api/auth/session: ${res.status}`);
              } catch (e: any) {
                setMessage(`Error fetching /api/auth/session: ${e?.message || String(e)}`);
              }
            }}
            className='border rounded px-4 py-2'
          >
            Check session
          </button>
          <a
            className='text-indigo-600 underline'
            href='/api/auth/session'
            target='_blank'
            rel='noreferrer'
          >
            open in new tab
          </a>
        </div>
        <pre className='bg-gray-50 p-3 rounded text-sm overflow-auto'>
          {JSON.stringify(apiSession, null, 2)}
        </pre>
      </div>

      <form onSubmit={doCredentialsLogin} className='rounded border p-4 space-y-3'>
        <div className='font-semibold'>Credentials Signin</div>
        <input
          className='w-full border rounded p-2'
          type='email'
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder='Email'
          required
        />
        <input
          className='w-full border rounded p-2'
          type='password'
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder='Password'
          required
        />
        <button
          type='submit'
          className='bg-indigo-600 text-white rounded px-4 py-2 disabled:opacity-50'
          disabled={loading}
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
        <button
          type='button'
          onClick={async () => {
            console.log('🔴 Signout button clicked');
            setLoading(true);
            setMessage('Signing out...');
            try {
              console.log('🔴 Calling signOut()');
              const result = await signOut({ redirect: false });
              console.log('🔴 SignOut result:', result);
              setMessage(`Signout successful - ${new Date().toLocaleTimeString()}`);
              setApiSession(null); // Clear the cached API session
            } catch (err: any) {
              console.error('🔴 Signout error:', err);
              setMessage(`Signout error: ${err.message || String(err)}`);
            } finally {
              console.log('🔴 Signout finally block');
              setLoading(false);
            }
          }}
          className='ml-3 border rounded px-4 py-2 disabled:opacity-50'
          disabled={loading}
        >
          {loading && message.includes('Signing out') ? 'Signing out...' : 'Sign out'}
        </button>

        {message && <div className='mt-2 text-sm'>{message}</div>}
      </form>
    </>
  );
}
