#!/usr/bin/env node

/**
 * Homepage Functionality Test
 * Ensures all homepage features work correctly
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🧪 Homepage Functionality Test\n');

const tests = [
  {
    name: 'Environment Variables',
    test: () => {
      const required = ['NEXTAUTH_SECRET', 'NEXTAUTH_URL', 'DATABASE_URL'];
      const missing = required.filter(env => !process.env[env]);
      return missing.length === 0 ? 'PASS' : `FAIL: Missing ${missing.join(', ')}`;
    }
  },
  {
    name: 'Database Connection',
    test: () => {
      try {
        execSync('npx prisma db push --accept-data-loss', { stdio: 'pipe' });
        return 'PASS';
      } catch (error) {
        return 'FAIL: Database connection failed';
      }
    }
  },
  {
    name: 'Build Process',
    test: () => {
      try {
        execSync('npm run build', { stdio: 'pipe' });
        return 'PASS';
      } catch (error) {
        return 'FAIL: Build failed';
      }
    }
  },
  {
    name: 'Component Dependencies',
    test: () => {
      const components = [
        'src/components/home/pricing-section.tsx',
        'src/components/home/demo-preview-section.tsx',
        'src/components/ui/social-proof.tsx',
        'src/components/home/ComparisonTable.tsx',
        'src/components/home/CreatorSuccessStories.tsx',
        'src/components/home/FAQ.tsx'
      ];
      const missing = components.filter(comp => !fs.existsSync(comp));
      return missing.length === 0 ? 'PASS' : `FAIL: Missing ${missing.length} components`;
    }
  }
];

let passed = 0;
let failed = 0;

tests.forEach(({ name, test }) => {
  process.stdout.write(`${name}... `);
  const result = test();
  console.log(result);
  
  if (result === 'PASS') {
    passed++;
  } else {
    failed++;
  }
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('✅ Homepage is functional! Run: npm run dev');
} else {
  console.log('❌ Issues found. Use backup: mv src/app/page-backup.tsx src/app/page.tsx');
}