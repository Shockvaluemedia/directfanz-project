#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Enum mappings to fix imports
const enumReplacements = [
  {
    pattern: /import\s*{\s*([^}]*)\s*}\s*from\s*'@prisma\/client'/g,
    replacement: (match, enums) => {
      const enumList = enums
        .split(',')
        .map(e => e.trim())
        .filter(e =>
          [
            'UserRole',
            'ContentType',
            'ContentVisibility',
            'SubscriptionStatus',
            'CampaignStatus',
            'CampaignType',
            'CampaignMetric',
            'ChallengeType',
            'ChallengeStatus',
            'SubmissionContentType',
            'RewardType',
          ].includes(e)
        );

      if (enumList.length > 0) {
        return `import { ${enumList.join(', ')} } from '@/lib/types/enums'`;
      }
      return match;
    },
  },
];

async function fixEnumImports() {
  console.log('🔧 Fixing enum imports from @prisma/client...');

  // Find all TypeScript files
  const pattern = join(projectRoot, '**/*.{ts,tsx}');
  const files = await glob(pattern, {
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/scripts/**',
      '**/lib/types/enums.ts', // Don't modify our own enum file
    ],
  });

  console.log(`📄 Found ${files.length} TypeScript files`);

  let totalChanges = 0;

  for (const filePath of files) {
    try {
      let content = readFileSync(filePath, 'utf8');
      let fileChanges = 0;
      let originalContent = content;

      // Apply enum import replacements
      for (const { pattern, replacement } of enumReplacements) {
        content = content.replace(pattern, replacement);
      }

      if (content !== originalContent) {
        writeFileSync(filePath, content, 'utf8');
        fileChanges = 1;
        console.log(`  ✅ ${filePath.replace(projectRoot, '.')} - updated enum imports`);
        totalChanges += fileChanges;
      }
    } catch (error) {
      console.error(`  ❌ Error processing ${filePath}:`, error.message);
    }
  }

  console.log(`\n🎉 Fixed enum imports in ${totalChanges} files`);
}

fixEnumImports().catch(console.error);
