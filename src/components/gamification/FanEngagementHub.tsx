'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrophyIcon,
  StarIcon,
  FireIcon,
  BoltIcon,
  GiftIcon,
  HeartIcon,
  MusicalNoteIcon,
  UserGroupIcon,
  ChartBarIcon,
  SparklesIcon,
  CrownIcon,
  ShieldIcon,
  LightningBoltIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'engagement' | 'discovery' | 'social' | 'exclusive' | 'streak';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  progress: number;
  maxProgress: number;
  isUnlocked: boolean;
  unlockedAt?: Date;
  reward: {
    type: 'xp' | 'badge' | 'access' | 'discount' | 'nft';
    value: number | string;
  };
}

interface FanLevel {
  level: number;
  name: string;
  minXP: number;
  perks: string[];
  color: string;
  icon: string;
}

interface Streak {
  type: 'daily_listen' | 'weekly_discovery' | 'monthly_support';
  current: number;
  best: number;
  isActive: boolean;
  lastActivity: Date;
  rewards: Array<{ day: number; reward: string; claimed: boolean }>;
}

interface LeaderboardEntry {
  id: string;
  user: {
    name: string;
    avatar: string;
    level: number;
  };
  score: number;
  rank: number;
  trend: 'up' | 'down' | 'same';
  badge?: string;
}

interface FanEngagementHubProps {
  currentUser: {
    id: string;
    name: string;
    avatar: string;
    level: number;
    xp: number;
    achievements: string[];
  };
  className?: string;
}

export default function FanEngagementHub({ currentUser, className = '' }: FanEngagementHubProps) {
  const [activeTab, setActiveTab] = useState<
    'achievements' | 'leaderboard' | 'rewards' | 'challenges'
  >('achievements');
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [fanLevels, setFanLevels] = useState<FanLevel[]>([]);
  const [streaks, setStreaks] = useState<Streak[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [showLevelUpAnimation, setShowLevelUpAnimation] = useState(false);

  // Mock data initialization
  useEffect(() => {
    // Fan levels
    const mockFanLevels: FanLevel[] = [
      {
        level: 1,
        name: 'Music Lover',
        minXP: 0,
        perks: ['Basic profile customization', 'Comment on tracks'],
        color: 'bg-gray-500',
        icon: '🎵',
      },
      {
        level: 2,
        name: 'Dedicated Fan',
        minXP: 1000,
        perks: ['Early access to releases', 'Fan badge', 'Priority support'],
        color: 'bg-blue-500',
        icon: '💙',
      },
      {
        level: 3,
        name: 'Super Fan',
        minXP: 5000,
        perks: ['VIP chat access', '10% discount on merch', 'Exclusive content'],
        color: 'bg-purple-500',
        icon: '🌟',
      },
      {
        level: 4,
        name: 'Ultimate Fan',
        minXP: 15000,
        perks: ['Meet & greet access', '20% discount', 'Limited edition NFTs'],
        color: 'bg-pink-500',
        icon: '👑',
      },
      {
        level: 5,
        name: 'Legend',
        minXP: 50000,
        perks: ['Personal artist interaction', 'Free merchandise', 'Concert backstage'],
        color: 'bg-yellow-500',
        icon: '🏆',
      },
    ];

    // Achievements
    const mockAchievements: Achievement[] = [
      {
        id: '1',
        title: 'First Listen',
        description: 'Listen to your first track on DirectFanz',
        icon: '🎧',
        category: 'engagement',
        rarity: 'common',
        progress: 1,
        maxProgress: 1,
        isUnlocked: true,
        unlockedAt: new Date('2024-01-15'),
        reward: { type: 'xp', value: 50 },
      },
      {
        id: '2',
        title: 'Night Owl',
        description: 'Listen to music between 12 AM and 6 AM',
        icon: '🦉',
        category: 'engagement',
        rarity: 'rare',
        progress: 3,
        maxProgress: 5,
        isUnlocked: false,
        reward: { type: 'badge', value: 'Night Owl Badge' },
      },
      {
        id: '3',
        title: 'Tastemaker',
        description: 'Discover 10 new artists before they hit 1K followers',
        icon: '🔍',
        category: 'discovery',
        rarity: 'epic',
        progress: 7,
        maxProgress: 10,
        isUnlocked: false,
        reward: { type: 'access', value: 'Tastemaker Dashboard' },
      },
      {
        id: '4',
        title: 'Social Butterfly',
        description: 'Share 25 tracks with friends',
        icon: '🦋',
        category: 'social',
        rarity: 'rare',
        progress: 18,
        maxProgress: 25,
        isUnlocked: false,
        reward: { type: 'discount', value: '15% off next purchase' },
      },
      {
        id: '5',
        title: 'Streak Master',
        description: 'Maintain a 30-day listening streak',
        icon: '⚡',
        category: 'streak',
        rarity: 'legendary',
        progress: 23,
        maxProgress: 30,
        isUnlocked: false,
        reward: { type: 'nft', value: 'Exclusive Streak NFT' },
      },
    ];

    // Streaks
    const mockStreaks: Streak[] = [
      {
        type: 'daily_listen',
        current: 23,
        best: 45,
        isActive: true,
        lastActivity: new Date(),
        rewards: [
          { day: 7, reward: '50 XP Bonus', claimed: true },
          { day: 14, reward: 'Rare Badge', claimed: true },
          { day: 21, reward: 'Profile Frame', claimed: true },
          { day: 30, reward: 'Exclusive NFT', claimed: false },
        ],
      },
      {
        type: 'weekly_discovery',
        current: 3,
        best: 8,
        isActive: true,
        lastActivity: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        rewards: [
          { day: 4, reward: 'Discovery Badge', claimed: false },
          { day: 8, reward: 'Early Access Pass', claimed: false },
        ],
      },
    ];

    // Leaderboard
    const mockLeaderboard: LeaderboardEntry[] = [
      {
        id: '1',
        user: {
          name: 'Alex Rivera',
          avatar: 'https://ui-avatars.com/api/?name=Alex+Rivera&background=6366f1&color=fff',
          level: 5,
        },
        score: 52430,
        rank: 1,
        trend: 'same',
        badge: '👑',
      },
      {
        id: '2',
        user: {
          name: 'Jamie Chen',
          avatar: 'https://ui-avatars.com/api/?name=Jamie+Chen&background=8b5cf6&color=fff',
          level: 4,
        },
        score: 48920,
        rank: 2,
        trend: 'up',
        badge: '🔥',
      },
      {
        id: '3',
        user: { name: currentUser.name, avatar: currentUser.avatar, level: currentUser.level },
        score: 34560,
        rank: 3,
        trend: 'down',
      },
      {
        id: '4',
        user: {
          name: 'Morgan Taylor',
          avatar: 'https://ui-avatars.com/api/?name=Morgan+Taylor&background=ec4899&color=fff',
          level: 3,
        },
        score: 28940,
        rank: 4,
        trend: 'up',
      },
      {
        id: '5',
        user: {
          name: 'Casey Jordan',
          avatar: 'https://ui-avatars.com/api/?name=Casey+Jordan&background=10b981&color=fff',
          level: 3,
        },
        score: 25670,
        rank: 5,
        trend: 'same',
      },
    ];

    setFanLevels(mockFanLevels);
    setAchievements(mockAchievements);
    setStreaks(mockStreaks);
    setLeaderboard(mockLeaderboard);
  }, []);

  const getCurrentLevel = () => {
    return (
      fanLevels.find(
        level =>
          currentUser.xp >= level.minXP &&
          (fanLevels[level.level] ? currentUser.xp < fanLevels[level.level].minXP : true)
      ) || fanLevels[0]
    );
  };

  const getNextLevel = () => {
    const currentLevel = getCurrentLevel();
    return fanLevels[currentLevel.level] || null;
  };

  const getProgressToNextLevel = () => {
    const currentLevel = getCurrentLevel();
    const nextLevel = getNextLevel();
    if (!nextLevel) return 100;

    const progress =
      ((currentUser.xp - currentLevel.minXP) / (nextLevel.minXP - currentLevel.minXP)) * 100;
    return Math.min(100, Math.max(0, progress));
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common':
        return 'border-gray-300 bg-gray-50';
      case 'rare':
        return 'border-blue-300 bg-blue-50';
      case 'epic':
        return 'border-purple-300 bg-purple-50';
      case 'legendary':
        return 'border-yellow-300 bg-yellow-50';
      default:
        return 'border-gray-300 bg-gray-50';
    }
  };

  const getRarityGlow = (rarity: string) => {
    switch (rarity) {
      case 'common':
        return 'shadow-gray-200';
      case 'rare':
        return 'shadow-blue-200';
      case 'epic':
        return 'shadow-purple-200';
      case 'legendary':
        return 'shadow-yellow-200';
      default:
        return 'shadow-gray-200';
    }
  };

  const claimStreak = (streakType: string, day: number) => {
    setStreaks(prev =>
      prev.map(streak =>
        streak.type === streakType
          ? {
              ...streak,
              rewards: streak.rewards.map(reward =>
                reward.day === day ? { ...reward, claimed: true } : reward
              ),
            }
          : streak
      )
    );
  };

  return (
    <div className={`max-w-6xl mx-auto p-6 ${className}`}>
      {/* Header with User Progress */}
      <div className='bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl p-6 text-white mb-8'>
        <div className='flex items-center justify-between mb-6'>
          <div className='flex items-center space-x-4'>
            <div className='relative'>
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className='w-16 h-16 rounded-full border-4 border-white/20'
              />
              <div className='absolute -bottom-2 -right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center text-lg'>
                {getCurrentLevel().icon}
              </div>
            </div>
            <div>
              <h2 className='text-2xl font-bold'>{currentUser.name}</h2>
              <p className='text-white/90'>
                {getCurrentLevel().name} • Level {getCurrentLevel().level}
              </p>
            </div>
          </div>

          <div className='text-right'>
            <p className='text-white/90 text-sm'>Total XP</p>
            <p className='text-3xl font-bold'>{currentUser.xp.toLocaleString()}</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className='space-y-2'>
          <div className='flex items-center justify-between text-sm'>
            <span>Progress to {getNextLevel()?.name || 'Max Level'}</span>
            <span>{Math.round(getProgressToNextLevel())}%</span>
          </div>
          <div className='w-full bg-white/20 rounded-full h-3'>
            <motion.div
              className='bg-white rounded-full h-3'
              initial={{ width: 0 }}
              animate={{ width: `${getProgressToNextLevel()}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>
          {getNextLevel() && (
            <div className='flex items-center justify-between text-xs text-white/75'>
              <span>{getCurrentLevel().minXP.toLocaleString()} XP</span>
              <span>{getNextLevel()!.minXP.toLocaleString()} XP</span>
            </div>
          )}
        </div>

        {/* Active Streaks */}
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mt-6'>
          {streaks
            .filter(s => s.isActive)
            .map(streak => (
              <motion.div
                key={streak.type}
                whileHover={{ scale: 1.02 }}
                className='bg-white/10 backdrop-blur-sm rounded-lg p-4'
              >
                <div className='flex items-center justify-between mb-2'>
                  <span className='text-sm font-medium capitalize'>
                    {streak.type.replace('_', ' ')}
                  </span>
                  <FireIcon className='w-5 h-5 text-orange-400' />
                </div>
                <div className='flex items-baseline space-x-2'>
                  <span className='text-2xl font-bold'>{streak.current}</span>
                  <span className='text-sm text-white/75'>days</span>
                </div>
                <div className='text-xs text-white/75'>Best: {streak.best} days</div>
              </motion.div>
            ))}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className='flex space-x-1 bg-gray-100 rounded-lg p-1 mb-6'>
        {[
          { id: 'achievements', label: 'Achievements', icon: TrophyIcon },
          { id: 'leaderboard', label: 'Leaderboard', icon: ChartBarIcon },
          { id: 'rewards', label: 'Rewards', icon: GiftIcon },
          { id: 'challenges', label: 'Challenges', icon: BoltIcon },
        ].map(tab => {
          const IconComponent = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <IconComponent className='w-5 h-5' />
              <span className='font-medium'>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode='wait'>
        {/* Achievements Tab */}
        {activeTab === 'achievements' && (
          <motion.div
            key='achievements'
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className='space-y-6'
          >
            <div className='flex items-center justify-between'>
              <h3 className='text-xl font-semibold text-gray-900'>Your Achievements</h3>
              <div className='text-sm text-gray-600'>
                {achievements.filter(a => a.isUnlocked).length} of {achievements.length} unlocked
              </div>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
              {achievements.map(achievement => (
                <motion.div
                  key={achievement.id}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => setSelectedAchievement(achievement)}
                  className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                    achievement.isUnlocked
                      ? `${getRarityColor(achievement.rarity)} shadow-lg ${getRarityGlow(achievement.rarity)}`
                      : 'border-gray-200 bg-gray-50 opacity-75'
                  }`}
                >
                  <div className='flex items-center space-x-3 mb-3'>
                    <div className={`text-3xl ${achievement.isUnlocked ? '' : 'grayscale'}`}>
                      {achievement.icon}
                    </div>
                    <div className='flex-1'>
                      <h4 className='font-semibold text-gray-900'>{achievement.title}</h4>
                      <p className='text-sm text-gray-600 capitalize'>{achievement.rarity}</p>
                    </div>
                    {achievement.isUnlocked && (
                      <div className='w-8 h-8 bg-green-100 rounded-full flex items-center justify-center'>
                        <StarIconSolid className='w-5 h-5 text-green-600' />
                      </div>
                    )}
                  </div>

                  <p className='text-sm text-gray-700 mb-3'>{achievement.description}</p>

                  {/* Progress Bar */}
                  <div className='space-y-1'>
                    <div className='flex items-center justify-between text-sm'>
                      <span className='text-gray-600'>Progress</span>
                      <span className='font-medium'>
                        {achievement.progress}/{achievement.maxProgress}
                      </span>
                    </div>
                    <div className='w-full bg-gray-200 rounded-full h-2'>
                      <div
                        className={`h-2 rounded-full transition-all ${
                          achievement.isUnlocked ? 'bg-green-500' : 'bg-indigo-500'
                        }`}
                        style={{
                          width: `${(achievement.progress / achievement.maxProgress) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Reward */}
                  <div className='mt-3 text-xs text-gray-600'>
                    Reward: {achievement.reward.value}{' '}
                    {achievement.reward.type === 'xp' ? 'XP' : achievement.reward.value}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <motion.div
            key='leaderboard'
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className='bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden'>
              <div className='px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50'>
                <h3 className='text-xl font-semibold text-gray-900'>Top Fans This Month</h3>
                <p className='text-gray-600'>Compete with other fans for exclusive rewards</p>
              </div>

              <div className='divide-y divide-gray-100'>
                {leaderboard.map((entry, index) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`px-6 py-4 hover:bg-gray-50 transition-colors ${
                      entry.user.name === currentUser.name
                        ? 'bg-indigo-50 border-l-4 border-indigo-500'
                        : ''
                    }`}
                  >
                    <div className='flex items-center space-x-4'>
                      {/* Rank */}
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          entry.rank === 1
                            ? 'bg-yellow-100 text-yellow-800'
                            : entry.rank === 2
                              ? 'bg-gray-100 text-gray-800'
                              : entry.rank === 3
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-gray-50 text-gray-600'
                        }`}
                      >
                        {entry.rank}
                      </div>

                      {/* Avatar */}
                      <img
                        src={entry.user.avatar}
                        alt={entry.user.name}
                        className='w-12 h-12 rounded-full'
                      />

                      {/* User Info */}
                      <div className='flex-1'>
                        <div className='flex items-center space-x-2'>
                          <h4 className='font-semibold text-gray-900'>{entry.user.name}</h4>
                          {entry.badge && <span className='text-lg'>{entry.badge}</span>}
                          <span className='px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full'>
                            Level {entry.user.level}
                          </span>
                        </div>
                        <p className='text-sm text-gray-600'>{entry.score.toLocaleString()} XP</p>
                      </div>

                      {/* Trend */}
                      <div className='flex items-center'>
                        {entry.trend === 'up' && (
                          <div className='flex items-center space-x-1 text-green-600'>
                            <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20'>
                              <path
                                fillRule='evenodd'
                                d='M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z'
                                clipRule='evenodd'
                              />
                            </svg>
                          </div>
                        )}
                        {entry.trend === 'down' && (
                          <div className='flex items-center space-x-1 text-red-600'>
                            <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20'>
                              <path
                                fillRule='evenodd'
                                d='M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z'
                                clipRule='evenodd'
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Rewards Tab */}
        {activeTab === 'rewards' && (
          <motion.div
            key='rewards'
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className='space-y-6'
          >
            {/* Streak Rewards */}
            <div className='space-y-4'>
              <h3 className='text-xl font-semibold text-gray-900'>Daily Streak Rewards</h3>

              {streaks.map(streak => (
                <div
                  key={streak.type}
                  className='bg-white rounded-xl shadow-sm border border-gray-200 p-6'
                >
                  <div className='flex items-center justify-between mb-4'>
                    <div>
                      <h4 className='font-semibold text-gray-900 capitalize'>
                        {streak.type.replace('_', ' ')} Streak
                      </h4>
                      <p className='text-sm text-gray-600'>
                        Current: {streak.current} days • Best: {streak.best} days
                      </p>
                    </div>
                    <div
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        streak.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {streak.isActive ? 'Active' : 'Inactive'}
                    </div>
                  </div>

                  <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
                    {streak.rewards.map((reward, index) => (
                      <div
                        key={index}
                        className={`relative border-2 rounded-lg p-3 text-center ${
                          streak.current >= reward.day
                            ? reward.claimed
                              ? 'border-green-300 bg-green-50'
                              : 'border-indigo-300 bg-indigo-50'
                            : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <div className='text-xs text-gray-600 mb-1'>Day {reward.day}</div>
                        <div className='font-medium text-sm mb-2'>{reward.reward}</div>

                        {streak.current >= reward.day &&
                          (reward.claimed ? (
                            <div className='flex items-center justify-center'>
                              <span className='text-xs text-green-600 font-medium'>Claimed</span>
                            </div>
                          ) : (
                            <button
                              onClick={() => claimStreak(streak.type, reward.day)}
                              className='w-full py-1 px-2 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 transition-colors'
                            >
                              Claim
                            </button>
                          ))}

                        {reward.claimed && (
                          <div className='absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center'>
                            <StarIconSolid className='w-4 h-4 text-white' />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Level Perks */}
            <div>
              <h3 className='text-xl font-semibold text-gray-900 mb-4'>Level Perks</h3>
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                {fanLevels.map(level => (
                  <motion.div
                    key={level.level}
                    whileHover={{ scale: 1.02 }}
                    className={`border-2 rounded-xl p-4 ${
                      currentUser.level >= level.level
                        ? 'border-indigo-300 bg-indigo-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className='flex items-center space-x-3 mb-3'>
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                          currentUser.level >= level.level ? level.color : 'bg-gray-300'
                        }`}
                      >
                        {level.icon}
                      </div>
                      <div>
                        <h4 className='font-semibold text-gray-900'>{level.name}</h4>
                        <p className='text-sm text-gray-600'>Level {level.level}</p>
                      </div>
                      {currentUser.level >= level.level && (
                        <CrownIcon className='w-5 h-5 text-yellow-500' />
                      )}
                    </div>

                    <div className='space-y-2'>
                      {level.perks.map((perk, index) => (
                        <div key={index} className='flex items-center space-x-2'>
                          <div
                            className={`w-2 h-2 rounded-full ${
                              currentUser.level >= level.level ? 'bg-green-500' : 'bg-gray-300'
                            }`}
                          />
                          <span className='text-sm text-gray-700'>{perk}</span>
                        </div>
                      ))}
                    </div>

                    {currentUser.level < level.level && (
                      <div className='mt-3 text-xs text-gray-600'>
                        Requires {level.minXP.toLocaleString()} XP
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Challenges Tab */}
        {activeTab === 'challenges' && (
          <motion.div
            key='challenges'
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className='text-center py-12'
          >
            <SparklesIcon className='w-16 h-16 text-indigo-400 mx-auto mb-4' />
            <h3 className='text-xl font-semibold text-gray-900 mb-2'>Weekly Challenges</h3>
            <p className='text-gray-600 mb-6'>New challenges coming soon!</p>
            <button className='px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors'>
              Get Notified
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Achievement Detail Modal */}
      <AnimatePresence>
        {selectedAchievement && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className='fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4'
            onClick={() => setSelectedAchievement(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className='bg-white rounded-2xl max-w-md w-full p-6'
              onClick={e => e.stopPropagation()}
            >
              <div className='text-center mb-6'>
                <div className='text-6xl mb-4'>{selectedAchievement.icon}</div>
                <h3 className='text-2xl font-bold text-gray-900 mb-2'>
                  {selectedAchievement.title}
                </h3>
                <p className='text-gray-600'>{selectedAchievement.description}</p>
              </div>

              <div className='space-y-4'>
                <div className='flex items-center justify-between'>
                  <span className='text-sm text-gray-600'>Progress</span>
                  <span className='font-semibold'>
                    {selectedAchievement.progress}/{selectedAchievement.maxProgress}
                  </span>
                </div>

                <div className='w-full bg-gray-200 rounded-full h-3'>
                  <div
                    className='bg-indigo-500 h-3 rounded-full transition-all'
                    style={{
                      width: `${(selectedAchievement.progress / selectedAchievement.maxProgress) * 100}%`,
                    }}
                  />
                </div>

                <div className='flex items-center justify-between text-sm'>
                  <span className='text-gray-600'>Rarity</span>
                  <span
                    className={`px-2 py-1 rounded-full font-medium capitalize ${
                      selectedAchievement.rarity === 'common'
                        ? 'bg-gray-100 text-gray-800'
                        : selectedAchievement.rarity === 'rare'
                          ? 'bg-blue-100 text-blue-800'
                          : selectedAchievement.rarity === 'epic'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {selectedAchievement.rarity}
                  </span>
                </div>

                <div className='flex items-center justify-between text-sm'>
                  <span className='text-gray-600'>Reward</span>
                  <span className='font-semibold'>
                    {selectedAchievement.reward.value}{' '}
                    {selectedAchievement.reward.type === 'xp'
                      ? 'XP'
                      : selectedAchievement.reward.value}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedAchievement(null)}
                className='w-full mt-6 py-2 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors'
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
