'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRightIcon, PlayIcon } from '@heroicons/react/24/outline';

export default function SimpleDemoPage() {
  return (
    <main className='min-h-screen'>
      {/* Hero Section with Animated Background */}
      <div className='relative min-h-screen overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800'>
        {/* Animated background blobs */}
        <div className='absolute inset-0'>
          <div className='absolute top-0 -left-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob'></div>
          <div className='absolute top-0 -right-4 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000'></div>
          <div className='absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000'></div>
        </div>

        {/* Simple Navigation */}
        <nav className='relative z-20 flex items-center justify-between p-6 lg:px-8'>
          <div className='flex lg:flex-1'>
            <Link href='/' className='-m-1.5 p-1.5'>
              <span className='text-2xl font-bold text-white'>DirectFanz</span>
            </Link>
          </div>
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
        </nav>

        {/* Hero content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className='relative z-10 flex flex-col items-center justify-center min-h-[80vh] px-6 text-center'
        >
          <motion.h1
            className='text-5xl md:text-7xl font-bold text-white mb-8 leading-tight'
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            Connect with Your
            <span className='block bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent'>
              Superfans
            </span>
          </motion.h1>

          <motion.p
            className='text-xl md:text-2xl text-white/80 mb-12 max-w-2xl mx-auto leading-relaxed'
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            The ultimate platform for artists to monetize exclusive content and build deeper
            connections with their most dedicated fans.
          </motion.p>

          <motion.div
            className='flex flex-col sm:flex-row items-center justify-center gap-4'
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
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
          </motion.div>

          {/* Simple stats */}
          <motion.div
            className='mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto'
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
          >
            {[
              { number: '15K+', label: 'Active Artists' },
              { number: '250K+', label: 'Superfans' },
              { number: '$5M+', label: 'Artist Earnings' },
            ].map((stat, index) => (
              <motion.div
                key={index}
                className='glass rounded-2xl p-6 text-center hover:scale-105 transition-transform duration-300 animate-float'
                style={{ animationDelay: `${index * 0.5}s` }}
                whileHover={{ scale: 1.05 }}
              >
                <div className='text-3xl md:text-4xl font-bold text-white mb-2'>{stat.number}</div>
                <div className='text-white/70 text-sm uppercase tracking-wide'>{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <div className='absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10 animate-bounce'>
          <div className='w-6 h-10 border-2 border-white/30 rounded-full flex justify-center'>
            <div className='w-1 h-3 bg-white rounded-full animate-bounce mt-2'></div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <section className='py-24 bg-gray-50 relative overflow-hidden'>
        <div className='max-w-7xl mx-auto px-6 relative'>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className='text-center mb-20'
          >
            <h2 className='text-4xl md:text-6xl font-bold text-gray-900 mb-6'>
              Everything You Need to
              <span className='block bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent'>
                Succeed as a Creator
              </span>
            </h2>
            <p className='text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed'>
              Our platform provides all the tools and features you need to build, engage, and
              monetize your fanbase.
            </p>
          </motion.div>

          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8'>
            {[
              {
                title: 'Flexible Monetization',
                desc: 'Set your own subscription prices with daily payouts.',
                icon: '💰',
              },
              {
                title: 'Superfan Communities',
                desc: 'Build exclusive communities around your content.',
                icon: '👥',
              },
              {
                title: 'Secure & Private',
                desc: 'Enterprise-grade security with content protection.',
                icon: '🛡️',
              },
              {
                title: 'Advanced Analytics',
                desc: 'Deep insights into your audience and revenue trends.',
                icon: '📊',
              },
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                whileHover={{ y: -10 }}
                viewport={{ once: true }}
                className='bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300'
              >
                <div className='text-4xl mb-4'>{feature.icon}</div>
                <h3 className='text-xl font-bold text-gray-900 mb-4'>{feature.title}</h3>
                <p className='text-gray-600 leading-relaxed'>{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
        className='py-24 bg-gradient-to-r from-indigo-600 to-purple-600 relative overflow-hidden'
      >
        <div className='max-w-4xl mx-auto text-center px-6 relative'>
          <h2 className='text-4xl md:text-5xl font-bold text-white mb-6'>
            Ready to Transform Your Creative Career?
          </h2>
          <p className='text-xl text-white/90 mb-8 max-w-2xl mx-auto'>
            Join thousands of creators building sustainable income streams.
          </p>
          <Link
            href='/auth/signup'
            className='inline-flex items-center px-8 py-4 text-lg font-semibold text-indigo-600 bg-white rounded-full hover:bg-gray-50 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl'
          >
            Start Your Journey
            <ArrowRightIcon className='ml-2 w-5 h-5' />
          </Link>
        </div>
      </motion.section>
    </main>
  );
}
