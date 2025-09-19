'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ArrowRightIcon, PlayIcon } from '@heroicons/react/24/outline';

export default function HeroSection() {
  const { data: session } = useSession();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: 0.3,
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5,
      },
    },
  };

  return (
    <div className='relative min-h-screen overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800'>
      {/* Animated background elements */}
      <div className='absolute inset-0'>
        <div className='absolute top-0 -left-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob'></div>
        <div className='absolute top-0 -right-4 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000'></div>
        <div className='absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000'></div>
      </div>

      {/* Navigation */}
      <nav className='relative z-20 flex items-center justify-between p-6 lg:px-8'>
        <div className='flex lg:flex-1'>
          <Link href='/' className='-m-1.5 p-1.5'>
            <span className='text-2xl font-bold text-white'>DirectFanz</span>
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

      {/* Hero content */}
      <motion.div
        variants={containerVariants}
        initial='hidden'
        animate='visible'
        className='relative z-10 flex flex-col items-center justify-center min-h-[80vh] px-6 text-center'
      >
        <motion.div variants={itemVariants} className='max-w-4xl mx-auto'>
          <motion.h1
            className='text-5xl md:text-7xl font-bold text-white mb-8 leading-tight'
            variants={itemVariants}
          >
            Connect with Your
            <span className='block bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent'>
              Superfans
            </span>
          </motion.h1>

          <motion.p
            className='text-xl md:text-2xl text-white/80 mb-12 max-w-2xl mx-auto leading-relaxed'
            variants={itemVariants}
          >
            The ultimate platform for artists to monetize exclusive content and build deeper
            connections with their most dedicated fans.
          </motion.p>

          <motion.div
            className='flex flex-col sm:flex-row items-center justify-center gap-4'
            variants={itemVariants}
          >
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
                  <PlayIcon className='mr-2 w-5 h-5' />
                  Watch Demo
                </button>
              </>
            )}
          </motion.div>
        </motion.div>

        {/* Floating stats */}
        <motion.div
          className='mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto'
          variants={containerVariants}
        >
          {[
            { number: '10K+', label: 'Active Artists' },
            { number: '50K+', label: 'Superfans' },
            { number: '$1M+', label: 'Artist Earnings' },
          ].map((stat, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className='bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center'
            >
              <div className='text-3xl md:text-4xl font-bold text-white mb-2'>{stat.number}</div>
              <div className='text-white/70 text-sm uppercase tracking-wide'>{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <div className='absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10'>
        <div className='w-6 h-10 border-2 border-white/30 rounded-full flex justify-center'>
          <div className='w-1 h-3 bg-white rounded-full animate-bounce mt-2'></div>
        </div>
      </div>
    </div>
  );
}
