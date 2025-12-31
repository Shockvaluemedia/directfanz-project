'use client';

import Link from 'next/link';
import { ArrowRightIcon } from '@heroicons/react/24/outline';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800">
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-8">
            <span className="block">DirectFanz</span>
            <span className="block bg-gradient-to-r from-pink-400 to-indigo-400 bg-clip-text text-transparent">
              Creator Platform
            </span>
          </h1>
          
          <p className="text-xl text-white/90 mb-12 max-w-3xl mx-auto">
            Turn your passion into sustainable income. Join thousands of creators earning directly from their fans.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href="/auth/signup"
              className="inline-flex items-center px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-xl"
            >
              Get Started Free
              <ArrowRightIcon className="ml-2 w-5 h-5" />
            </Link>
            <Link
              href="/discover"
              className="inline-flex items-center px-8 py-4 text-lg font-semibold text-white border-2 border-white/40 rounded-full hover:border-white/60 hover:bg-white/10 transition-all"
            >
              Explore Creators
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-3xl font-bold text-white mb-2">25K+</div>
              <div className="text-white/80">Active Creators</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-3xl font-bold text-white mb-2">$2.5M+</div>
              <div className="text-white/80">Paid to Creators</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-3xl font-bold text-white mb-2">95%</div>
              <div className="text-white/80">Revenue Share</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}