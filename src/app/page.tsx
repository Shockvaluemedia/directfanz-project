'use client';

import Link from 'next/link';
import { ArrowRightIcon, PlayIcon, SparklesIcon, RocketLaunchIcon, CheckIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';

// Lazy load heavy components for better performance
const PricingSection = dynamic(() => import('@/components/home/pricing-section'), {
  loading: () => <div className="py-24 bg-gray-50 animate-pulse"><div className="max-w-7xl mx-auto px-6"><div className="h-96 bg-gray-200 rounded-lg"></div></div></div>
});

const DemoPreviewSection = dynamic(() => import('@/components/home/demo-preview-section'), {
  loading: () => <div className="py-24 bg-white animate-pulse"><div className="max-w-7xl mx-auto px-6"><div className="h-96 bg-gray-200 rounded-lg"></div></div></div>
});

const SocialProof = dynamic(() => import('@/components/ui/social-proof').then(mod => ({ default: mod.SocialProof })), {
  loading: () => <div className="py-20 bg-gradient-to-b from-gray-900 to-black animate-pulse"><div className="max-w-7xl mx-auto px-6"><div className="h-64 bg-gray-800 rounded-lg"></div></div></div>
});

const ComparisonTable = dynamic(() => import('@/components/home/ComparisonTable'), {
  loading: () => <div className="py-16 bg-gradient-to-br from-slate-50 to-blue-50 animate-pulse"><div className="max-w-7xl mx-auto px-6"><div className="h-96 bg-gray-200 rounded-lg"></div></div></div>
});

const CreatorSuccessStories = dynamic(() => import('@/components/home/CreatorSuccessStories'), {
  loading: () => <div className="py-16 bg-gradient-to-br from-purple-50 via-white to-blue-50 animate-pulse"><div className="max-w-7xl mx-auto px-6"><div className="h-96 bg-gray-200 rounded-lg"></div></div></div>
});

const FAQ = dynamic(() => import('@/components/home/FAQ'), {
  loading: () => <div className="py-16 bg-gradient-to-br from-gray-50 to-blue-50 animate-pulse"><div className="max-w-7xl mx-auto px-6"><div className="h-96 bg-gray-200 rounded-lg"></div></div></div>
});

// Client components for interactive elements
function DemoButton() {
  const handleDemoClick = () => {
    const demoSection = document.querySelector('#demo-section');
    if (demoSection) {
      demoSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <button
      onClick={handleDemoClick}
      className='group inline-flex items-center px-6 md:px-8 py-3 md:py-4 text-base md:text-lg font-semibold text-white border-2 border-white/40 rounded-full hover:border-white/60 hover:bg-white/10 transition-all backdrop-blur-sm shadow-lg hover:shadow-xl'
    >
      <PlayIcon className='mr-2 w-4 md:w-5 h-4 md:h-5 group-hover:scale-110 transition-transform' />
      <span className='hidden sm:inline'>See DirectFanz in Action</span>
      <span className='sm:hidden'>Watch Demo</span>
    </button>
  );
}

export default function Home() {
  return (
    <div className='-mx-4 sm:-mx-6 lg:-mx-8 -my-6'>
      {/* Hero Section with Animated Background */}
      <div className='relative min-h-screen overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800'>
        {/* Animated background blobs */}
        <div className='absolute inset-0'>
          <div className='absolute top-0 -left-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob'></div>
          <div className='absolute top-0 -right-4 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000'></div>
          <div className='absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000'></div>
        </div>

        {/* Hero content */}
        <div className='relative z-10 flex flex-col items-center justify-center min-h-[80vh] px-6 text-center'>
          <div className='max-w-5xl mx-auto'>
            {/* Strategic Marketing Messages */}
            <div className='mb-8 flex flex-wrap justify-center gap-3'>
              <div className='inline-flex items-center px-6 py-3 bg-gradient-to-r from-red-500/20 to-pink-500/20 border border-red-400/40 rounded-full text-red-100 text-sm font-semibold backdrop-blur-sm'>
                <SparklesIcon className='w-4 h-4 mr-2' />
                Beyond Streaming Limits
              </div>
              <div className='inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-400/40 rounded-full text-green-100 text-sm font-semibold backdrop-blur-sm'>
                <RocketLaunchIcon className='w-4 h-4 mr-2' />
                Direct Fan Monetization
              </div>
            </div>

            <h1 className='text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-8 leading-tight'>
              <span className='block'>Turn Your Passion Into</span>
              <span className='block bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent'>
                Sustainable Income
              </span>
            </h1>

            <p className='text-lg md:text-xl lg:text-2xl text-white/90 mb-12 max-w-4xl mx-auto leading-relaxed'>
              Join 25,000+ creators earning directly from their fans on <span className='font-semibold text-white'>DirectFanz</span>. 
              Keep 95% of your earnings with daily payouts, advanced analytics, and zero platform fees to start.
            </p>

            <div className='flex flex-col sm:flex-row items-center justify-center gap-4'>
              <Link
                href='/auth/signup'
                className='group inline-flex items-center px-6 md:px-8 py-3 md:py-4 text-base md:text-lg font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-xl hover:shadow-2xl'
              >
                <span className='hidden sm:inline'>Start Creating Today</span>
                <span className='sm:hidden'>Get Started Free</span>
                <ArrowRightIcon className='ml-2 w-4 md:w-5 h-4 md:h-5 group-hover:translate-x-1 transition-transform' />
              </Link>
              <DemoButton />
            </div>
          </div>

          {/* Stats */}
          <div className='mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto'>
            <div className='glass rounded-2xl p-6 md:p-8 text-center hover:scale-105 transition-transform duration-300 border border-white/20'>
              <div className='text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-blue-300 to-purple-300 bg-clip-text text-transparent mb-3'>25K+</div>
              <div className='text-white/90 text-sm md:text-base font-medium mb-2'>Active Creators</div>
              <div className='text-white/60 text-xs md:text-sm'>Earning daily from their content</div>
            </div>
            <div className='glass rounded-2xl p-6 md:p-8 text-center hover:scale-105 transition-transform duration-300 border border-white/20'>
              <div className='text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-green-300 to-emerald-300 bg-clip-text text-transparent mb-3'>$2.5M+</div>
              <div className='text-white/90 text-sm md:text-base font-medium mb-2'>Paid to Creators</div>
              <div className='text-white/60 text-xs md:text-sm'>In the last 12 months</div>
            </div>
            <div className='glass rounded-2xl p-6 md:p-8 text-center hover:scale-105 transition-transform duration-300 border border-white/20'>
              <div className='text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-pink-300 to-rose-300 bg-clip-text text-transparent mb-3'>95%</div>
              <div className='text-white/90 text-sm md:text-base font-medium mb-2'>Revenue Share</div>
              <div className='text-white/60 text-xs md:text-sm'>You keep almost everything</div>
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

      {/* Quick Features Section */}
      <section id="features" className='py-16 bg-white'>
        <div className='max-w-7xl mx-auto px-6'>
          <div className='text-center mb-12'>
            <h2 className='text-3xl md:text-4xl font-bold text-gray-900 mb-4'>
              Why Creators Choose DirectFanz
            </h2>
            <p className='text-xl text-gray-600 max-w-3xl mx-auto'>
              Everything you need to build, grow, and monetize your creative community
            </p>
          </div>
          
          <div className='grid grid-cols-1 md:grid-cols-3 gap-8'>
            <div className='text-center p-6 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100'>
              <div className='w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4'>
                <span className='text-white text-2xl font-bold'>5%</span>
              </div>
              <h3 className='text-xl font-bold text-gray-900 mb-2'>Lowest Platform Fee</h3>
              <p className='text-gray-600'>Keep 95% of your earnings with daily payouts</p>
            </div>
            
            <div className='text-center p-6 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100'>
              <div className='w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4'>
                <StarIconSolid className='w-8 h-8 text-white' />
              </div>
              <h3 className='text-xl font-bold text-gray-900 mb-2'>Premium Features</h3>
              <p className='text-gray-600'>Live streaming, analytics, and content protection</p>
            </div>
            
            <div className='text-center p-6 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100'>
              <div className='w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4'>
                <span className='text-white text-xl'>24/7</span>
              </div>
              <h3 className='text-xl font-bold text-gray-900 mb-2'>Creator Support</h3>
              <p className='text-gray-600'>Dedicated support team and creator community</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className='py-16 bg-gray-50'>
        <div className='max-w-7xl mx-auto px-6'>
          <div className='text-center mb-12'>
            <h2 className='text-3xl md:text-4xl font-bold text-gray-900 mb-4'>
              Loved by 25,000+ Creators
            </h2>
          </div>
          
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8'>
            {[
              {
                name: 'Sarah Chen',
                role: 'Digital Artist',
                content: 'DirectFanz helped me triple my monthly income. The AI content protection gives me peace of mind.',
                earnings: '$12,500/month'
              },
              {
                name: 'Marcus Rodriguez', 
                role: 'Fitness Coach',
                content: 'The live streaming features are incredible. I can host workout sessions and connect with my community.',
                earnings: '$18,300/month'
              },
              {
                name: 'Emily Johnson',
                role: 'Music Producer',
                content: 'Finally, a platform that values creators. The 5% fee means I keep almost everything I earn.',
                earnings: '$9,800/month'
              }
            ].map((testimonial, i) => (
              <div key={i} className='bg-white rounded-xl p-6 shadow-lg'>
                <div className='flex items-center mb-4'>
                  <div className='w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold'>
                    {testimonial.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className='ml-4'>
                    <h4 className='font-bold text-gray-900'>{testimonial.name}</h4>
                    <p className='text-gray-600 text-sm'>{testimonial.role}</p>
                  </div>
                </div>
                <p className='text-gray-700 mb-4 italic'>"{testimonial.content}"</p>
                <div className='text-green-600 font-bold'>{testimonial.earnings}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lazy loaded sections */}
      <div id="demo-section">
        <Suspense fallback={<div className="py-24 bg-white animate-pulse"><div className="max-w-7xl mx-auto px-6"><div className="h-96 bg-gray-200 rounded-lg"></div></div></div>}>
          <DemoPreviewSection />
        </Suspense>
      </div>

      <Suspense fallback={<div className="py-20 bg-gradient-to-b from-gray-900 to-black animate-pulse"><div className="max-w-7xl mx-auto px-6"><div className="h-64 bg-gray-800 rounded-lg"></div></div></div>}>
        <SocialProof />
      </Suspense>

      <Suspense fallback={<div className="py-24 bg-gray-50 animate-pulse"><div className="max-w-7xl mx-auto px-6"><div className="h-96 bg-gray-200 rounded-lg"></div></div></div>}>
        <PricingSection />
      </Suspense>

      <Suspense fallback={<div className="py-16 bg-gradient-to-br from-purple-50 via-white to-blue-50 animate-pulse"><div className="max-w-7xl mx-auto px-6"><div className="h-96 bg-gray-200 rounded-lg"></div></div></div>}>
        <CreatorSuccessStories />
      </Suspense>

      <Suspense fallback={<div className="py-16 bg-gradient-to-br from-slate-50 to-blue-50 animate-pulse"><div className="max-w-7xl mx-auto px-6"><div className="h-96 bg-gray-200 rounded-lg"></div></div></div>}>
        <ComparisonTable />
      </Suspense>

      <Suspense fallback={<div className="py-16 bg-gradient-to-br from-gray-50 to-blue-50 animate-pulse"><div className="max-w-7xl mx-auto px-6"><div className="h-96 bg-gray-200 rounded-lg"></div></div></div>}>
        <FAQ />
      </Suspense>

      {/* Final Call to Action */}
      <section className='py-20 md:py-24 bg-gradient-to-r from-indigo-600 to-purple-600 relative overflow-hidden'>
        <div className='absolute inset-0'>
          <div className='absolute top-10 left-10 w-40 h-40 bg-white/10 rounded-full animate-float'></div>
          <div className='absolute bottom-10 right-10 w-60 h-60 bg-white/5 rounded-full animate-float animation-delay-2000'></div>
        </div>

        <div className='max-w-5xl mx-auto text-center px-6 relative'>
          <div className='mb-8'>
            <div className='inline-flex items-center px-6 py-3 bg-white/20 rounded-full text-white font-semibold mb-6'>
              🚀 Join 25,000+ Successful Creators
            </div>
          </div>
          
          <h2 className='text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6'>
            Start Earning From Your Content
            <span className='block bg-gradient-to-r from-pink-300 to-yellow-300 bg-clip-text text-transparent'>
              In Less Than 5 Minutes
            </span>
          </h2>
          
          <p className='text-lg md:text-xl text-white/90 mb-8 max-w-3xl mx-auto'>
            No setup fees, no monthly charges, no hidden costs. Just upload your content and start earning with the lowest platform fee in the industry.
          </p>
          
          <div className='flex flex-col sm:flex-row items-center justify-center gap-4 mb-8'>
            <Link
              href='/auth/signup'
              className='group inline-flex items-center px-8 py-4 text-lg font-semibold text-purple-700 bg-white rounded-full hover:bg-gray-50 transition-all transform hover:scale-105 shadow-xl hover:shadow-2xl'
            >
              Start Creating Today - It's Free
              <ArrowRightIcon className='ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform' />
            </Link>
            <button
              onClick={() => {
                document.querySelector('#features')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className='inline-flex items-center px-8 py-4 text-lg font-semibold text-white border-2 border-white/30 rounded-full hover:border-white/50 hover:bg-white/10 transition-all backdrop-blur-sm'
            >
              Learn More
            </button>
          </div>
          
          <div className='grid grid-cols-1 md:grid-cols-3 gap-6 text-white/80 text-sm'>
            <div className='flex items-center justify-center'>
              <CheckIcon className='w-5 h-5 mr-2 text-green-300' />
              <span>5% platform fee only</span>
            </div>
            <div className='flex items-center justify-center'>
              <CheckIcon className='w-5 h-5 mr-2 text-green-300' />
              <span>Daily payouts available</span>
            </div>
            <div className='flex items-center justify-center'>
              <CheckIcon className='w-5 h-5 mr-2 text-green-300' />
              <span>24/7 creator support</span>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}