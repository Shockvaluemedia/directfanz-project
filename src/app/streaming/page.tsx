'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function StreamingPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the existing streams page
    router.replace('/streams');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
        <p className="mt-4 text-gray-600">Redirecting to streams...</p>
      </div>
    </div>
  );
}