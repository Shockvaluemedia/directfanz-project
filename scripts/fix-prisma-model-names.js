#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Model name mappings from camelCase to snake_case
const modelMappings = {
  'prisma.user.': 'prisma.users.',
  'prisma.artist.': 'prisma.artists.',
  'prisma.tier.': 'prisma.tiers.',
  'prisma.subscription.': 'prisma.subscriptions.',
  'prisma.comment.': 'prisma.comments.',
  'prisma.message.': 'prisma.messages.',
  'prisma.account.': 'prisma.accounts.',
  'prisma.session.': 'prisma.sessions.',
  'prisma.invoice.': 'prisma.invoices.',
  'prisma.campaign.': 'prisma.campaigns.',
  'prisma.challenge.': 'prisma.challenges.',
  'prisma.contentView.': 'prisma.content_views.',
  'prisma.challengeSubmission.': 'prisma.challenge_submissions.',
  'prisma.challengeParticipation.': 'prisma.challenge_participations.',
  'prisma.campaignReward.': 'prisma.campaign_rewards.',
  'prisma.oAuthToken.': 'prisma.oauth_tokens.',
};

async function fixPrismaModelNames() {
  console.log('🔧 Fixing Prisma model names in API routes...');

  // Find all TypeScript files in src/app/api
  const pattern = join(projectRoot, 'src/app/api/**/*.ts');
  const files = await glob(pattern, { ignore: ['**/node_modules/**'] });

  console.log(`📄 Found ${files.length} API route files`);

  let totalChanges = 0;

  for (const filePath of files) {
    try {
      let content = readFileSync(filePath, 'utf8');
      let fileChanges = 0;

      // Apply all model name mappings
      for (const [oldName, newName] of Object.entries(modelMappings)) {
        const regex = new RegExp(oldName.replace('.', '\\.'), 'g');
        const matches = content.match(regex);
        if (matches) {
          content = content.replace(regex, newName);
          fileChanges += matches.length;
        }
      }

      if (fileChanges > 0) {
        writeFileSync(filePath, content, 'utf8');
        console.log(`  ✅ ${filePath.replace(projectRoot, '.')} - ${fileChanges} changes`);
        totalChanges += fileChanges;
      }
    } catch (error) {
      console.error(`  ❌ Error processing ${filePath}:`, error.message);
    }
  }

  console.log(`\n🎉 Fixed ${totalChanges} Prisma model references across ${files.length} files`);
}

fixPrismaModelNames().catch(console.error);
