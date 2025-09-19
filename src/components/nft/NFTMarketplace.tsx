'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CubeIcon,
  SparklesIcon,
  BanknotesIcon,
  HeartIcon,
  EyeIcon,
  ShareIcon,
  ShoppingBagIcon,
  ClockIcon,
  FireIcon,
  TrophyIcon,
  GlobeAltIcon,
  ShieldCheckIcon,
  ArrowTrendingUpIcon,
  UserGroupIcon,
  CheckBadgeIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';

interface NFTAsset {
  id: string;
  name: string;
  description: string;
  image: string;
  creator: {
    id: string;
    name: string;
    avatar: string;
    verified: boolean;
  };
  price: {
    amount: number;
    currency: 'ETH' | 'SOL' | 'MATIC';
    usd: number;
  };
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  collection: {
    name: string;
    totalSupply: number;
    floorPrice: number;
  };
  metadata: {
    attributes: Array<{ trait_type: string; value: string; rarity: number }>;
    unlockableContent?: string;
    royalties: number;
  };
  stats: {
    views: number;
    likes: number;
    offers: number;
  };
  saleType: 'fixed' | 'auction' | 'not_for_sale';
  auctionEndTime?: Date;
  isLiked: boolean;
  blockchain: 'ethereum' | 'solana' | 'polygon';
}

interface NFTMarketplaceProps {
  currentUser?: {
    id: string;
    wallet?: string;
  };
  className?: string;
}

export default function NFTMarketplace({ currentUser, className = '' }: NFTMarketplaceProps) {
  const [nftAssets, setNftAssets] = useState<NFTAsset[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<
    'all' | 'music' | 'art' | 'video' | 'photography'
  >('all');
  const [sortBy, setSortBy] = useState<
    'recent' | 'price_low' | 'price_high' | 'most_liked' | 'ending_soon'
  >('recent');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedNFT, setSelectedNFT] = useState<NFTAsset | null>(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string>('');

  // Mock NFT data
  useEffect(() => {
    const mockNFTs: NFTAsset[] = [
      {
        id: '1',
        name: 'Ethereal Soundscape #001',
        description:
          'A unique audio-visual experience that transforms music into geometric patterns',
        image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=400&fit=crop',
        creator: {
          id: 'creator1',
          name: 'Alex Harmony',
          avatar: 'https://ui-avatars.com/api/?name=Alex+Harmony&background=6366f1&color=fff',
          verified: true,
        },
        price: {
          amount: 2.5,
          currency: 'ETH',
          usd: 4250,
        },
        rarity: 'rare',
        collection: {
          name: 'Audio Visualizers',
          totalSupply: 1000,
          floorPrice: 1.8,
        },
        metadata: {
          attributes: [
            { trait_type: 'Genre', value: 'Ambient', rarity: 15 },
            { trait_type: 'Duration', value: '3:42', rarity: 8 },
            { trait_type: 'Tempo', value: '120 BPM', rarity: 25 },
            { trait_type: 'Key', value: 'C Major', rarity: 12 },
          ],
          unlockableContent: 'High-quality FLAC audio file + stems',
          royalties: 10,
        },
        stats: {
          views: 1247,
          likes: 89,
          offers: 3,
        },
        saleType: 'fixed',
        isLiked: false,
        blockchain: 'ethereum',
      },
      {
        id: '2',
        name: 'Digital Dreams Concert',
        description: 'Exclusive recording of a virtual reality concert experience',
        image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop',
        creator: {
          id: 'creator2',
          name: 'Luna Vision',
          avatar: 'https://ui-avatars.com/api/?name=Luna+Vision&background=8b5cf6&color=fff',
          verified: true,
        },
        price: {
          amount: 5.0,
          currency: 'ETH',
          usd: 8500,
        },
        rarity: 'epic',
        collection: {
          name: 'VR Concerts',
          totalSupply: 50,
          floorPrice: 4.2,
        },
        metadata: {
          attributes: [
            { trait_type: 'Performance Type', value: 'Live', rarity: 5 },
            { trait_type: 'Duration', value: '45 minutes', rarity: 2 },
            { trait_type: 'Venue', value: 'Metaverse Stage', rarity: 10 },
          ],
          unlockableContent: '4K VR video + backstage content',
          royalties: 15,
        },
        stats: {
          views: 3456,
          likes: 234,
          offers: 8,
        },
        saleType: 'auction',
        auctionEndTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        isLiked: true,
        blockchain: 'ethereum',
      },
      {
        id: '3',
        name: 'Melody Fragment #127',
        description: 'A rare snippet of an unreleased track with exclusive rights',
        image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop',
        creator: {
          id: 'creator3',
          name: 'Beat Architect',
          avatar: 'https://ui-avatars.com/api/?name=Beat+Architect&background=ec4899&color=fff',
          verified: false,
        },
        price: {
          amount: 0.8,
          currency: 'ETH',
          usd: 1360,
        },
        rarity: 'common',
        collection: {
          name: 'Melody Fragments',
          totalSupply: 5000,
          floorPrice: 0.5,
        },
        metadata: {
          attributes: [
            { trait_type: 'Instrument', value: 'Synthesizer', rarity: 30 },
            { trait_type: 'Length', value: '15 seconds', rarity: 45 },
            { trait_type: 'Scale', value: 'Pentatonic', rarity: 20 },
          ],
          royalties: 5,
        },
        stats: {
          views: 856,
          likes: 45,
          offers: 1,
        },
        saleType: 'fixed',
        isLiked: false,
        blockchain: 'polygon',
      },
    ];

    setNftAssets(mockNFTs);
  }, []);

  const connectWallet = async () => {
    // Mock wallet connection
    setIsWalletConnected(true);
    setWalletAddress('0x1234...5678');
  };

  const toggleLike = (nftId: string) => {
    setNftAssets(prev =>
      prev.map(nft =>
        nft.id === nftId
          ? {
              ...nft,
              isLiked: !nft.isLiked,
              stats: {
                ...nft.stats,
                likes: nft.isLiked ? nft.stats.likes - 1 : nft.stats.likes + 1,
              },
            }
          : nft
      )
    );
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common':
        return 'text-gray-600 bg-gray-100';
      case 'rare':
        return 'text-blue-600 bg-blue-100';
      case 'epic':
        return 'text-purple-600 bg-purple-100';
      case 'legendary':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getBlockchainColor = (blockchain: string) => {
    switch (blockchain) {
      case 'ethereum':
        return 'text-blue-600 bg-blue-100';
      case 'solana':
        return 'text-purple-600 bg-purple-100';
      case 'polygon':
        return 'text-indigo-600 bg-indigo-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const formatTimeRemaining = (endTime: Date) => {
    const now = new Date();
    const diff = endTime.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h left`;
    return 'Ending soon';
  };

  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 ${className}`}
    >
      {/* Header */}
      <div className='bg-black/20 backdrop-blur-sm border-b border-white/10 sticky top-0 z-10'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-4'>
              <CubeIcon className='w-8 h-8 text-purple-400' />
              <h1 className='text-2xl font-bold text-white'>NFT Marketplace</h1>
              <span className='px-3 py-1 text-xs font-medium text-purple-300 bg-purple-900/50 rounded-full'>
                Beta
              </span>
            </div>

            <div className='flex items-center space-x-4'>
              {!isWalletConnected ? (
                <button
                  onClick={connectWallet}
                  className='px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:opacity-90 transition-opacity'
                >
                  Connect Wallet
                </button>
              ) : (
                <div className='flex items-center space-x-2 px-4 py-2 bg-white/10 rounded-lg'>
                  <ShieldCheckIcon className='w-5 h-5 text-green-400' />
                  <span className='text-white text-sm'>{walletAddress}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        {/* Stats Bar */}
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-8'>
          {[
            {
              label: 'Total Volume',
              value: '1,234 ETH',
              icon: BanknotesIcon,
              color: 'text-green-400',
            },
            { label: 'Active Users', value: '15.2K', icon: UserGroupIcon, color: 'text-blue-400' },
            { label: 'Collections', value: '89', icon: CubeIcon, color: 'text-purple-400' },
            {
              label: 'Floor Price',
              value: '0.5 ETH',
              icon: ArrowTrendingUpIcon,
              color: 'text-yellow-400',
            },
          ].map(stat => (
            <motion.div
              key={stat.label}
              whileHover={{ scale: 1.05 }}
              className='bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4'
            >
              <div className='flex items-center space-x-3'>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
                <div>
                  <p className='text-white/60 text-sm'>{stat.label}</p>
                  <p className='text-white text-lg font-semibold'>{stat.value}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <div className='flex items-center justify-between mb-8'>
          <div className='flex items-center space-x-4'>
            <div className='flex items-center space-x-2'>
              {[
                { id: 'all', label: 'All' },
                { id: 'music', label: 'Music' },
                { id: 'art', label: 'Art' },
                { id: 'video', label: 'Video' },
                { id: 'photography', label: 'Photography' },
              ].map(category => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id as any)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    selectedCategory === category.id
                      ? 'bg-purple-600 text-white'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>

          <div className='flex items-center space-x-2'>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className='bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500'
            >
              <option value='recent'>Recently Added</option>
              <option value='price_low'>Price: Low to High</option>
              <option value='price_high'>Price: High to Low</option>
              <option value='most_liked'>Most Liked</option>
              <option value='ending_soon'>Ending Soon</option>
            </select>
          </div>
        </div>

        {/* NFT Grid */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
          {nftAssets.map(nft => (
            <motion.div
              key={nft.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -5 }}
              className='bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden hover:border-purple-500/50 transition-all duration-300 group'
            >
              {/* NFT Image */}
              <div className='relative'>
                <img
                  src={nft.image}
                  alt={nft.name}
                  className='w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300'
                />

                {/* Overlay */}
                <div className='absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity' />

                {/* Top badges */}
                <div className='absolute top-3 left-3 flex items-center space-x-2'>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${getRarityColor(nft.rarity)}`}
                  >
                    {nft.rarity}
                  </span>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${getBlockchainColor(nft.blockchain)}`}
                  >
                    {nft.blockchain}
                  </span>
                </div>

                {/* Like button */}
                <button
                  onClick={() => toggleLike(nft.id)}
                  className='absolute top-3 right-3 p-2 bg-black/20 backdrop-blur-sm rounded-full hover:bg-black/40 transition-colors'
                >
                  {nft.isLiked ? (
                    <HeartIconSolid className='w-5 h-5 text-red-500' />
                  ) : (
                    <HeartIcon className='w-5 h-5 text-white' />
                  )}
                </button>

                {/* Auction timer */}
                {nft.saleType === 'auction' && nft.auctionEndTime && (
                  <div className='absolute bottom-3 left-3 flex items-center space-x-1 px-2 py-1 bg-red-500/80 backdrop-blur-sm rounded-full text-white text-xs font-medium'>
                    <ClockIcon className='w-3 h-3' />
                    <span>{formatTimeRemaining(nft.auctionEndTime)}</span>
                  </div>
                )}
              </div>

              {/* NFT Info */}
              <div className='p-4'>
                <div className='flex items-start justify-between mb-2'>
                  <h3 className='text-white font-semibold text-lg truncate'>{nft.name}</h3>
                  {nft.creator.verified && (
                    <CheckBadgeIcon className='w-5 h-5 text-blue-400 flex-shrink-0 ml-1' />
                  )}
                </div>

                <p className='text-white/60 text-sm mb-3 line-clamp-2'>{nft.description}</p>

                {/* Creator */}
                <div className='flex items-center space-x-2 mb-3'>
                  <img
                    src={nft.creator.avatar}
                    alt={nft.creator.name}
                    className='w-6 h-6 rounded-full'
                  />
                  <span className='text-white/80 text-sm'>{nft.creator.name}</span>
                </div>

                {/* Price */}
                <div className='flex items-center justify-between mb-3'>
                  <div>
                    <p className='text-white/60 text-xs'>Price</p>
                    <p className='text-white font-semibold'>
                      {nft.price.amount} {nft.price.currency}
                    </p>
                    <p className='text-white/60 text-xs'>${nft.price.usd.toLocaleString()}</p>
                  </div>

                  {nft.saleType === 'auction' && (
                    <div className='text-right'>
                      <p className='text-white/60 text-xs'>Offers</p>
                      <p className='text-white font-semibold'>{nft.stats.offers}</p>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className='flex items-center space-x-4 text-white/60 text-sm mb-4'>
                  <div className='flex items-center space-x-1'>
                    <EyeIcon className='w-4 h-4' />
                    <span>{nft.stats.views}</span>
                  </div>
                  <div className='flex items-center space-x-1'>
                    <HeartIcon className='w-4 h-4' />
                    <span>{nft.stats.likes}</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className='flex space-x-2'>
                  <button
                    onClick={() => setSelectedNFT(nft)}
                    className='flex-1 py-2 px-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium'
                  >
                    {nft.saleType === 'auction' ? 'Place Bid' : 'Buy Now'}
                  </button>
                  <button className='p-2 border border-white/20 text-white/70 hover:text-white hover:border-white/40 rounded-lg transition-colors'>
                    <ShareIcon className='w-4 h-4' />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Featured Collections */}
        <div className='mt-16'>
          <h2 className='text-2xl font-bold text-white mb-6 flex items-center'>
            <TrophyIcon className='w-6 h-6 text-yellow-400 mr-2' />
            Featured Collections
          </h2>

          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
            {[
              {
                name: 'Audio Visualizers',
                description: 'Music transformed into stunning visual art',
                floorPrice: 1.8,
                totalVolume: 234.5,
                items: 1000,
                image:
                  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=200&fit=crop',
              },
              {
                name: 'VR Concerts',
                description: 'Exclusive virtual reality performance recordings',
                floorPrice: 4.2,
                totalVolume: 156.7,
                items: 50,
                image:
                  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=200&fit=crop',
              },
              {
                name: 'Melody Fragments',
                description: 'Rare snippets from unreleased tracks',
                floorPrice: 0.5,
                totalVolume: 89.3,
                items: 5000,
                image:
                  'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&h=200&fit=crop',
              },
            ].map((collection, index) => (
              <motion.div
                key={collection.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -5 }}
                className='bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden hover:border-purple-500/50 transition-all duration-300 group cursor-pointer'
              >
                <div className='relative'>
                  <img
                    src={collection.image}
                    alt={collection.name}
                    className='w-full h-32 object-cover group-hover:scale-105 transition-transform duration-300'
                  />
                  <div className='absolute inset-0 bg-gradient-to-t from-black/60 to-transparent' />
                </div>

                <div className='p-4'>
                  <h3 className='text-white font-semibold text-lg mb-2'>{collection.name}</h3>
                  <p className='text-white/60 text-sm mb-3'>{collection.description}</p>

                  <div className='grid grid-cols-3 gap-4 text-center'>
                    <div>
                      <p className='text-white/60 text-xs'>Floor</p>
                      <p className='text-white font-semibold text-sm'>
                        {collection.floorPrice} ETH
                      </p>
                    </div>
                    <div>
                      <p className='text-white/60 text-xs'>Volume</p>
                      <p className='text-white font-semibold text-sm'>
                        {collection.totalVolume} ETH
                      </p>
                    </div>
                    <div>
                      <p className='text-white/60 text-xs'>Items</p>
                      <p className='text-white font-semibold text-sm'>
                        {collection.items.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* NFT Detail Modal */}
      <AnimatePresence>
        {selectedNFT && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className='fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4'
            onClick={() => setSelectedNFT(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className='bg-slate-900 border border-white/20 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden'
              onClick={e => e.stopPropagation()}
            >
              <div className='grid grid-cols-1 lg:grid-cols-2 h-full'>
                {/* Image */}
                <div className='relative'>
                  <img
                    src={selectedNFT.image}
                    alt={selectedNFT.name}
                    className='w-full h-full object-cover'
                  />
                </div>

                {/* Details */}
                <div className='p-6 overflow-y-auto'>
                  <div className='flex items-start justify-between mb-4'>
                    <div>
                      <h2 className='text-2xl font-bold text-white mb-2'>{selectedNFT.name}</h2>
                      <div className='flex items-center space-x-2'>
                        <img
                          src={selectedNFT.creator.avatar}
                          alt={selectedNFT.creator.name}
                          className='w-6 h-6 rounded-full'
                        />
                        <span className='text-white/80'>{selectedNFT.creator.name}</span>
                        {selectedNFT.creator.verified && (
                          <CheckBadgeIcon className='w-5 h-5 text-blue-400' />
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedNFT(null)}
                      className='text-white/60 hover:text-white'
                    >
                      <svg
                        className='w-6 h-6'
                        fill='none'
                        viewBox='0 0 24 24'
                        stroke='currentColor'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M6 18L18 6M6 6l12 12'
                        />
                      </svg>
                    </button>
                  </div>

                  <p className='text-white/70 mb-6'>{selectedNFT.description}</p>

                  {/* Attributes */}
                  <div className='mb-6'>
                    <h3 className='text-white font-semibold mb-3'>Attributes</h3>
                    <div className='grid grid-cols-2 gap-3'>
                      {selectedNFT.metadata.attributes.map((attr, index) => (
                        <div key={index} className='bg-white/5 rounded-lg p-3 text-center'>
                          <p className='text-white/60 text-sm'>{attr.trait_type}</p>
                          <p className='text-white font-semibold'>{attr.value}</p>
                          <p className='text-white/40 text-xs'>{attr.rarity}% rarity</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Price & Action */}
                  <div className='border-t border-white/10 pt-6'>
                    <div className='flex items-center justify-between mb-4'>
                      <div>
                        <p className='text-white/60 text-sm'>Current Price</p>
                        <p className='text-2xl font-bold text-white'>
                          {selectedNFT.price.amount} {selectedNFT.price.currency}
                        </p>
                        <p className='text-white/60'>${selectedNFT.price.usd.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className='flex space-x-3'>
                      <button className='flex-1 py-3 px-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:opacity-90 transition-opacity font-semibold'>
                        {selectedNFT.saleType === 'auction' ? 'Place Bid' : 'Buy Now'}
                      </button>
                      <button className='px-6 py-3 border border-white/20 text-white/70 hover:text-white hover:border-white/40 rounded-lg transition-colors'>
                        Make Offer
                      </button>
                    </div>

                    {selectedNFT.metadata.unlockableContent && (
                      <div className='mt-4 p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg'>
                        <div className='flex items-center space-x-2 mb-2'>
                          <SparklesIcon className='w-5 h-5 text-purple-400' />
                          <span className='text-white font-medium'>Unlockable Content</span>
                        </div>
                        <p className='text-white/70 text-sm'>
                          {selectedNFT.metadata.unlockableContent}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
