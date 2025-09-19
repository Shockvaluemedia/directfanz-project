'use client';

import React from 'react';
import { Check, X, Star } from 'lucide-react';

const ComparisonTable = () => {
  const features = [
    {
      category: 'Pricing & Payouts',
      items: [
        {
          feature: 'Platform Fee',
          directFan: '5%',
          onlyFans: '20%',
          patreon: '8-12%',
          fansly: '20%',
        },
        {
          feature: 'Payout Frequency',
          directFan: 'Daily',
          onlyFans: 'Weekly',
          patreon: '1st of month',
          fansly: 'Weekly',
        },
        {
          feature: 'Minimum Payout',
          directFan: '$10',
          onlyFans: '$20',
          patreon: '$25',
          fansly: '$20',
        },
      ],
    },
    {
      category: 'Content & Features',
      items: [
        {
          feature: 'Live Streaming',
          directFan: true,
          onlyFans: false,
          patreon: false,
          fansly: true,
        },
        {
          feature: 'AI Content Protection',
          directFan: true,
          onlyFans: false,
          patreon: false,
          fansly: false,
        },
        {
          feature: 'Custom Branding',
          directFan: true,
          onlyFans: false,
          patreon: true,
          fansly: false,
        },
        {
          feature: 'Fan Analytics',
          directFan: true,
          onlyFans: 'Basic',
          patreon: 'Basic',
          fansly: 'Basic',
        },
        {
          feature: 'Multi-tier Subscriptions',
          directFan: true,
          onlyFans: false,
          patreon: true,
          fansly: true,
        },
      ],
    },
    {
      category: 'Creator Support',
      items: [
        {
          feature: '24/7 Support',
          directFan: true,
          onlyFans: false,
          patreon: false,
          fansly: false,
        },
        {
          feature: 'Marketing Tools',
          directFan: true,
          onlyFans: 'Limited',
          patreon: 'Limited',
          fansly: 'Limited',
        },
        {
          feature: 'Creator Community',
          directFan: true,
          onlyFans: false,
          patreon: true,
          fansly: false,
        },
        {
          feature: 'Revenue Analytics',
          directFan: 'Advanced',
          onlyFans: 'Basic',
          patreon: 'Basic',
          fansly: 'Basic',
        },
      ],
    },
  ];

  const platforms = [
    { name: 'DirectFanz', key: 'directFan', highlight: true },
    { name: 'OnlyFans', key: 'onlyFans', highlight: false },
    { name: 'Patreon', key: 'patreon', highlight: false },
    { name: 'Fansly', key: 'fansly', highlight: false },
  ];

  const renderCell = (value: any, isHighlighted: boolean) => {
    if (typeof value === 'boolean') {
      return value ? (
        <Check className={`w-5 h-5 ${isHighlighted ? 'text-green-400' : 'text-green-500'}`} />
      ) : (
        <X className={`w-5 h-5 ${isHighlighted ? 'text-red-400' : 'text-red-500'}`} />
      );
    }

    if (typeof value === 'string') {
      if (value === 'Advanced') {
        return (
          <div
            className={`flex items-center gap-1 ${isHighlighted ? 'text-green-400' : 'text-green-600'}`}
          >
            <Star className='w-4 h-4' />
            <span className='font-medium'>{value}</span>
          </div>
        );
      }
      return (
        <span className={`${isHighlighted ? 'text-white font-medium' : 'text-gray-600'}`}>
          {value}
        </span>
      );
    }

    return value;
  };

  return (
    <section className='py-16 px-4 bg-gradient-to-br from-slate-50 to-blue-50'>
      <div className='max-w-7xl mx-auto'>
        {/* Header */}
        <div className='text-center mb-12'>
          <h2 className='text-3xl md:text-4xl font-bold text-gray-900 mb-4'>
            Why Choose DirectFanz?
          </h2>
          <p className='text-xl text-gray-600 max-w-3xl mx-auto'>
            Compare our industry-leading features and creator-first approach with other platforms
          </p>
        </div>

        {/* Comparison Table */}
        <div className='bg-white rounded-2xl shadow-xl overflow-hidden'>
          {features.map((category, categoryIndex) => (
            <div key={categoryIndex} className='border-b border-gray-200 last:border-b-0'>
              {/* Category Header */}
              <div className='bg-gray-50 px-6 py-4'>
                <h3 className='text-lg font-semibold text-gray-900'>{category.category}</h3>
              </div>

              {/* Feature Rows */}
              {category.items.map((item, itemIndex) => (
                <div
                  key={itemIndex}
                  className='grid grid-cols-1 md:grid-cols-5 border-b border-gray-100 last:border-b-0'
                >
                  {/* Feature Name */}
                  <div className='px-6 py-4 font-medium text-gray-900 bg-gray-50 md:bg-transparent'>
                    {item.feature}
                  </div>

                  {/* Platform Values */}
                  {platforms.map((platform, platformIndex) => (
                    <div
                      key={platformIndex}
                      className={`px-6 py-4 text-center ${
                        platform.highlight
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                          : 'bg-white'
                      } ${platformIndex === 0 ? 'font-medium' : ''}`}
                    >
                      {/* Platform Header (only on first row of category) */}
                      {itemIndex === 0 && (
                        <div
                          className={`mb-2 pb-2 border-b ${
                            platform.highlight ? 'border-white/20' : 'border-gray-200'
                          }`}
                        >
                          <div
                            className={`text-sm font-semibold ${
                              platform.highlight ? 'text-white' : 'text-gray-700'
                            }`}
                          >
                            {platform.name}
                          </div>
                          {platform.highlight && (
                            <div className='text-xs text-blue-200 mt-1'>⭐ Best Choice</div>
                          )}
                        </div>
                      )}

                      {/* Feature Value */}
                      <div className='flex justify-center'>
                        {renderCell(item[platform.key as keyof typeof item], platform.highlight)}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className='text-center mt-12'>
          <div className='bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white'>
            <h3 className='text-2xl font-bold mb-4'>Ready to Switch to the Best?</h3>
            <p className='text-blue-100 mb-6 max-w-2xl mx-auto'>
              Join thousands of creators who've made the switch to DirectFanz and increased
              their earnings by an average of 40%
            </p>
            <div className='flex flex-col sm:flex-row gap-4 justify-center'>
              <button className='bg-white text-blue-600 px-8 py-3 rounded-xl font-semibold hover:bg-blue-50 transition-colors'>
                Start Free Trial
              </button>
              <button className='border border-white/20 text-white px-8 py-3 rounded-xl font-semibold hover:bg-white/10 transition-colors'>
                View Pricing
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ComparisonTable;
