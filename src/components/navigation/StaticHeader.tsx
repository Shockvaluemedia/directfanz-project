import Link from 'next/link';
import HeaderAuth from '@/components/navigation/HeaderAuth';

export default function StaticHeader() {
  return (
    <header className='bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex justify-between items-center h-16'>
          {/* Logo */}
          <div className='flex-shrink-0 flex items-center'>
            <Link href='/' className='flex items-center'>
              <div className='w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center mr-3 shadow-lg'>
                <span className='text-white font-bold text-lg'>DF</span>
              </div>
              <span className='text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent'>DirectFanz</span>
            </Link>
          </div>

          {/* Right Side - Session-aware auth controls */}
          <div className='flex items-center space-x-4'>
            <HeaderAuth />
          </div>
        </div>
      </div>
    </header>
  );
}
