'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';

// Separate client component for sign out button
function SignOutButton() {
  const handleSignOut = () => {
    signOut();
  };
  
  return (
    <button
      onClick={handleSignOut}
      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm font-medium"
    >
      Sign Out
    </button>
  );
}

export default function SimpleNav() {
  const { data: session, status } = useSession();

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xl font-bold text-gray-900">
              Nahvee Even 🎵
            </Link>
            
            {/* Main Navigation */}
            <div className="flex space-x-4">
              <Link 
                href="/campaigns" 
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Campaigns
              </Link>
              
              {session && (
                <>
                  {session.user.role === 'FAN' && (
                    <Link 
                      href="/dashboard/fan" 
                      className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                    >
                      Fan Dashboard
                    </Link>
                  )}
                  
                  {session.user.role === 'ARTIST' && (
                    <Link 
                      href="/dashboard/artist" 
                      className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                    >
                      Artist Dashboard
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>
          
          {/* User Menu */}
          <div className="flex items-center gap-4">
            {status === 'loading' ? (
              <div className="text-sm text-gray-500">Loading...</div>
            ) : session ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-700">
                  {session.user.name} ({session.user.role})
                </span>
                <SignOutButton />
              </div>
            ) : (
              <Link
                href="/auth/signin"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}