#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

// Common Prisma table name fixes
const tableFixes = [
  // Single to plural table names
  { from: 'prisma.user.', to: 'prisma.users.' },
  { from: 'prisma.artist.', to: 'prisma.artists.' },
  { from: 'prisma.tier.', to: 'prisma.tiers.' },
  { from: 'prisma.content.', to: 'prisma.content.' }, // Already correct
  { from: 'prisma.campaign.', to: 'prisma.campaigns.' },
  { from: 'prisma.challenge.', to: 'prisma.challenges.' },
  { from: 'prisma.liveStream.', to: 'prisma.live_streams.' },
  { from: 'prisma.streamChatMessage.', to: 'prisma.stream_chat_messages.' },
  { from: 'prisma.contentLike.', to: 'prisma.content_likes.' },
  { from: 'prisma.paymentFailure.', to: 'prisma.payment_failures.' },
  { from: 'prisma.report.', to: 'prisma.reports.' },

  // Challenge related fixes
  { from: 'prisma.challenges.eaderboard.', to: 'prisma.challenge_leaderboards.' },
  { from: 'prisma.challenges.ubmission.', to: 'prisma.challenge_submissions.' },
  { from: 'prisma.challenges.articipation.', to: 'prisma.challenge_participations.' },
  { from: 'challengeParticipation.', to: 'challenge_participations.' },
  { from: 'challengeSubmission.', to: 'challenge_submissions.' },
  { from: 'challengeLeaderboard.', to: 'challenge_leaderboards.' },

  // Relation name fixes - content relations
  { from: 'artist: {', to: 'users: {' },
  { from: 'artist: true', to: 'users: true' },

  // Relation name fixes - fan/user relations
  { from: 'fan: {', to: 'users: {' },
  { from: 'fan: true', to: 'users: true' },

  // Subscription tier fixes
  { from: 'tier: {', to: 'tiers: {' },
  { from: 'tier: true', to: 'tiers: true' },

  // Campaign relation fixes
  { from: 'campaign: {', to: 'campaigns: {' },
  { from: 'campaign: true', to: 'campaigns: true' },

  // Message relation fixes
  { from: 'sender: {', to: 'users_messages_senderIdTousers: {' },
  { from: 'sender: true', to: 'users_messages_senderIdTousers: true' },

  // Property access fixes
  { from: '.artist.', to: '.users.' },
  { from: '.campaign.', to: '.campaigns.' },
  { from: '.tier.', to: '.tiers.' },
  { from: '.fan.', to: '.users.' },
  { from: '.sender.', to: '.users_messages_senderIdTousers.' },
];

function getAllFiles(dir, fileList = []) {
  const files = readdirSync(dir);

  files.forEach(file => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (extname(file) === '.ts' || extname(file) === '.tsx') {
      fileList.push(filePath);
    }
  });

  return fileList;
}

function fixFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    let updatedContent = content;
    let hasChanges = false;

    // Apply all fixes
    tableFixes.forEach(fix => {
      const regex = new RegExp(fix.from.replace(/[.*+?^${}()|[\\]\\]/g, '\\\\$&'), 'g');
      if (updatedContent.includes(fix.from)) {
        updatedContent = updatedContent.replace(regex, fix.to);
        hasChanges = true;
      }
    });

    // Write back if changes were made
    if (hasChanges) {
      writeFileSync(filePath, updatedContent);
      console.log(`✅ Fixed: ${filePath}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message);
    return false;
  }
}

// Main execution
console.log('🔧 Starting Prisma type fixes...');

const projectRoot = process.cwd();
const srcDir = join(projectRoot, 'src');

if (!statSync(srcDir).isDirectory()) {
  console.error('❌ src directory not found');
  process.exit(1);
}

const allFiles = getAllFiles(srcDir);
const apiFiles = allFiles.filter(file => file.includes('/api/'));

console.log(`📁 Found ${apiFiles.length} API files to check`);

let fixedCount = 0;
apiFiles.forEach(file => {
  if (fixFile(file)) {
    fixedCount++;
  }
});

console.log(`\\n✅ Completed! Fixed ${fixedCount} files`);
console.log('📋 Run npm run type-check to verify fixes');
