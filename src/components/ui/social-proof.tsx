'use client';

import { useEffect, useState } from 'react';

interface StatCardProps {
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
}

function StatCard({ value, label, prefix = '', suffix = '' }: StatCardProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="text-center p-6 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300">
        <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
          {prefix}0{suffix}
        </div>
        <div className="text-gray-300 text-sm md:text-base font-medium">
          {label}
        </div>
      </div>
    );
  }

  return (
    <div className="text-center p-6 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300 animate-pulse">
      <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
        {prefix}{value.toLocaleString()}{suffix}
      </div>
      <div className="text-gray-300 text-sm md:text-base font-medium">
        {label}
      </div>
    </div>
  );
}

export function SocialProof() {
  return (
    <section className="py-20 bg-gradient-to-b from-gray-900 to-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Creators Are Thriving
            </span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Join thousands of creators who have already transformed their passion into sustainable income
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <StatCard 
            value={25000} 
            label="Active Creators"
            suffix="+"
          />
          <StatCard 
            value={1200000} 
            label="Monthly Content Views"
            suffix="+"
          />
          <StatCard 
            value={2800} 
            label="Average Monthly Creator Earnings"
            prefix="$"
          />
          <StatCard 
            value={95} 
            label="Creator Retention Rate"
            suffix="%"
          />
        </div>

        {/* Featured Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
            <div className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
              80%
            </div>
            <div className="text-xl font-semibold text-white mb-2">Higher Earnings</div>
            <div className="text-gray-300">Than traditional streaming platforms</div>
          </div>

          <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-green-500/20 to-blue-500/20 border border-green-500/30">
            <div className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent mb-4">
              24h
            </div>
            <div className="text-xl font-semibold text-white mb-2">Daily Payouts</div>
            <div className="text-gray-300">Get paid every single day</div>
          </div>

          <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30">
            <div className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent mb-4">
              0%
            </div>
            <div className="text-xl font-semibold text-white mb-2">Platform Fees</div>
            <div className="text-gray-300">Free to join, always</div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <div className="inline-flex items-center gap-4 px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-white font-semibold hover:from-purple-700 hover:to-pink-700 transition-all duration-300 transform hover:scale-105 cursor-pointer">
            <span>Join 25,000+ Successful Creators</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5-5 5M6 12h12" />
            </svg>
          </div>
          <p className="text-gray-400 mt-4 text-sm">
            Setup takes less than 5 minutes • No credit card required
          </p>
        </div>
      </div>
    </section>
  );
}