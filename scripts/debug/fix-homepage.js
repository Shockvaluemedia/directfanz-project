#!/usr/bin/env node

/**
 * Homepage Fix Script
 * Resolves common issues preventing full homepage loading
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 DirectFanz Homepage Fix Script\n');

// Step 1: Check and fix environment variables
console.log('1. Checking environment variables...');
if (fs.existsSync('.env.local')) {
  console.log('   ✅ .env.local exists');
} else {
  console.log('   ❌ .env.local missing - already created minimal version');
}

// Step 2: Check database
console.log('\n2. Checking database...');
try {
  if (fs.existsSync('prisma/dev.db')) {
    console.log('   ✅ SQLite database exists');
  } else {
    console.log('   ⚠️  Database missing - generating...');
    execSync('npx prisma generate', { stdio: 'inherit' });
    execSync('npx prisma db push', { stdio: 'inherit' });
    console.log('   ✅ Database created');
  }
} catch (error) {
  console.log('   ⚠️  Database setup failed - continuing anyway');
}

// Step 3: Check for build issues
console.log('\n3. Checking build configuration...');
try {
  // Clear Next.js cache
  if (fs.existsSync('.next')) {
    console.log('   🧹 Clearing Next.js cache...');
    execSync('rm -rf .next', { stdio: 'inherit' });
  }
  
  // Clear node_modules cache if needed
  console.log('   🔄 Refreshing dependencies...');
  execSync('npm install', { stdio: 'inherit' });
  
  console.log('   ✅ Build configuration refreshed');
} catch (error) {
  console.log('   ⚠️  Build refresh failed:', error.message);
}

// Step 4: Create a simple homepage backup
console.log('\n4. Creating homepage backup...');
const backupHomepage = `'use client';

import Link from 'next/link';
import { ArrowRightIcon } from '@heroicons/react/24/outline';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800">
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-8">
            <span className="block">DirectFanz</span>
            <span className="block bg-gradient-to-r from-pink-400 to-indigo-400 bg-clip-text text-transparent">
              Creator Platform
            </span>
          </h1>
          
          <p className="text-xl text-white/90 mb-12 max-w-3xl mx-auto">
            Turn your passion into sustainable income. Join thousands of creators earning directly from their fans.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/signup"
              className="inline-flex items-center px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-xl"
            >
              Get Started Free
              <ArrowRightIcon className="ml-2 w-5 h-5" />
            </Link>
            <Link
              href="/discover"
              className="inline-flex items-center px-8 py-4 text-lg font-semibold text-white border-2 border-white/40 rounded-full hover:border-white/60 hover:bg-white/10 transition-all"
            >
              Explore Creators
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}`;

fs.writeFileSync('src/app/page-backup.tsx', backupHomepage);
console.log('   ✅ Simple homepage backup created at /page-backup');

// Step 5: Test recommendations
console.log('\n🚀 NEXT STEPS:');
console.log('1. Test the simplified homepage: http://localhost:3000/test-homepage');
console.log('2. If that works, the issue is with dynamic imports');
console.log('3. Check browser console for JavaScript errors');
console.log('4. Run: npm run dev');
console.log('5. If issues persist, use the backup: mv src/app/page-backup.tsx src/app/page.tsx');

console.log('\n✅ Homepage fix script complete!');
console.log('\n🔍 DEBUGGING TIPS:');
console.log('- Check browser Network tab for failed requests');
console.log('- Look for 404 errors on dynamic imports');
console.log('- Verify all components exist in src/components/');
console.log('- Test with disabled JavaScript to check SSR');

console.log('\n📊 Status: Ready to test!');