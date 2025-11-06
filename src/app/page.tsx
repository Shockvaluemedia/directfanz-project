'use client';

import Link from 'next/link';
import { ArrowRightIcon, PlayIcon, SparklesIcon, RocketLaunchIcon } from '@heroicons/react/24/outline';
import PricingSection from '@/components/home/pricing-section';
import DemoPreviewSection from '@/components/home/demo-preview-section';
import { SocialProof } from '@/components/ui/social-proof';
import ComparisonTable from '@/components/home/ComparisonTable';
import CreatorSuccessStories from '@/components/home/CreatorSuccessStories';
import FAQ from '@/components/home/FAQ';

// Client components for buttons to avoid server component issues
function DemoButton() {
  const handleDemoClick = () => {
    console.log('Demo video modal');
  };

  return (
    <button
      onClick={handleDemoClick}
      className='group inline-flex items-center px-8 py-4 text-lg font-semibold text-white border-2 border-white/40 rounded-full hover:border-white/60 hover:bg-white/10 transition-all backdrop-blur-sm shadow-lg hover:shadow-xl'
    >
      <PlayIcon className='mr-2 w-5 h-5 group-hover:scale-110 transition-transform' />
      See DirectFanz in Action
    </button>
  );
}

function LearnMoreButton() {
  const handleLearnMoreClick = () => {
    console.log('Learn more modal');
  };

  return (
    <button
      onClick={handleLearnMoreClick}
      className='inline-flex items-center px-8 py-4 text-lg font-semibold text-white border-2 border-white/30 rounded-full hover:border-white/50 hover:bg-white/10 transition-all backdrop-blur-sm'
    >
      Learn More
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
          <div className='max-w-4xl mx-auto'>
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

            <h1 className='text-5xl md:text-7xl font-bold text-white mb-8 leading-tight'>
              <span className='block'>Empower Your</span>
              <span className='block bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent'>
                Creative Journey
              </span>
            </h1>

            <p className='text-xl md:text-2xl text-white/90 mb-12 max-w-3xl mx-auto leading-relaxed'>
              Join the creator economy revolution on <span className='font-semibold text-white'>DirectFanz</span>. Build meaningful connections with your audience and earn what your content deserves through direct fan support.
            </p>

            <div className='flex flex-col sm:flex-row items-center justify-center gap-4'>
              <Link
                href='/auth/signup'
                className='group inline-flex items-center px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-xl hover:shadow-2xl'
              >
                Start Creating Today
                <ArrowRightIcon className='ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform' />
              </Link>
              <DemoButton />
            </div>
          </div>

          {/* Stats */}
          <div className='mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto'>
            <div className='glass rounded-2xl p-8 text-center hover:scale-105 transition-transform duration-300 border border-white/20'>
              <div className='text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-300 to-purple-300 bg-clip-text text-transparent mb-3'>1K+</div>
              <div className='text-white/90 text-base font-medium mb-2'>Active Creators</div>
              <div className='text-white/60 text-sm'>Building their communities</div>
            </div>
            <div className='glass rounded-2xl p-8 text-center hover:scale-105 transition-transform duration-300 border border-white/20'>
              <div className='text-4xl md:text-5xl font-bold bg-gradient-to-r from-green-300 to-emerald-300 bg-clip-text text-transparent mb-3'>50K+</div>
              <div className='text-white/90 text-base font-medium mb-2'>Fan Connections</div>
              <div className='text-white/60 text-sm'>Supporting their favorite creators</div>
            </div>
            <div className='glass rounded-2xl p-8 text-center hover:scale-105 transition-transform duration-300 border border-white/20'>
              <div className='text-4xl md:text-5xl font-bold bg-gradient-to-r from-pink-300 to-rose-300 bg-clip-text text-transparent mb-3'>$100K+</div>
              <div className='text-white/90 text-base font-medium mb-2'>Creator Earnings</div>
              <div className='text-white/60 text-sm'>Paid directly to creators</div>
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

      {/* Enhanced Features Section */}
      <section className='py-24 bg-gray-50 relative overflow-hidden'>
        {/* Background decorations */}
        <div className='absolute top-0 left-0 w-full h-full'>
          <div className='absolute top-20 left-10 w-20 h-20 bg-indigo-200 rounded-full opacity-20 animate-float'></div>
          <div className='absolute bottom-20 right-10 w-32 h-32 bg-purple-200 rounded-full opacity-20 animate-float animation-delay-2000'></div>
        </div>

        <div className='max-w-7xl mx-auto px-6 relative'>
          <div className='text-center mb-20'>
            <h2 className='text-4xl md:text-6xl font-bold text-gray-900 mb-6'>
              The Complete
              <span className='block bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent'>
                Creator Ecosystem
              </span>
            </h2>
            <p className='text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed'>
              DirectFanz provides everything you need to build, grow, and monetize your creative community. From content creation to fan engagement, we've got you covered.
            </p>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8'>
            {[
              {
                title: 'Flexible Monetization',
                desc: 'Set your own subscription prices with daily payouts through Stripe. Multiple tiers, pay-per-view, and tip options.',
                icon: '💰',
                gradient: 'from-green-400 to-blue-500',
              },
              {
                title: 'Superfan Communities',
                desc: 'Build exclusive communities around your content with private messaging and interactive features.',
                icon: '👥',
                gradient: 'from-purple-400 to-pink-500',
              },
              {
                title: 'Secure & Private',
                desc: 'Enterprise-grade security with end-to-end encryption and advanced content protection.',
                icon: '🛡️',
                gradient: 'from-blue-400 to-indigo-500',
              },
              {
                title: 'Advanced Analytics',
                desc: 'Deep insights into your audience, revenue trends, and content performance with real-time data.',
                icon: '📊',
                gradient: 'from-yellow-400 to-orange-500',
              },
            ].map((feature, index) => (
              <div key={index} className='group relative'>
                <div className='relative h-full bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100 hover:border-gray-200'>
                  {/* Gradient background on hover */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300 rounded-2xl`}
                  ></div>

                  {/* Icon */}
                  <div className='text-4xl mb-4 transform group-hover:scale-110 transition-transform duration-300'>
                    {feature.icon}
                  </div>

                  {/* Content */}
                  <div className='relative z-10'>
                    <h3 className='text-xl font-bold text-gray-900 mb-4 group-hover:text-gray-800 transition-colors'>
                      {feature.title}
                    </h3>
                    <p className='text-gray-600 leading-relaxed group-hover:text-gray-700 transition-colors'>
                      {feature.desc}
                    </p>
                  </div>

                  {/* Hover effect border */}
                  <div
                    className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-20 transition-opacity duration-300 -z-10 blur-xl`}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo/Preview Section */}
      <DemoPreviewSection />

      {/* Social Proof Section */}
      <SocialProof />

      {/* Interactive Pricing Section */}
      <PricingSection />

      {/* Enhanced Creator Success Stories Carousel */}
      <CreatorSuccessStories />

      {/* Comparison Table */}
      <ComparisonTable />

      {/* FAQ Section */}
      <FAQ />

      {/* Call to Action */}
      <section className='py-24 bg-gradient-to-r from-indigo-600 to-purple-600 relative overflow-hidden'>
        <div className='absolute inset-0'>
          <div className='absolute top-10 left-10 w-40 h-40 bg-white/10 rounded-full animate-float'></div>
          <div className='absolute bottom-10 right-10 w-60 h-60 bg-white/5 rounded-full animate-float animation-delay-2000'></div>
        </div>

        <div className='max-w-4xl mx-auto text-center px-6 relative'>
          <h2 className='text-4xl md:text-5xl font-bold text-white mb-6'>
            Ready to Join <span className='bg-gradient-to-r from-pink-300 to-purple-300 bg-clip-text text-transparent'>DirectFanz</span>?
          </h2>
          <p className='text-xl text-white/90 mb-8 max-w-2xl mx-auto'>
            Join the growing community of creators who are building sustainable careers through direct fan support. Your creative journey starts here.
          </p>
          <div className='flex flex-col sm:flex-row items-center justify-center gap-4'>
            <Link
              href='/auth/signup'
              className='group inline-flex items-center px-8 py-4 text-lg font-semibold text-purple-700 bg-white rounded-full hover:bg-gray-50 transition-all transform hover:scale-105 shadow-xl hover:shadow-2xl'
            >
              Begin Your Creator Journey
              <ArrowRightIcon className='ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform' />
            </Link>
            <LearnMoreButton />
          </div>
        </div>
      </section>

    </div>
  );
}
