#!/usr/bin/env node

/**
 * Quick Fix Script for Major Schema Relationship Issues
 * 
 * This script fixes the most common database relationship mismatches
 * that are preventing the app from building.
 */

console.log('🔧 Starting schema relationship fixes...');

// Common relationship mapping fixes
const RELATIONSHIP_FIXES = [
  // campaigns.artist -> campaigns.users
  {
    pattern: /\.artist\s*:/g,
    replacement: '.users:',
    description: 'campaigns.artist -> campaigns.users'
  },
  {
    pattern: /campaigns\.artist\./g,
    replacement: 'campaigns.users.',
    description: 'campaign.artist.* -> campaign.users.*'
  },
  {
    pattern: /campaign\.artist\./g,
    replacement: 'campaign.users.',
    description: 'campaign.artist.* -> campaign.users.*'
  },
  
  // challenge -> challenges
  {
    pattern: /\.challenge\s*:/g,
    replacement: '.challenges:',
    description: 'challenge -> challenges'
  },
  {
    pattern: /\.challenge\./g,
    replacement: '.challenges.',
    description: 'relation.challenge.* -> relation.challenges.*'
  },
  
  // submitter -> users (for challenge_submissions)
  {
    pattern: /submitter\s*:/g,
    replacement: 'users:',
    description: 'submitter -> users relationship'
  },
  {
    pattern: /\.submitter\./g,
    replacement: '.users.',
    description: 'submission.submitter.* -> submission.users.*'
  },
  
  // tier -> tiers
  {
    pattern: /\.tier\s*:/g,
    replacement: '.tiers:',
    description: 'tier -> tiers relationship'
  },
  
  // sender -> users (for messages)
  {
    pattern: /\.sender\s*:/g,
    replacement: '.users:',
    description: 'sender -> users relationship'
  },
  {
    pattern: /\.sender\./g,
    replacement: '.users.',
    description: 'message.sender.* -> message.users.*'
  },
  
  // fan -> users
  {
    pattern: /\.fan\s*:/g,
    replacement: '.users:',
    description: 'fan -> users relationship'
  },
  {
    pattern: /\.fan\./g,
    replacement: '.users.',
    description: 'relation.fan.* -> relation.users.*'
  },
  
  // user -> users (when it should be users)
  {
    pattern: /\.user\s*:/g,
    replacement: '.users:',
    description: 'user -> users relationship'
  },
  
  // artists -> users (when referring to user relationship)
  {
    pattern: /\.artists\s*:/g,
    replacement: '.users:',
    description: 'artists -> users relationship (when not referring to artists table)'
  },
  
  // Fix common property access issues
  {
    pattern: /\.submissions\./g,
    replacement: '.challenge_submissions.',
    description: 'submissions -> challenge_submissions'
  },
  
  // Fix wrong table names
  {
    pattern: /prisma\.liveStream\./g,
    replacement: 'prisma.live_streams.',
    description: 'liveStream -> live_streams table name'
  }
];

// Files to process (API routes that are most likely to have these issues)
function findFilesToFix() {
  const apiDir = path.join(process.cwd(), 'src/app/api');
  const files = [];
  
  function walkDir(dir) {
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          walkDir(fullPath);
        } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
          files.push(fullPath);
        }
      }
    } catch (err) {
      console.warn(`Warning: Could not read directory ${dir}:`, err.message);
    }
  }
  
  walkDir(apiDir);
  return files;
}

function applyFixes() {
  const files = findFilesToFix();
  console.log(`Found ${files.length} TypeScript files to check...`);
  
  let totalFixes = 0;
  
  for (const filePath of files) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      let fileFixCount = 0;
      
      for (const fix of RELATIONSHIP_FIXES) {
        const matches = content.match(fix.pattern);
        if (matches) {
          content = content.replace(fix.pattern, fix.replacement);
          fileFixCount += matches.length;
        }
      }
      
      if (fileFixCount > 0) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Fixed ${fileFixCount} issues in ${path.relative(process.cwd(), filePath)}`);
        totalFixes += fileFixCount;
      }
    } catch (err) {
      console.error(`❌ Error processing ${filePath}:`, err.message);
    }
  }
  
  return totalFixes;
}

// Remove import/export errors for missing enums
function fixMissingEnums() {
  console.log('🔧 Fixing missing enum imports...');
  
  const files = findFilesToFix();
  
  for (const filePath of files) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      let changed = false;
      
      // Remove problematic enum imports that don't exist
      const problematicImports = [
        'SubmissionContentType',
        'SubscriptionStatus',
        'RewardType'
      ];
      
      for (const enumName of problematicImports) {
        const importRegex = new RegExp(`\\s*,?\\s*${enumName}\\s*,?`, 'g');
        if (content.includes(enumName)) {
          // Replace with string literals where used
          content = content.replace(new RegExp(`\\b${enumName}\\b`, 'g'), 'string');
          
          // Remove from imports
          content = content.replace(importRegex, '');
          changed = true;
        }
      }
      
      if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Fixed enum imports in ${path.relative(process.cwd(), filePath)}`);
      }
    } catch (err) {
      console.error(`❌ Error fixing enums in ${filePath}:`, err.message);
    }
  }
}

// Main execution
try {
  console.log('📊 Analyzing codebase for relationship issues...');
  
  const totalFixes = applyFixes();
  
  console.log('🔧 Fixing missing enum issues...');
  fixMissingEnums();
  
  console.log(`\n🎉 Applied ${totalFixes} relationship fixes!`);
  
  if (totalFixes > 0) {
    console.log('\n🔄 Regenerating Prisma client...');
    try {
      execSync('npm run db:generate', { stdio: 'inherit' });
      console.log('✅ Prisma client regenerated successfully!');
    } catch (err) {
      console.error('❌ Error regenerating Prisma client:', err.message);
    }
    
    console.log('\n🧪 Running type check to verify fixes...');
    try {
      execSync('npm run type-check', { stdio: 'pipe' });
      console.log('✅ Type check passed! Issues have been resolved.');
    } catch (err) {
      console.log('⚠️  Some type issues may remain. Check the output above.');
      console.log('The main relationship issues have been fixed, but you may need to address remaining type mismatches.');
    }
    
    console.log('\n📝 Next steps:');
    console.log('1. Run: npm run type-check');
    console.log('2. Fix any remaining type errors');
    console.log('3. Test your app locally: npm run dev');
    console.log('4. Deploy: git add . && git commit -m "fix: resolve database relationship issues" && git push');
  }
  
} catch (err) {
  console.error('❌ Script failed:', err.message);
  process.exit(1);
}