'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ArrowRightIcon, PlayIcon } from '@heroicons/react/24/outline';

export default function TestSimplePage() {
  const { data: session } = useSession();

  return (
    <main className='min-h-screen'>
      {/* Simple Hero Section */}
      <div className='relative min-h-screen overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800'>
        {/* Simple animated blobs - no external images */}
        <div className='absolute inset-0'>
          <div className='absolute top-0 -left-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob'></div>
          <div className='absolute top-0 -right-4 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000'></div>
          <div className='absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000'></div>
        </div>

        {/* Navigation */}
        <nav className='relative z-20 flex items-center justify-between p-6 lg:px-8'>
          <div className='flex lg:flex-1'>
            <Link href='/' className='-m-1.5 p-1.5'>
              <span className='text-2xl font-bold text-white'>Direct Fan Platform</span>
            </Link>
          </div>
          <div className='flex items-center space-x-4'>
            {session ? (
              <div className='flex items-center space-x-4'>
                <span className='text-white'>Welcome, {session.user?.name}</span>
                <Link
                  href={session.user?.role === 'ARTIST' ? '/dashboard/artist' : '/dashboard/fan'}
                  className='rounded-md bg-white/10 backdrop-blur-sm px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-white/20 transition-all'
                >
                  Dashboard
                </Link>
              </div>
            ) : (
              <div className='flex items-center space-x-4'>
                <Link href='/auth/signin' className='text-white hover:text-white/80 font-medium'>
                  Sign In
                </Link>
                <Link
                  href='/auth/signup'
                  className='rounded-md bg-white/10 backdrop-blur-sm px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-white/20 transition-all'
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </nav>

        {/* Hero content - no complex animations */}
        <div className='relative z-10 flex flex-col items-center justify-center min-h-[80vh] px-6 text-center'>
          <div className='max-w-4xl mx-auto'>
            <h1 className='text-5xl md:text-7xl font-bold text-white mb-8 leading-tight'>
              Connect with Your
              <span className='block bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent'>
                Superfans
              </span>
            </h1>

            <p className='text-xl md:text-2xl text-white/80 mb-12 max-w-2xl mx-auto leading-relaxed'>
              The ultimate platform for artists to monetize exclusive content and build deeper
              connections with their most dedicated fans.
            </p>

            <div className='flex flex-col sm:flex-row items-center justify-center gap-4'>
              {!session && (
                <>
                  <Link
                    href='/auth/signup'
                    className='group inline-flex items-center px-8 py-4 text-lg font-semibold text-purple-900 bg-white rounded-full hover:bg-white/90 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl'
                  >
                    Get Started Free
                    <ArrowRightIcon className='ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform' />
                  </Link>
                  <button className='group inline-flex items-center px-8 py-4 text-lg font-semibold text-white border-2 border-white/30 rounded-full hover:border-white/50 hover:bg-white/10 transition-all backdrop-blur-sm'>
                    <PlayIcon className='mr-2 w-5 h-5 group-hover:scale-110 transition-transform' />
                    Watch Demo
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Simple stats without animations */}
          <div className='mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto'>
            <div className='glass rounded-2xl p-6 text-center hover:scale-105 transition-transform duration-300'>
              <div className='text-3xl md:text-4xl font-bold text-white mb-2'>15K+</div>
              <div className='text-white/70 text-sm uppercase tracking-wide'>Active Artists</div>
            </div>
            <div className='glass rounded-2xl p-6 text-center hover:scale-105 transition-transform duration-300'>
              <div className='text-3xl md:text-4xl font-bold text-white mb-2'>250K+</div>
              <div className='text-white/70 text-sm uppercase tracking-wide'>Superfans</div>
            </div>
            <div className='glass rounded-2xl p-6 text-center hover:scale-105 transition-transform duration-300'>
              <div className='text-3xl md:text-4xl font-bold text-white mb-2'>$5M+</div>
              <div className='text-white/70 text-sm uppercase tracking-wide'>Artist Earnings</div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className='absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10 animate-bounce'>
          <div className='w-6 h-10 border-2 border-white/30 rounded-full flex justify-center'>
            <div className='w-1 h-3 bg-white rounded-full animate-bounce mt-2'></div>
          </div>
        </div>
      </div>

      {/* Simple Features Section */}
      <section className='py-24 bg-gray-50 relative overflow-hidden'>
        <div className='max-w-7xl mx-auto px-6 relative'>
          <div className='text-center mb-20'>
            <h2 className='text-4xl md:text-6xl font-bold text-gray-900 mb-6'>
              Everything You Need to
              <span className='block bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent'>
                Succeed as a Creator
              </span>
            </h2>
            <p className='text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed'>
              Our platform provides all the tools and features you need to build, engage, and
              monetize your fanbase like never before.
            </p>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8'>
            <div className='bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2'>
              <div className='text-4xl mb-4'>💰</div>
              <h3 className='text-xl font-bold text-gray-900 mb-4'>Flexible Monetization</h3>
              <p className='text-gray-600 leading-relaxed'>
                Set your own subscription prices with daily payouts through Stripe.
              </p>
            </div>

            <div className='bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2'>
              <div className='text-4xl mb-4'>👥</div>
              <h3 className='text-xl font-bold text-gray-900 mb-4'>Superfan Communities</h3>
              <p className='text-gray-600 leading-relaxed'>
                Build exclusive communities around your content.
              </p>
            </div>

            <div className='bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2'>
              <div className='text-4xl mb-4'>🛡️</div>
              <h3 className='text-xl font-bold text-gray-900 mb-4'>Secure & Private</h3>
              <p className='text-gray-600 leading-relaxed'>
                Enterprise-grade security with end-to-end encryption.
              </p>
            </div>

            <div className='bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2'>
              <div className='text-4xl mb-4'>📊</div>
              <h3 className='text-xl font-bold text-gray-900 mb-4'>Advanced Analytics</h3>
              <p className='text-gray-600 leading-relaxed'>
                Deep insights into your audience and revenue trends.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Simple Testimonials */}
      <section className='py-24 bg-white'>
        <div className='max-w-6xl mx-auto px-6'>
          <div className='text-center mb-16'>
            <h2 className='text-4xl md:text-5xl font-bold text-gray-900 mb-6'>
              Success Stories from
              <span className='block bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent'>
                Real Creators
              </span>
            </h2>
          </div>

          <div className='grid md:grid-cols-3 gap-8'>
            <div className='bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100'>
              <div className='flex space-x-1 mb-6'>
                <span className='text-yellow-400'>⭐⭐⭐⭐⭐</span>
              </div>
              <p className='text-gray-700 leading-relaxed mb-6'>
                This platform completely transformed how I connect with my fans. Revenue increased
                by 400%.
              </p>
              <div className='flex items-center'>
                <div className='w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-bold mr-4'>
                  SC
                </div>
                <div>
                  <div className='font-semibold text-gray-900'>Sarah Chen</div>
                  <div className='text-gray-600 text-sm'>Music Artist</div>
                </div>
              </div>
            </div>

            <div className='bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100'>
              <div className='flex space-x-1 mb-6'>
                <span className='text-yellow-400'>⭐⭐⭐⭐⭐</span>
              </div>
              <p className='text-gray-700 leading-relaxed mb-6'>
                The analytics dashboard gives me incredible insights into my audience.
              </p>
              <div className='flex items-center'>
                <div className='w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold mr-4'>
                  MR
                </div>
                <div>
                  <div className='font-semibold text-gray-900'>Marcus Rodriguez</div>
                  <div className='text-gray-600 text-sm'>Digital Artist</div>
                </div>
              </div>
            </div>

            <div className='bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100'>
              <div className='flex space-x-1 mb-6'>
                <span className='text-yellow-400'>⭐⭐⭐⭐⭐</span>
              </div>
              <p className='text-gray-700 leading-relaxed mb-6'>
                The security features give me peace of mind when sharing exclusive content.
              </p>
              <div className='flex items-center'>
                <div className='w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white font-bold mr-4'>
                  LW
                </div>
                <div>
                  <div className='font-semibold text-gray-900'>Luna Williams</div>
                  <div className='text-gray-600 text-sm'>Content Creator</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className='fixed bottom-4 left-4 bg-green-600 text-white p-2 rounded text-xs'>
        ✅ Simple Test Page Working
      </div>
    </main>
  );
}
