#!/usr/bin/env node

/**
 * Homepage Debug Script
 * Identifies common issues preventing full homepage rendering
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 DirectFanz Homepage Debug Analysis\n');

// Check 1: Verify all dynamically imported components exist
const dynamicImports = [
  'src/components/home/pricing-section.tsx',
  'src/components/home/demo-preview-section.tsx', 
  'src/components/ui/social-proof.tsx',
  'src/components/home/ComparisonTable.tsx',
  'src/components/home/CreatorSuccessStories.tsx',
  'src/components/home/FAQ.tsx'
];

console.log('1. Checking Dynamic Import Components:');
dynamicImports.forEach(component => {
  const exists = fs.existsSync(path.join(__dirname, component));
  console.log(`   ${exists ? '✅' : '❌'} ${component}`);
  
  if (!exists) {
    console.log(`   🚨 MISSING: ${component} - This will cause homepage sections to fail`);
  }
});

// Check 2: Verify main page structure
console.log('\n2. Checking Main Page Structure:');
const mainPage = path.join(__dirname, 'src/app/page.tsx');
if (fs.existsSync(mainPage)) {
  console.log('   ✅ src/app/page.tsx exists');
  const content = fs.readFileSync(mainPage, 'utf8');
  
  // Check for common issues
  const issues = [];
  
  if (!content.includes("'use client'")) {
    issues.push('Missing "use client" directive');
  }
  
  if (!content.includes('export default function')) {
    issues.push('Missing default export');
  }
  
  if (content.includes('throw new Error') || content.includes('throw Error')) {
    issues.push('Contains error throwing code');
  }
  
  if (issues.length > 0) {
    console.log('   🚨 Issues found:');
    issues.forEach(issue => console.log(`      - ${issue}`));
  } else {
    console.log('   ✅ Page structure looks good');
  }
} else {
  console.log('   ❌ src/app/page.tsx missing');
}

// Check 3: Layout issues
console.log('\n3. Checking Layout Configuration:');
const layout = path.join(__dirname, 'src/app/layout.tsx');
if (fs.existsSync(layout)) {
  console.log('   ✅ src/app/layout.tsx exists');
  const content = fs.readFileSync(layout, 'utf8');
  
  if (content.includes('ErrorBoundary')) {
    console.log('   ✅ ErrorBoundary is configured');
  } else {
    console.log('   ⚠️  No ErrorBoundary found - errors might crash the page');
  }
} else {
  console.log('   ❌ src/app/layout.tsx missing');
}

// Check 4: CSS and styling
console.log('\n4. Checking CSS Configuration:');
const globalCSS = path.join(__dirname, 'src/app/globals.css');
const tailwindConfig = path.join(__dirname, 'tailwind.config.ts');

if (fs.existsSync(globalCSS)) {
  console.log('   ✅ globals.css exists');
} else {
  console.log('   ❌ globals.css missing - styling will be broken');
}

if (fs.existsSync(tailwindConfig)) {
  console.log('   ✅ tailwind.config.ts exists');
} else {
  console.log('   ❌ tailwind.config.ts missing - Tailwind classes won\'t work');
}

// Check 5: Next.js configuration
console.log('\n5. Checking Next.js Configuration:');
const nextConfig = path.join(__dirname, 'next.config.js');
if (fs.existsSync(nextConfig)) {
  console.log('   ✅ next.config.js exists');
  const content = fs.readFileSync(nextConfig, 'utf8');
  
  if (content.includes('ignoreBuildErrors: true')) {
    console.log('   ⚠️  TypeScript errors are being ignored - might hide real issues');
  }
  
  if (content.includes('eslint: { ignoreDuringBuilds: true }')) {
    console.log('   ⚠️  ESLint errors are being ignored - might hide real issues');
  }
} else {
  console.log('   ❌ next.config.js missing');
}

console.log('\n🔧 RECOMMENDED FIXES:\n');

// Generate fixes based on findings
const fixes = [];

dynamicImports.forEach(component => {
  if (!fs.existsSync(path.join(__dirname, component))) {
    fixes.push(`Create missing component: ${component}`);
  }
});

if (fixes.length === 0) {
  console.log('✅ All components exist. The issue might be:');
  console.log('   1. JavaScript runtime errors (check browser console)');
  console.log('   2. Network issues loading dynamic imports');
  console.log('   3. Environment variables missing');
  console.log('   4. Build/deployment configuration issues');
  console.log('\n🚀 Next steps:');
  console.log('   1. Check browser console for JavaScript errors');
  console.log('   2. Verify all environment variables are set');
  console.log('   3. Test with a simplified homepage version');
} else {
  fixes.forEach((fix, i) => console.log(`   ${i + 1}. ${fix}`));
}

console.log('\n📊 Debug complete!');