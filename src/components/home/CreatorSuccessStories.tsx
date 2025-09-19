'use client';

import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Star,
  TrendingUp,
  Users,
  DollarSign,
  Calendar,
} from 'lucide-react';

const CreatorSuccessStories = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const successStories = [
    {
      id: 1,
      name: 'Sarah Chen',
      username: '@sarahcreates',
      category: 'Lifestyle & Fashion',
      avatar: 'SC',
      location: 'Los Angeles, CA',
      joinDate: 'March 2023',
      story:
        "I was struggling on other platforms with high fees and limited customization. Since joining DirectFanz, I've tripled my monthly income and built a stronger connection with my audience through the advanced analytics and community features.",
      metrics: {
        monthlyEarnings: '$12,500',
        growthRate: '+340%',
        subscribers: '8,200',
        avgEngagement: '92%',
      },
      highlights: [
        'Reduced platform fees from 20% to 5%',
        'Built custom brand experience',
        'Increased subscriber retention by 85%',
        'Launched successful live streaming series',
      ],
      beforeAfter: {
        before: '$3,200/month',
        after: '$12,500/month',
        timeframe: '8 months',
      },
    },
    {
      id: 2,
      name: 'Marcus Rodriguez',
      username: '@marfitness',
      category: 'Fitness & Wellness',
      avatar: 'MR',
      location: 'Miami, FL',
      joinDate: 'January 2023',
      story:
        "As a fitness coach, I needed tools that could handle both my workout videos and live training sessions. DirectFanz's integrated approach helped me create multiple revenue streams and engage with my community like never before.",
      metrics: {
        monthlyEarnings: '$18,300',
        growthRate: '+425%',
        subscribers: '12,100',
        avgEngagement: '89%',
      },
      highlights: [
        'Launched premium workout programs',
        'Built exclusive fitness community',
        'Integrated live coaching sessions',
        'Created tiered subscription model',
      ],
      beforeAfter: {
        before: '$4,100/month',
        after: '$18,300/month',
        timeframe: '10 months',
      },
    },
    {
      id: 3,
      name: 'Emily Johnson',
      username: '@emilyartist',
      category: 'Digital Art & Design',
      avatar: 'EJ',
      location: 'Portland, OR',
      joinDate: 'June 2023',
      story:
        'The AI content protection was a game-changer for me. My digital art was being stolen on other platforms, but here I can share my process and tutorials without worry. The analytics help me understand what my fans love most.',
      metrics: {
        monthlyEarnings: '$9,800',
        growthRate: '+280%',
        subscribers: '5,600',
        avgEngagement: '94%',
      },
      highlights: [
        'Protected artwork with AI technology',
        'Launched digital art masterclasses',
        'Built international fan base',
        'Created exclusive design series',
      ],
      beforeAfter: {
        before: '$2,800/month',
        after: '$9,800/month',
        timeframe: '6 months',
      },
    },
    {
      id: 4,
      name: 'David Kim',
      username: '@davidmusic',
      category: 'Music & Entertainment',
      avatar: 'DK',
      location: 'Nashville, TN',
      joinDate: 'February 2023',
      story:
        'The multi-tier subscription system allowed me to offer different levels of access to my music and behind-the-scenes content. The live streaming feature has been incredible for virtual concerts and fan interactions.',
      metrics: {
        monthlyEarnings: '$15,200',
        growthRate: '$380%',
        subscribers: '9,400',
        avgEngagement: '91%',
      },
      highlights: [
        'Hosted 50+ virtual concerts',
        'Released exclusive music content',
        'Built global fan community',
        'Launched music production courses',
      ],
      beforeAfter: {
        before: '$3,800/month',
        after: '$15,200/month',
        timeframe: '9 months',
      },
    },
  ];

  // Auto-advance carousel
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % successStories.length);
    }, 8000);

    return () => clearInterval(interval);
  }, [isPlaying, successStories.length]);

  const nextStory = () => {
    setCurrentIndex(prev => (prev + 1) % successStories.length);
  };

  const prevStory = () => {
    setCurrentIndex(prev => (prev - 1 + successStories.length) % successStories.length);
  };

  const currentStory = successStories[currentIndex];

  return (
    <section className='py-16 px-4 bg-gradient-to-br from-purple-50 via-white to-blue-50'>
      <div className='max-w-7xl mx-auto'>
        {/* Header */}
        <div className='text-center mb-12'>
          <h2 className='text-3xl md:text-4xl font-bold text-gray-900 mb-4'>
            Real Stories, Real Success
          </h2>
          <p className='text-xl text-gray-600 max-w-3xl mx-auto'>
            See how creators are transforming their careers and building thriving communities on
            Direct Fan Platform
          </p>
        </div>

        {/* Main Story Display */}
        <div className='bg-white rounded-3xl shadow-2xl overflow-hidden'>
          <div className='grid grid-cols-1 lg:grid-cols-2'>
            {/* Left Side - Story Content */}
            <div className='p-8 lg:p-12'>
              {/* Creator Info */}
              <div className='flex items-start gap-4 mb-6'>
                <div className='w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg'>
                  {currentStory.avatar}
                </div>
                <div>
                  <h3 className='text-xl font-bold text-gray-900'>{currentStory.name}</h3>
                  <p className='text-blue-600 font-medium'>{currentStory.username}</p>
                  <p className='text-sm text-gray-600'>{currentStory.category}</p>
                  <div className='flex items-center gap-4 mt-2 text-sm text-gray-500'>
                    <span>📍 {currentStory.location}</span>
                    <span>📅 Joined {currentStory.joinDate}</span>
                  </div>
                </div>
              </div>

              {/* Story Quote */}
              <blockquote className='text-lg text-gray-700 leading-relaxed mb-8 italic'>
                "{currentStory.story}"
              </blockquote>

              {/* Key Highlights */}
              <div className='mb-8'>
                <h4 className='text-lg font-semibold text-gray-900 mb-4'>Key Achievements:</h4>
                <ul className='space-y-2'>
                  {currentStory.highlights.map((highlight, index) => (
                    <li key={index} className='flex items-center gap-2 text-gray-700'>
                      <Star className='w-4 h-4 text-yellow-500 flex-shrink-0' />
                      {highlight}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Before/After Earnings */}
              <div className='bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6'>
                <h4 className='text-lg font-semibold text-gray-900 mb-4'>
                  Earnings Transformation:
                </h4>
                <div className='flex items-center justify-between'>
                  <div className='text-center'>
                    <p className='text-sm text-gray-600 mb-1'>Before</p>
                    <p className='text-xl font-bold text-red-600'>
                      {currentStory.beforeAfter.before}
                    </p>
                  </div>
                  <div className='flex items-center text-green-600'>
                    <TrendingUp className='w-6 h-6' />
                  </div>
                  <div className='text-center'>
                    <p className='text-sm text-gray-600 mb-1'>After</p>
                    <p className='text-xl font-bold text-green-600'>
                      {currentStory.beforeAfter.after}
                    </p>
                  </div>
                </div>
                <p className='text-center text-sm text-gray-600 mt-2'>
                  In just {currentStory.beforeAfter.timeframe}
                </p>
              </div>
            </div>

            {/* Right Side - Metrics Dashboard */}
            <div className='bg-gradient-to-br from-blue-600 to-purple-700 p-8 lg:p-12 text-white'>
              <h4 className='text-2xl font-bold mb-8'>Current Performance</h4>

              <div className='grid grid-cols-2 gap-6 mb-8'>
                <div className='bg-white/10 rounded-xl p-4 text-center'>
                  <DollarSign className='w-8 h-8 mx-auto mb-2 text-green-300' />
                  <p className='text-sm opacity-80 mb-1'>Monthly Earnings</p>
                  <p className='text-2xl font-bold'>{currentStory.metrics.monthlyEarnings}</p>
                </div>

                <div className='bg-white/10 rounded-xl p-4 text-center'>
                  <TrendingUp className='w-8 h-8 mx-auto mb-2 text-yellow-300' />
                  <p className='text-sm opacity-80 mb-1'>Growth Rate</p>
                  <p className='text-2xl font-bold text-green-300'>
                    {currentStory.metrics.growthRate}
                  </p>
                </div>

                <div className='bg-white/10 rounded-xl p-4 text-center'>
                  <Users className='w-8 h-8 mx-auto mb-2 text-blue-300' />
                  <p className='text-sm opacity-80 mb-1'>Subscribers</p>
                  <p className='text-2xl font-bold'>{currentStory.metrics.subscribers}</p>
                </div>

                <div className='bg-white/10 rounded-xl p-4 text-center'>
                  <Star className='w-8 h-8 mx-auto mb-2 text-purple-300' />
                  <p className='text-sm opacity-80 mb-1'>Engagement</p>
                  <p className='text-2xl font-bold'>{currentStory.metrics.avgEngagement}</p>
                </div>
              </div>

              {/* Success Meter */}
              <div className='bg-white/10 rounded-xl p-4'>
                <p className='text-sm opacity-80 mb-2'>Success Score</p>
                <div className='w-full bg-white/20 rounded-full h-4'>
                  <div
                    className='bg-gradient-to-r from-yellow-300 to-green-300 h-4 rounded-full transition-all duration-1000'
                    style={{ width: '94%' }}
                  ></div>
                </div>
                <p className='text-right text-sm mt-1'>94/100</p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Controls */}
        <div className='flex justify-center items-center gap-4 mt-8'>
          <button
            onClick={prevStory}
            className='p-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 text-gray-600 hover:text-blue-600'
          >
            <ChevronLeft className='w-6 h-6' />
          </button>

          {/* Dots Indicator */}
          <div className='flex gap-2'>
            {successStories.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-3 h-3 rounded-full transition-all duration-200 ${
                  index === currentIndex ? 'bg-blue-600 w-8' : 'bg-gray-300 hover:bg-gray-400'
                }`}
              />
            ))}
          </div>

          <button
            onClick={nextStory}
            className='p-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 text-gray-600 hover:text-blue-600'
          >
            <ChevronRight className='w-6 h-6' />
          </button>
        </div>

        {/* Auto-play Toggle */}
        <div className='flex justify-center mt-4'>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className='text-sm text-gray-600 hover:text-blue-600 transition-colors'
          >
            {isPlaying ? '⏸️ Pause Auto-play' : '▶️ Start Auto-play'}
          </button>
        </div>

        {/* Bottom CTA */}
        <div className='text-center mt-12'>
          <div className='bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white max-w-4xl mx-auto'>
            <h3 className='text-2xl font-bold mb-4'>Your Success Story Starts Here</h3>
            <p className='text-blue-100 mb-6'>
              Join thousands of successful creators who've transformed their careers with Direct Fan
              Platform
            </p>
            <button className='bg-white text-blue-600 px-8 py-3 rounded-xl font-semibold hover:bg-blue-50 transition-colors'>
              Start Your Journey Today
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CreatorSuccessStories;
