'use client';

import { useState } from 'react';
import {
  PlayIcon,
  ArrowDownTrayIcon,
  HeartIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  UserGroupIcon,
  MusicalNoteIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';

const demoTabs = [
  {
    id: 'artist-dashboard',
    label: 'Artist Dashboard',
    icon: ChartBarIcon,
    description: 'See how artists manage their content and earnings',
  },
  {
    id: 'fan-experience',
    label: 'Fan Experience',
    icon: HeartIcon,
    description: 'Experience how fans discover and support artists',
  },
  {
    id: 'pricing-flow',
    label: 'Pricing in Action',
    icon: CurrencyDollarIcon,
    description: 'Watch the pay-what-you-want system work',
  },
];

export default function DemoPreviewSection() {
  const [activeTab, setActiveTab] = useState('artist-dashboard');

  const renderArtistDashboard = () => (
    <div className='bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden'>
      {/* Dashboard Header */}
      <div className='bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white'>
        <div className='flex items-center justify-between'>
          <div>
            <h3 className='text-xl font-bold'>Welcome back, Sarah Chen</h3>
            <p className='text-indigo-100'>Your earnings this month</p>
          </div>
          <div className='text-right'>
            <div className='text-3xl font-bold'>$9,247</div>
            <div className='text-sm text-indigo-200'>+23% from last month</div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className='grid grid-cols-4 gap-4 p-6 bg-gray-50 border-b'>
        <div className='text-center'>
          <div className='text-2xl font-bold text-gray-900'>156</div>
          <div className='text-sm text-gray-600'>Total Releases</div>
        </div>
        <div className='text-center'>
          <div className='text-2xl font-bold text-green-600'>1,247</div>
          <div className='text-sm text-gray-600'>Fans</div>
        </div>
        <div className='text-center'>
          <div className='text-2xl font-bold text-blue-600'>$12.50</div>
          <div className='text-sm text-gray-600'>Avg. Sale Price</div>
        </div>
        <div className='text-center'>
          <div className='text-2xl font-bold text-purple-600'>4.8</div>
          <div className='text-sm text-gray-600'>★ Rating</div>
        </div>
      </div>

      {/* Recent Releases */}
      <div className='p-6'>
        <h4 className='font-bold text-gray-900 mb-4 flex items-center'>
          <MusicalNoteIcon className='w-5 h-5 mr-2' />
          Recent Releases
        </h4>
        <div className='space-y-4'>
          {[
            { name: 'Midnight Dreams', sales: 89, earnings: '$1,112', price: '$12.50' },
            { name: 'Electric Soul', sales: 156, earnings: '$1,950', price: 'Pay-what-you-want' },
            { name: 'Neon Nights', sales: 203, earnings: '$2,436', price: '$12.00' },
          ].map((release, i) => (
            <div
              key={i}
              className='flex items-center justify-between p-4 bg-white border rounded-lg'
            >
              <div className='flex items-center'>
                <div className='w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-500 rounded-lg flex items-center justify-center'>
                  <MusicalNoteIcon className='w-6 h-6 text-white' />
                </div>
                <div className='ml-4'>
                  <div className='font-semibold text-gray-900'>{release.name}</div>
                  <div className='text-sm text-gray-600'>
                    {release.sales} sales • {release.price}
                  </div>
                </div>
              </div>
              <div className='text-right'>
                <div className='font-bold text-green-600'>{release.earnings}</div>
                <div className='text-sm text-gray-500'>You earned</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderFanExperience = () => (
    <div className='bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden'>
      {/* Search/Browse Header */}
      <div className='p-6 border-b bg-gray-50'>
        <div className='flex items-center justify-between mb-4'>
          <h3 className='text-xl font-bold text-gray-900'>Discover Artists</h3>
          <div className='flex items-center space-x-2 text-sm text-gray-600'>
            <EyeIcon className='w-4 h-4' />
            <span>Browsing as fan</span>
          </div>
        </div>
        <div className='bg-white rounded-lg border p-3 flex items-center'>
          <input
            type='text'
            placeholder='Search for artists, genres, or songs...'
            className='flex-1 outline-none text-gray-700'
            disabled
          />
        </div>
      </div>

      {/* Artist Cards */}
      <div className='p-6'>
        <div className='grid gap-6'>
          {[
            {
              name: 'Sarah Chen',
              genre: 'Electronic • Ambient',
              followers: '1.2K fans',
              avatar: 'SC',
              gradient: 'from-purple-400 to-pink-500',
              latest: 'Midnight Dreams',
              price: '$12.50',
              rating: 4.9,
            },
            {
              name: 'Marcus Rodriguez',
              genre: 'Indie Rock • Alternative',
              followers: '856 fans',
              avatar: 'MR',
              gradient: 'from-blue-400 to-indigo-500',
              latest: 'Broken Satellites',
              price: 'Pay what you want (min $5)',
              rating: 4.7,
            },
          ].map((artist, i) => (
            <div
              key={i}
              className='border rounded-lg p-6 hover:shadow-lg transition-all duration-300'
            >
              <div className='flex items-start justify-between mb-4'>
                <div className='flex items-center'>
                  <div
                    className={`w-16 h-16 rounded-full bg-gradient-to-br ${artist.gradient} flex items-center justify-center text-white font-bold text-lg`}
                  >
                    {artist.avatar}
                  </div>
                  <div className='ml-4'>
                    <h4 className='font-bold text-gray-900 text-lg'>{artist.name}</h4>
                    <p className='text-gray-600'>{artist.genre}</p>
                    <div className='flex items-center mt-1'>
                      <UserGroupIcon className='w-4 h-4 text-gray-400 mr-1' />
                      <span className='text-sm text-gray-500'>{artist.followers}</span>
                      <div className='flex items-center ml-4'>
                        <StarIcon className='w-4 h-4 text-yellow-400' />
                        <span className='text-sm text-gray-600 ml-1'>{artist.rating}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    /* Demo follow action */
                  }}
                  className='px-4 py-2 bg-pink-100 text-pink-700 rounded-full text-sm font-medium hover:bg-pink-200 transition-colors'
                >
                  Follow
                </button>
              </div>

              {/* Latest Release */}
              <div className='bg-gray-50 rounded-lg p-4'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center'>
                    <PlayIcon className='w-8 h-8 text-indigo-600' />
                    <div className='ml-3'>
                      <div className='font-semibold text-gray-900'>{artist.latest}</div>
                      <div className='text-sm text-gray-600'>Latest release</div>
                    </div>
                  </div>
                  <div className='text-right'>
                    <div className='font-bold text-gray-900'>{artist.price}</div>
                    <div className='flex items-center space-x-2 mt-2'>
                      <button
                        onClick={() => {
                          /* Demo purchase action */
                        }}
                        className='flex items-center px-3 py-1 bg-indigo-600 text-white rounded-full text-sm hover:bg-indigo-700 transition-colors'
                      >
                        <ArrowDownTrayIcon className='w-4 h-4 mr-1' />
                        Buy
                      </button>
                      <button
                        onClick={() => {
                          /* Demo like action */
                        }}
                        className='p-1 text-gray-400 hover:text-red-500 transition-colors'
                      >
                        <HeartIcon className='w-5 h-5' />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderPricingFlow = () => (
    <div className='bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden'>
      {/* Checkout Header */}
      <div className='bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white'>
        <h3 className='text-xl font-bold'>Pay-What-You-Want in Action</h3>
        <p className='text-green-100'>See how fans can support artists fairly</p>
      </div>

      <div className='p-6'>
        {/* Song Info */}
        <div className='flex items-center mb-6 p-4 bg-gray-50 rounded-lg'>
          <div className='w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-500 rounded-lg flex items-center justify-center'>
            <MusicalNoteIcon className='w-8 h-8 text-white' />
          </div>
          <div className='ml-4 flex-1'>
            <h4 className='font-bold text-gray-900 text-lg'>Electric Soul</h4>
            <p className='text-gray-600'>by Sarah Chen</p>
            <div className='flex items-center mt-1'>
              <span className='text-sm bg-green-100 text-green-700 px-2 py-1 rounded'>
                Pay-What-You-Want
              </span>
            </div>
          </div>
        </div>

        {/* Pricing Options */}
        <div className='space-y-4'>
          <div className='border-2 border-indigo-200 rounded-lg p-4 bg-indigo-50'>
            <div className='flex items-center justify-between mb-3'>
              <span className='font-semibold text-gray-900'>Choose your price:</span>
              <span className='text-sm text-gray-600'>Minimum: $3.00</span>
            </div>

            <div className='grid grid-cols-4 gap-3 mb-4'>
              {[
                { amount: '$3', label: 'Minimum', popular: false },
                { amount: '$8', label: 'Suggested', popular: true },
                { amount: '$15', label: 'Supporter', popular: false },
                { amount: '$25', label: 'Superfan', popular: false },
              ].map((option, i) => (
                <button
                  key={i}
                  onClick={() => {
                    /* Demo price selection */
                  }}
                  className={`p-3 rounded-lg border-2 text-center transition-all ${
                    option.popular
                      ? 'border-indigo-500 bg-indigo-100 text-indigo-700'
                      : 'border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  <div className='font-bold'>{option.amount}</div>
                  <div className='text-xs'>{option.label}</div>
                </button>
              ))}
            </div>

            <div className='flex items-center space-x-3'>
              <span className='text-sm text-gray-600'>Or enter custom amount:</span>
              <input
                type='text'
                placeholder='$8.00'
                className='border rounded px-3 py-2 w-24 text-center'
                disabled
              />
            </div>
          </div>

          {/* Breakdown */}
          <div className='bg-gray-50 rounded-lg p-4'>
            <h5 className='font-semibold text-gray-900 mb-3'>Payment Breakdown</h5>
            <div className='space-y-2 text-sm'>
              <div className='flex justify-between'>
                <span className='text-gray-600'>Your payment:</span>
                <span className='font-semibold'>$8.00</span>
              </div>
              <div className='flex justify-between'>
                <span className='text-gray-600'>Platform fee (20%):</span>
                <span className='text-gray-600'>-$1.60</span>
              </div>
              <div className='flex justify-between border-t pt-2'>
                <span className='font-semibold text-gray-900'>Artist receives:</span>
                <span className='font-bold text-green-600'>$6.40 (80%)</span>
              </div>
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={() => {
              /* Demo purchase completion */
            }}
            className='w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors'
          >
            Complete Purchase & Download
          </button>

          <p className='text-xs text-gray-500 text-center'>
            Secure payment • Instant download • Support the artist directly
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <section className='py-24 bg-white relative overflow-hidden'>
      <div className='max-w-7xl mx-auto px-6'>
        {/* Header */}
        <div className='text-center mb-16'>
          <h2 className='text-4xl md:text-6xl font-bold text-gray-900 mb-6'>
            See the Platform
            <span className='block bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent'>
              in Action
            </span>
          </h2>
          <p className='text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed'>
            Don't just take our word for it. Explore how artists earn and fans discover music on our
            platform.
          </p>
        </div>

        {/* Demo Tabs */}
        <div className='flex flex-col lg:flex-row items-center justify-center mb-12'>
          <div className='flex flex-wrap justify-center gap-4 mb-8 lg:mb-0'>
            {demoTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-6 py-3 rounded-full font-semibold transition-all duration-300 ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <tab.icon className='w-5 h-5 mr-2' />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Active Tab Description */}
        <div className='text-center mb-8'>
          <p className='text-gray-600 text-lg'>
            {demoTabs.find(tab => tab.id === activeTab)?.description}
          </p>
        </div>

        {/* Demo Content */}
        <div className='max-w-4xl mx-auto'>
          <div className='transform hover:scale-[1.02] transition-transform duration-300'>
            {activeTab === 'artist-dashboard' && renderArtistDashboard()}
            {activeTab === 'fan-experience' && renderFanExperience()}
            {activeTab === 'pricing-flow' && renderPricingFlow()}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className='text-center mt-16'>
          <h3 className='text-2xl font-bold text-gray-900 mb-4'>
            Ready to experience it yourself?
          </h3>
          <p className='text-gray-600 mb-6'>
            Join thousands of artists and fans building a fairer music economy.
          </p>
          <div className='flex flex-col sm:flex-row items-center justify-center gap-4'>
            <a
              href='/auth/signup'
              className='inline-flex items-center px-8 py-4 bg-indigo-600 text-white font-semibold rounded-full hover:bg-indigo-700 hover:scale-105 transition-all duration-300 shadow-lg'
            >
              Start as an Artist
            </a>
            <a
              href='/discover'
              className='inline-flex items-center px-8 py-4 bg-pink-600 text-white font-semibold rounded-full hover:bg-pink-700 hover:scale-105 transition-all duration-300 shadow-lg'
            >
              Browse as a Fan
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
