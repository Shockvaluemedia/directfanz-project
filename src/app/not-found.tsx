'use client';

// Minimal not-found page without external imports to avoid hydration/module issues
export default function NotFound() {
  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50'>
      <div className='max-w-md w-full bg-white shadow-lg rounded-lg p-6 text-center'>
        <div className='text-2xl font-bold text-gray-900'>Page Not Found</div>
        <p className='mt-2 text-sm text-gray-600'>
          The page you&apos;re looking for does not exist or may have been moved.
        </p>
        <div className='mt-6 flex flex-col space-y-3'>
          <a
            href='/'
            className='w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700'
          >
            Go to Home Page
          </a>
          <button
            onClick={() => (typeof window !== 'undefined' ? window.history.back() : null)}
            className='w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50'
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
