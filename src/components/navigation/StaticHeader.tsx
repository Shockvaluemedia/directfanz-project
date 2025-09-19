import Link from 'next/link';

export default function StaticHeader() {
  return (
    <header className='bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex justify-between items-center h-16'>
          {/* Logo */}
          <div className='flex-shrink-0 flex items-center'>
            <Link href='/' className='flex items-center'>
              <div className='w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center mr-3'>
                <span className='text-white font-bold text-lg'>D</span>
              </div>
              <span className='text-xl font-bold text-gray-900'>Direct Fan</span>
            </Link>
          </div>

          {/* Right Side - Static Links */}
          <div className='flex items-center space-x-4'>
            <div className='hidden sm:flex items-center space-x-4'>
              <Link href='/auth/signin' className='text-gray-600 hover:text-gray-900 font-medium'>
                Sign In
              </Link>
              <Link
                href='/auth/signup'
                className='bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors'
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
