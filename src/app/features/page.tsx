'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SparklesIcon,
  CubeIcon,
  UsersIcon,
  TrophyIcon,
  BoltIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  DevicePhoneMobileIcon,
  GlobeAltIcon,
  HeartIcon,
  MicrophoneIcon,
  VideoCameraIcon,
  PaintBrushIcon,
  ChatBubbleLeftRightIcon,
  EyeIcon,
  FireIcon,
  StarIcon,
  LightBulbIcon,
  RocketLaunchIcon,
  BeakerIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';

interface Feature {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  category: 'ai' | 'collaboration' | 'nft' | 'gamification' | 'security' | 'analytics' | 'mobile';
  status: 'available' | 'beta' | 'coming_soon';
  highlights: string[];
  demo?: string;
}

const features: Feature[] = [
  {
    id: 'ai-assistant',
    title: 'AI Creative Assistant',
    description:
      'Your personal AI-powered creative companion that helps generate content ideas, analyzes performance, and provides intelligent recommendations.',
    icon: SparklesIcon,
    category: 'ai',
    status: 'available',
    highlights: [
      'Personalized content suggestions based on your style',
      'Real-time content analysis and optimization tips',
      'Voice-powered brainstorming sessions',
      'Trend prediction and viral potential scoring',
      'Smart tag and description generation',
    ],
    demo: 'ai-assistant-demo',
  },
  {
    id: 'collaboration-studio',
    title: 'Real-Time Collaboration Studio',
    description:
      'Create together with other artists in real-time. Live streaming, shared workspaces, and synchronized creation tools.',
    icon: UsersIcon,
    category: 'collaboration',
    status: 'available',
    highlights: [
      'Multi-user real-time collaboration',
      'Live streaming to audiences',
      'Integrated voice and video chat',
      'Shared drawing and composition tools',
      'Version control and project history',
    ],
    demo: 'collaboration-demo',
  },
  {
    id: 'nft-marketplace',
    title: 'Creator NFT Marketplace',
    description:
      'Built-in NFT marketplace specifically designed for creators. Mint, sell, and trade exclusive content with your fans.',
    icon: CubeIcon,
    category: 'nft',
    status: 'beta',
    highlights: [
      'Multi-blockchain support (Ethereum, Polygon, Solana)',
      'Gasless minting for creators',
      'Royalty management and automatic payouts',
      'Exclusive unlockable content',
      'Rarity-based pricing and discovery',
    ],
    demo: 'nft-marketplace-demo',
  },
  {
    id: 'fan-engagement',
    title: 'Advanced Fan Engagement',
    description:
      'Gamified fan experience with achievements, levels, streaks, and exclusive rewards that keep your audience coming back.',
    icon: TrophyIcon,
    category: 'gamification',
    status: 'available',
    highlights: [
      'Progressive fan leveling system',
      'Achievement badges and rewards',
      'Daily and weekly streaks',
      'Leaderboards and competitions',
      'Exclusive perks and early access',
    ],
    demo: 'gamification-demo',
  },
  {
    id: 'security-suite',
    title: 'Enterprise Security Suite',
    description:
      'Bank-level security with advanced rate limiting, input validation, and comprehensive monitoring to protect your platform.',
    icon: ShieldCheckIcon,
    category: 'security',
    status: 'available',
    highlights: [
      'Advanced rate limiting with Redis',
      'Comprehensive input validation and sanitization',
      'Security headers and CSP enforcement',
      'Real-time threat monitoring',
      'Automated security scanning',
    ],
  },
  {
    id: 'analytics-dashboard',
    title: 'Advanced Analytics & BI',
    description:
      'Comprehensive analytics dashboard with AI-powered insights, audience demographics, and revenue optimization.',
    icon: ChartBarIcon,
    category: 'analytics',
    status: 'available',
    highlights: [
      'Real-time performance metrics',
      'Audience demographic analysis',
      'Revenue optimization insights',
      'Content performance predictions',
      'Custom reporting and exports',
    ],
  },
  {
    id: 'mobile-apps',
    title: 'Native Mobile Apps',
    description:
      'Full-featured iOS and Android apps with offline support, push notifications, and native performance.',
    icon: DevicePhoneMobileIcon,
    category: 'mobile',
    status: 'available',
    highlights: [
      'Native iOS and Android applications',
      'Offline content support',
      'Push notifications and real-time updates',
      'Mobile-optimized creation tools',
      'Seamless cross-platform sync',
    ],
  },
];

const categories = [
  { id: 'all', label: 'All Features', icon: RocketLaunchIcon },
  { id: 'ai', label: 'AI & ML', icon: SparklesIcon },
  { id: 'collaboration', label: 'Collaboration', icon: UsersIcon },
  { id: 'nft', label: 'Web3 & NFT', icon: CubeIcon },
  { id: 'gamification', label: 'Engagement', icon: TrophyIcon },
  { id: 'security', label: 'Security', icon: ShieldCheckIcon },
  { id: 'analytics', label: 'Analytics', icon: ChartBarIcon },
  { id: 'mobile', label: 'Mobile', icon: DevicePhoneMobileIcon },
];

const stats = [
  { label: 'Advanced Features', value: '50+', icon: BeakerIcon },
  { label: 'AI Models', value: '8', icon: SparklesIcon },
  { label: 'Security Layers', value: '12', icon: ShieldCheckIcon },
  { label: 'API Endpoints', value: '200+', icon: WrenchScrewdriverIcon },
];

export default function FeaturesPage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);

  const filteredFeatures =
    selectedCategory === 'all'
      ? features
      : features.filter(feature => feature.category === selectedCategory);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800';
      case 'beta':
        return 'bg-blue-100 text-blue-800';
      case 'coming_soon':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      ai: 'from-purple-500 to-pink-500',
      collaboration: 'from-blue-500 to-indigo-500',
      nft: 'from-indigo-500 to-purple-500',
      gamification: 'from-yellow-500 to-orange-500',
      security: 'from-red-500 to-pink-500',
      analytics: 'from-green-500 to-teal-500',
      mobile: 'from-teal-500 to-blue-500',
    };
    return colors[category as keyof typeof colors] || 'from-gray-500 to-gray-600';
  };

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Hero Section */}
      <section className='relative bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 text-white overflow-hidden'>
        <div className='absolute inset-0 bg-black/20'></div>
        <div className='relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24'>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className='text-center mb-16'
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              className='inline-block mb-6'
            >
              <SparklesIcon className='w-16 h-16 text-yellow-400' />
            </motion.div>

            <h1 className='text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400 bg-clip-text text-transparent'>
              Advanced Features
            </h1>

            <p className='text-xl md:text-2xl text-white/90 mb-8 max-w-4xl mx-auto'>
              Discover the cutting-edge technology that sets DirectFanz apart from every other
              creator platform
            </p>

            <div className='flex flex-col sm:flex-row gap-4 justify-center'>
              <button className='px-8 py-3 bg-white text-indigo-900 font-semibold rounded-lg hover:bg-gray-100 transition-colors'>
                Try Demo Features
              </button>
              <button className='px-8 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white/10 transition-colors'>
                View Documentation
              </button>
            </div>
          </motion.div>

          {/* Stats */}
          <div className='grid grid-cols-2 md:grid-cols-4 gap-6'>
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className='text-center bg-white/10 backdrop-blur-sm rounded-xl p-6'
              >
                <stat.icon className='w-8 h-8 text-yellow-400 mx-auto mb-3' />
                <div className='text-3xl font-bold mb-2'>{stat.value}</div>
                <div className='text-white/80'>{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className='py-20'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          {/* Category Filter */}
          <div className='text-center mb-16'>
            <h2 className='text-3xl md:text-4xl font-bold text-gray-900 mb-4'>
              Explore Our Feature Categories
            </h2>
            <p className='text-xl text-gray-600 mb-8'>
              Each category represents a major innovation in creator technology
            </p>

            <div className='flex flex-wrap justify-center gap-3 mb-12'>
              {categories.map(category => {
                const IconComponent = category.icon;
                return (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all ${
                      selectedCategory === category.id
                        ? 'bg-indigo-600 text-white shadow-lg'
                        : 'bg-white text-gray-700 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                    }`}
                  >
                    <IconComponent className='w-5 h-5' />
                    <span>{category.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Features Grid */}
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-8'>
            <AnimatePresence>
              {filteredFeatures.map((feature, index) => {
                const IconComponent = feature.icon;
                return (
                  <motion.div
                    key={feature.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ y: -5 }}
                    onClick={() => setSelectedFeature(feature)}
                    className='bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden cursor-pointer group hover:shadow-2xl transition-all duration-300'
                  >
                    {/* Header */}
                    <div
                      className={`h-2 bg-gradient-to-r ${getCategoryColor(feature.category)}`}
                    ></div>

                    <div className='p-8'>
                      <div className='flex items-start justify-between mb-6'>
                        <div
                          className={`w-14 h-14 rounded-xl bg-gradient-to-r ${getCategoryColor(feature.category)} flex items-center justify-center group-hover:scale-110 transition-transform`}
                        >
                          <IconComponent className='w-7 h-7 text-white' />
                        </div>

                        <span
                          className={`px-3 py-1 text-sm font-medium rounded-full capitalize ${getStatusColor(feature.status)}`}
                        >
                          {feature.status.replace('_', ' ')}
                        </span>
                      </div>

                      <h3 className='text-2xl font-bold text-gray-900 mb-3 group-hover:text-indigo-600 transition-colors'>
                        {feature.title}
                      </h3>

                      <p className='text-gray-600 mb-6 leading-relaxed'>{feature.description}</p>

                      {/* Highlights */}
                      <div className='space-y-2'>
                        {feature.highlights.slice(0, 3).map((highlight, i) => (
                          <div key={i} className='flex items-center space-x-2'>
                            <div className='w-2 h-2 bg-green-500 rounded-full'></div>
                            <span className='text-sm text-gray-700'>{highlight}</span>
                          </div>
                        ))}
                        {feature.highlights.length > 3 && (
                          <div className='text-sm text-indigo-600 font-medium'>
                            +{feature.highlights.length - 3} more features
                          </div>
                        )}
                      </div>

                      {/* Demo Button */}
                      {feature.demo && (
                        <button className='mt-6 w-full py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-indigo-50 hover:text-indigo-700 transition-colors font-medium'>
                          View Interactive Demo
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* Technology Stack */}
      <section className='py-20 bg-gray-900 text-white'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='text-center mb-16'>
            <h2 className='text-3xl md:text-4xl font-bold mb-4'>Built on Modern Technology</h2>
            <p className='text-xl text-gray-300'>
              Powered by the latest innovations in web development and AI
            </p>
          </div>

          <div className='grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8'>
            {[
              { name: 'Next.js', category: 'Framework' },
              { name: 'TypeScript', category: 'Language' },
              { name: 'Prisma', category: 'Database' },
              { name: 'Redis', category: 'Cache' },
              { name: 'React Native', category: 'Mobile' },
              { name: 'AI/ML APIs', category: 'Intelligence' },
              { name: 'Web3 SDKs', category: 'Blockchain' },
              { name: 'WebRTC', category: 'Real-time' },
              { name: 'Socket.io', category: 'Websockets' },
              { name: 'Recharts', category: 'Analytics' },
              { name: 'Framer Motion', category: 'Animation' },
              { name: 'Tailwind CSS', category: 'Styling' },
            ].map((tech, index) => (
              <motion.div
                key={tech.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className='text-center group cursor-pointer'
              >
                <div className='w-16 h-16 bg-white/10 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:bg-white/20 transition-colors'>
                  <div className='w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-lg'></div>
                </div>
                <h4 className='font-semibold text-white group-hover:text-indigo-400 transition-colors'>
                  {tech.name}
                </h4>
                <p className='text-sm text-gray-400'>{tech.category}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className='py-20 bg-gradient-to-r from-indigo-600 to-purple-600 text-white'>
        <div className='max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center'>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className='text-3xl md:text-4xl font-bold mb-6'>Ready to Experience the Future?</h2>
            <p className='text-xl mb-8 text-white/90'>
              Join thousands of creators who are already using these advanced features to grow their
              communities and monetize their creativity.
            </p>
            <div className='flex flex-col sm:flex-row gap-4 justify-center'>
              <button className='px-8 py-3 bg-white text-indigo-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors'>
                Start Free Trial
              </button>
              <button className='px-8 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white/10 transition-colors'>
                Schedule Demo
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Feature Detail Modal */}
      <AnimatePresence>
        {selectedFeature && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className='fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4'
            onClick={() => setSelectedFeature(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className='bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden'
              onClick={e => e.stopPropagation()}
            >
              <div
                className={`h-2 bg-gradient-to-r ${getCategoryColor(selectedFeature.category)}`}
              ></div>

              <div className='p-8'>
                <div className='flex items-start justify-between mb-6'>
                  <div className='flex items-center space-x-4'>
                    <div
                      className={`w-16 h-16 rounded-xl bg-gradient-to-r ${getCategoryColor(selectedFeature.category)} flex items-center justify-center`}
                    >
                      <selectedFeature.icon className='w-8 h-8 text-white' />
                    </div>
                    <div>
                      <h2 className='text-3xl font-bold text-gray-900'>{selectedFeature.title}</h2>
                      <span
                        className={`px-3 py-1 text-sm font-medium rounded-full capitalize ${getStatusColor(selectedFeature.status)}`}
                      >
                        {selectedFeature.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedFeature(null)}
                    className='text-gray-400 hover:text-gray-600 transition-colors'
                  >
                    <svg className='w-6 h-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M6 18L18 6M6 6l12 12'
                      />
                    </svg>
                  </button>
                </div>

                <p className='text-lg text-gray-600 mb-8 leading-relaxed'>
                  {selectedFeature.description}
                </p>

                <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
                  <div>
                    <h3 className='text-xl font-semibold text-gray-900 mb-4'>Key Features</h3>
                    <div className='space-y-3'>
                      {selectedFeature.highlights.map((highlight, i) => (
                        <div key={i} className='flex items-start space-x-3'>
                          <div className='w-2 h-2 bg-green-500 rounded-full mt-2'></div>
                          <span className='text-gray-700'>{highlight}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className='bg-gray-50 rounded-xl p-6'>
                    <h3 className='text-xl font-semibold text-gray-900 mb-4'>Coming Soon</h3>
                    <p className='text-gray-600 mb-4'>
                      We're constantly improving and adding new features. Here's what's coming next:
                    </p>
                    <div className='space-y-2 text-sm text-gray-600'>
                      <div>• Enhanced AI capabilities</div>
                      <div>• Advanced customization options</div>
                      <div>• Third-party integrations</div>
                      <div>• Mobile app improvements</div>
                    </div>
                  </div>
                </div>

                <div className='flex justify-center mt-8'>
                  {selectedFeature.demo ? (
                    <button className='px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors'>
                      Try Interactive Demo
                    </button>
                  ) : (
                    <button className='px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors'>
                      Learn More
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
