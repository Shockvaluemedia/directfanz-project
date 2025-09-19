#!/usr/bin/env node

/**
 * Performance Baseline Measurement Script
 *
 * This script measures current database query performance to establish
 * baseline metrics for comparison with optimization improvements.
 */

import { PrismaClient } from '@prisma/client';
import { performance } from 'perf_hooks';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

class PerformanceBaseline {
  constructor() {
    this.results = {};
    this.iterations = 5; // Run each query 5 times for average
    this.startTime = new Date().toISOString();
  }

  async measureQuery(name, queryFunction, description = '') {
    console.log(`\n🔍 Testing ${name}...`);
    const times = [];
    let error = null;

    try {
      // Warm up query (exclude from timing)
      await queryFunction();

      // Measure multiple iterations
      for (let i = 0; i < this.iterations; i++) {
        const start = performance.now();
        await queryFunction();
        const duration = performance.now() - start;
        times.push(duration);

        // Show progress
        process.stdout.write(`  Iteration ${i + 1}/${this.iterations}: ${duration.toFixed(2)}ms\r`);
      }

      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);
      const median = times.sort((a, b) => a - b)[Math.floor(times.length / 2)];

      this.results[name] = {
        description,
        avg: parseFloat(avg.toFixed(2)),
        min: parseFloat(min.toFixed(2)),
        max: parseFloat(max.toFixed(2)),
        median: parseFloat(median.toFixed(2)),
        times,
        status: 'success',
        iterations: this.iterations,
      };

      console.log(
        `\n  ✅ Average: ${avg.toFixed(2)}ms (min: ${min.toFixed(2)}ms, max: ${max.toFixed(2)}ms)`
      );
    } catch (err) {
      error = err.message;
      this.results[name] = {
        description,
        error,
        status: 'error',
        iterations: this.iterations,
      };

      console.log(`\n  ❌ Error: ${error}`);
    }
  }

  async testUserQueries() {
    console.log('\n📊 === USER AUTHENTICATION & MANAGEMENT QUERIES ===');

    // User authentication by email
    await this.measureQuery(
      'user_auth_by_email',
      async () => {
        await prisma.users.findUnique({
          where: { email: 'test@example.com' },
          include: { accounts: true },
        });
      },
      'User login authentication by email'
    );

    // User session validation
    await this.measureQuery(
      'session_validation',
      async () => {
        await prisma.sessions.findFirst({
          where: {
            userId: 'test-user-id',
            expires: { gt: new Date() },
          },
          include: { users: true },
        });
      },
      'Session validation for authenticated user'
    );

    // User profile with activity
    await this.measureQuery(
      'user_profile_activity',
      async () => {
        await prisma.users.findUnique({
          where: { id: 'test-user-id' },
          include: {
            subscriptions: { take: 10 },
            content_likes: { take: 20 },
            content_views: { take: 20 },
            playlists: { take: 5 },
          },
        });
      },
      'User profile with recent activity data'
    );

    // Active user accounts
    await this.measureQuery(
      'active_users',
      async () => {
        await prisma.users.findMany({
          where: {
            lastSeenAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
          take: 50,
          orderBy: { lastSeenAt: 'desc' },
        });
      },
      'Active users in the last 7 days'
    );
  }

  async testContentQueries() {
    console.log('\n📊 === CONTENT DISCOVERY & ACCESS QUERIES ===');

    // Content feed by artist
    await this.measureQuery(
      'content_by_artist',
      async () => {
        await prisma.content.findMany({
          where: {
            artistId: 'test-artist-id',
            visibility: 'PUBLIC',
          },
          include: {
            users: true,
            content_likes: { take: 5 },
            content_views: { take: 5 },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        });
      },
      'Artist content feed with engagement data'
    );

    // Trending content
    await this.measureQuery(
      'trending_content',
      async () => {
        await prisma.content.findMany({
          where: { visibility: 'PUBLIC' },
          include: {
            users: true,
            content_likes: { take: 3 },
          },
          orderBy: { totalViews: 'desc' },
          take: 20,
        });
      },
      'Trending content by view count'
    );

    // Content search by type
    await this.measureQuery(
      'content_by_type',
      async () => {
        await prisma.content.findMany({
          where: {
            type: 'VIDEO',
            visibility: 'PUBLIC',
          },
          include: { users: true },
          orderBy: { createdAt: 'desc' },
          take: 30,
        });
      },
      'Content filtered by type'
    );

    // Content with comments
    await this.measureQuery(
      'content_with_comments',
      async () => {
        await prisma.content.findMany({
          where: { artistId: 'test-artist-id' },
          include: {
            comments: {
              take: 10,
              include: { users: true },
              orderBy: { createdAt: 'desc' },
            },
            content_likes: true,
          },
          take: 10,
        });
      },
      'Content with comments and engagement'
    );
  }

  async testSubscriptionQueries() {
    console.log('\n📊 === SUBSCRIPTION & PAYMENT QUERIES ===');

    // Fan subscriptions
    await this.measureQuery(
      'fan_subscriptions',
      async () => {
        await prisma.subscriptions.findMany({
          where: {
            fanId: 'test-fan-id',
            status: 'ACTIVE',
          },
          include: {
            tiers: true,
            users: true,
          },
          orderBy: { createdAt: 'desc' },
        });
      },
      'Active subscriptions for a fan'
    );

    // Artist subscriber count
    await this.measureQuery(
      'artist_subscribers',
      async () => {
        await prisma.subscriptions.count({
          where: {
            artistId: 'test-artist-id',
            status: 'ACTIVE',
          },
        });
      },
      'Count of active subscribers for artist'
    );

    // Subscription renewals
    await this.measureQuery(
      'subscription_renewals',
      async () => {
        const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await prisma.subscriptions.findMany({
          where: {
            currentPeriodEnd: { lte: futureDate },
            status: 'ACTIVE',
          },
          include: {
            tiers: true,
            users: true,
          },
          take: 100,
        });
      },
      'Subscriptions due for renewal in next 7 days'
    );

    // Invoice queries
    await this.measureQuery(
      'recent_invoices',
      async () => {
        await prisma.invoices.findMany({
          where: {
            status: 'PAID',
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
          include: { subscriptions: true },
          orderBy: { createdAt: 'desc' },
          take: 50,
        });
      },
      'Recent paid invoices (last 30 days)'
    );
  }

  async testCampaignQueries() {
    console.log('\n📊 === CAMPAIGN & CHALLENGE QUERIES ===');

    // Active campaigns
    await this.measureQuery(
      'active_campaigns',
      async () => {
        await prisma.campaigns.findMany({
          where: {
            artistId: 'test-artist-id',
            status: 'ACTIVE',
          },
          include: {
            challenges: { take: 5 },
            campaign_rewards: { take: 5 },
          },
          orderBy: { createdAt: 'desc' },
        });
      },
      'Active campaigns for artist with challenges'
    );

    // Challenge leaderboards
    await this.measureQuery(
      'challenge_leaderboard',
      async () => {
        await prisma.challenge_leaderboards.findMany({
          where: { challengeId: 'test-challenge-id' },
          include: { users: true },
          orderBy: { rank: 'asc' },
          take: 20,
        });
      },
      'Challenge leaderboard with user data'
    );

    // Challenge submissions
    await this.measureQuery(
      'challenge_submissions',
      async () => {
        await prisma.challenge_submissions.findMany({
          where: {
            challengeId: 'test-challenge-id',
            status: 'PENDING',
          },
          include: {
            users: true,
            challenges: true,
          },
          orderBy: { submittedAt: 'desc' },
          take: 30,
        });
      },
      'Pending challenge submissions'
    );

    // Campaign analytics
    await this.measureQuery(
      'campaign_analytics',
      async () => {
        await prisma.campaign_analytics.findMany({
          where: {
            campaignId: 'test-campaign-id',
            date: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
          orderBy: { date: 'desc' },
          take: 30,
        });
      },
      'Campaign analytics for last 30 days'
    );
  }

  async testStreamingQueries() {
    console.log('\n📊 === LIVE STREAMING & REAL-TIME QUERIES ===');

    // Active streams
    await this.measureQuery(
      'active_streams',
      async () => {
        await prisma.live_streams.findMany({
          where: { status: 'LIVE' },
          include: {
            users: true,
            stream_viewers: { take: 10 },
          },
          orderBy: { startedAt: 'desc' },
        });
      },
      'Currently active live streams'
    );

    // Stream chat messages
    await this.measureQuery(
      'stream_chat_recent',
      async () => {
        await prisma.stream_chat_messages.findMany({
          where: { streamId: 'test-stream-id' },
          include: { users: true },
          orderBy: { createdAt: 'desc' },
          take: 50,
        });
      },
      'Recent stream chat messages'
    );

    // Stream tips and analytics
    await this.measureQuery(
      'stream_tips',
      async () => {
        await prisma.stream_tips.findMany({
          where: {
            streamId: 'test-stream-id',
            status: 'COMPLETED',
          },
          include: { users: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        });
      },
      'Stream tips and donations'
    );

    // Stream viewers analytics
    await this.measureQuery(
      'stream_analytics',
      async () => {
        await prisma.stream_viewers.findMany({
          where: { streamId: 'test-stream-id' },
          include: { users: true },
          orderBy: { joinedAt: 'desc' },
          take: 100,
        });
      },
      'Stream viewer analytics'
    );
  }

  async testMessagingQueries() {
    console.log('\n📊 === MESSAGING & COMMUNICATION QUERIES ===');

    // User inbox
    await this.measureQuery(
      'user_inbox',
      async () => {
        await prisma.messages.findMany({
          where: { recipientId: 'test-user-id' },
          include: {
            users_messages_senderIdTousers: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        });
      },
      'User message inbox'
    );

    // Unread messages
    await this.measureQuery(
      'unread_messages',
      async () => {
        await prisma.messages.count({
          where: {
            recipientId: 'test-user-id',
            readAt: null,
          },
        });
      },
      'Count of unread messages'
    );

    // Content comments
    await this.measureQuery(
      'content_comments',
      async () => {
        await prisma.comments.findMany({
          where: { contentId: 'test-content-id' },
          include: { users: true },
          orderBy: { createdAt: 'desc' },
          take: 30,
        });
      },
      'Comments on content'
    );
  }

  generateSummary() {
    const totalTests = Object.keys(this.results).length;
    const successfulTests = Object.values(this.results).filter(r => r.status === 'success').length;
    const failedTests = totalTests - successfulTests;

    const avgTimes = Object.values(this.results)
      .filter(r => r.status === 'success')
      .map(r => r.avg);

    const overallAvg =
      avgTimes.length > 0 ? avgTimes.reduce((a, b) => a + b, 0) / avgTimes.length : 0;

    return {
      timestamp: this.startTime,
      totalTests,
      successfulTests,
      failedTests,
      overallAverageTime: parseFloat(overallAvg.toFixed(2)),
      slowestQuery: avgTimes.length > 0 ? Math.max(...avgTimes) : 0,
      fastestQuery: avgTimes.length > 0 ? Math.min(...avgTimes) : 0,
      results: this.results,
    };
  }

  async saveResults(filename = null) {
    if (!filename) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      filename = `performance-baseline-${timestamp}.json`;
    }

    const resultsDir = path.join(process.cwd(), 'performance-results');

    try {
      await fs.access(resultsDir);
    } catch {
      await fs.mkdir(resultsDir, { recursive: true });
    }

    const filePath = path.join(resultsDir, filename);
    const summary = this.generateSummary();

    await fs.writeFile(filePath, JSON.stringify(summary, null, 2));

    return { filePath, summary };
  }

  async runAllTests() {
    console.log('🚀 Starting Performance Baseline Measurement');
    console.log(`📅 Timestamp: ${this.startTime}`);
    console.log(`🔄 Iterations per query: ${this.iterations}`);
    console.log('='.repeat(60));

    try {
      await this.testUserQueries();
      await this.testContentQueries();
      await this.testSubscriptionQueries();
      await this.testCampaignQueries();
      await this.testStreamingQueries();
      await this.testMessagingQueries();

      console.log('\n' + '='.repeat(60));
      console.log('✅ Performance baseline measurement completed!');

      const { filePath, summary } = await this.saveResults();

      console.log('\n📊 SUMMARY:');
      console.log(`   Total tests: ${summary.totalTests}`);
      console.log(`   Successful: ${summary.successfulTests}`);
      console.log(`   Failed: ${summary.failedTests}`);
      console.log(`   Overall average: ${summary.overallAverageTime}ms`);
      console.log(`   Slowest query: ${summary.slowestQuery}ms`);
      console.log(`   Fastest query: ${summary.fastestQuery}ms`);
      console.log(`\n💾 Results saved to: ${filePath}`);

      return summary;
    } catch (error) {
      console.error('\n❌ Error during performance testing:', error);
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const baseline = new PerformanceBaseline();

  baseline
    .runAllTests()
    .then(summary => {
      process.exit(0);
    })
    .catch(error => {
      console.error('Performance baseline failed:', error);
      process.exit(1);
    });
}

export { PerformanceBaseline };
