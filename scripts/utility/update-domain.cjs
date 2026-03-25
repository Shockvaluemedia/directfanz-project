#!/usr/bin/env node

/**
 * DirectFanz Domain Update Script
 * Updates all marketing materials and configuration files to use the new directfanz.io domain
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const NEW_DOMAIN = 'https://directfanz.io';
const NEW_WWW_DOMAIN = 'https://www.directfanz.io';
const OLD_PATTERNS = [
  /https?:\/\/localhost:3000/g,
  /https?:\/\/127\.0\.0\.1:3000/g,
  /https?:\/\/.*\.vercel\.app/g,
  /https?:\/\/nahvee-even-platform.*\.vercel\.app/g,
  /your-domain\.com/g,
  /yourdomain\.com/g,
  /your-app\.com/g,
  /yourplatform\.com/g,
  /noreply@example\.com/g,
  /support@example\.com/g,
  /admin@example\.com/g
];

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(color, prefix, message) {
  console.log(`${colors[color]}${prefix}${colors.reset} ${message}`);
}

function logInfo(message) { log('blue', '📝 UPDATE:', message); }
function logSuccess(message) { log('green', '✅ UPDATED:', message); }
function logWarning(message) { log('yellow', '⚠️  WARNING:', message); }
function logError(message) { log('red', '❌ ERROR:', message); }
function logHeader(message) { log('cyan', '🚀 DOMAIN UPDATE:', message); }

// Files to update
const filesToUpdate = [
  // Main marketing files
  { file: 'README.md', type: 'marketing' },
  { file: 'package.json', type: 'config' },
  
  // Environment files
  { file: '.env.example', type: 'config' },
  { file: '.env.local.example', type: 'config' },
  { file: '.env.production.example', type: 'config' },
  { file: '.env.monitoring.example', type: 'config' },
  
  // Configuration files
  { file: 'next.config.js', type: 'config' },
  { file: 'vercel.json', type: 'config' },
  
  // Documentation files
  { file: 'DEPLOYMENT.md', type: 'docs' },
  { file: 'DEPLOYMENT_CHECKLIST.md', type: 'docs' },
  { file: 'DOMAIN_SETUP_GUIDE.md', type: 'docs' },
  { file: 'docs/vercel-deployment.md', type: 'docs' },
  { file: 'docs/aws-s3-setup.md', type: 'docs' },
  { file: 'docs/oauth-security-setup.md', type: 'docs' },
  
  // Mobile app
  { file: 'NahveeEvenMobile/README.md', type: 'mobile' },
  { file: 'NahveeEvenMobile/package.json', type: 'mobile' },
  
  // Test files
  { file: 'signin-test.html', type: 'test' },
  { file: 'signin-test-simple.html', type: 'test' },
  { file: 'public/signin-test.html', type: 'test' },
  
  // Scripts
  { file: 'scripts/performance-test.js', type: 'scripts' },
  { file: 'scripts/smoke-test.js', type: 'scripts' },
  { file: 'scripts/security-test.js', type: 'scripts' },
  { file: 'scripts/health-check.js', type: 'scripts' },
  { file: 'scripts/load-test.js', type: 'scripts' }
];

// Replacement mappings
const replacements = [
  // Domain replacements
  { pattern: /https?:\/\/localhost:3000/g, replacement: NEW_WWW_DOMAIN },
  { pattern: /https?:\/\/127\.0\.0\.1:3000/g, replacement: NEW_WWW_DOMAIN },
  { pattern: /https?:\/\/.*nahvee-even-platform.*\.vercel\.app/g, replacement: NEW_WWW_DOMAIN },
  { pattern: /https?:\/\/.*\.vercel\.app/g, replacement: NEW_WWW_DOMAIN },
  
  // Generic domain placeholders
  { pattern: /your-domain\.com/g, replacement: 'directfanz.io' },
  { pattern: /yourdomain\.com/g, replacement: 'directfanz.io' },
  { pattern: /your-app\.com/g, replacement: 'directfanz.io' },
  { pattern: /yourplatform\.com/g, replacement: 'directfanz.io' },
  { pattern: /your-platform\.com/g, replacement: 'directfanz.io' },
  
  // Email addresses
  { pattern: /noreply@example\.com/g, replacement: 'noreply@directfanz.io' },
  { pattern: /support@example\.com/g, replacement: 'support@directfanz.io' },
  { pattern: /admin@example\.com/g, replacement: 'admin@directfanz.io' },
  { pattern: /noreply@your-domain\.com/g, replacement: 'noreply@directfanz.io' },
  { pattern: /support@your-domain\.com/g, replacement: 'support@directfanz.io' },
  { pattern: /admin@your-domain\.com/g, replacement: 'admin@directfanz.io' },
  
  // CDN and other services
  { pattern: /cdn\.your-domain\.com/g, replacement: 'cdn.directfanz.io' },
  { pattern: /api\.your-domain\.com/g, replacement: 'api.directfanz.io' },
  
  // App names and branding
  { pattern: /Direct Fan Platform/g, replacement: 'DirectFanz' },
  { pattern: /direct-fan-platform/g, replacement: 'directfanz' },
  { pattern: /Nahvee Even/g, replacement: 'DirectFanz' },
  { pattern: /nahvee-even/g, replacement: 'directfanz' },
  
  // Specific Vercel project references
  { pattern: /nahvee-even-platform/g, replacement: 'directfanz' }
];

// Special content updates
const contentUpdates = {
  'README.md': {
    title: '# DirectFanz',
    description: 'A platform that connects independent artists with their superfans through subscription-based exclusive content access.',
    repositoryName: 'directfanz',
    appUrl: NEW_WWW_DOMAIN,
    additionalUpdates: [
      { pattern: /git clone <your-repo-url>/g, replacement: 'git clone https://github.com/your-username/directfanz.git' },
      { pattern: /cd directfanz/g, replacement: 'cd directfanz' },
      { pattern: /\"directfanz\"/g, replacement: '"directfanz"' }
    ]
  },
  'package.json': {
    updates: [
      { pattern: /"name": ".*?"/g, replacement: '"name": "directfanz"' },
      { pattern: /"version": "0\.1\.0"/g, replacement: '"version": "1.0.0"' }
    ]
  }
};

function updateFile(filePath, type) {
  try {
    if (!fs.existsSync(filePath)) {
      logWarning(`File not found: ${filePath}`);
      return false;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    let updated = false;
    
    // Apply general replacements
    for (const { pattern, replacement } of replacements) {
      if (pattern.test(content)) {
        content = content.replace(pattern, replacement);
        updated = true;
      }
    }
    
    // Apply specific content updates
    const fileName = path.basename(filePath);
    if (contentUpdates[fileName]) {
      const fileUpdates = contentUpdates[fileName];
      
      // Apply specific updates for this file
      if (fileUpdates.updates) {
        for (const { pattern, replacement } of fileUpdates.updates) {
          if (pattern.test(content)) {
            content = content.replace(pattern, replacement);
            updated = true;
          }
        }
      }
      
      if (fileUpdates.additionalUpdates) {
        for (const { pattern, replacement } of fileUpdates.additionalUpdates) {
          if (pattern.test(content)) {
            content = content.replace(pattern, replacement);
            updated = true;
          }
        }
      }
    }
    
    // Write back if updated
    if (updated) {
      fs.writeFileSync(filePath, content, 'utf8');
      logSuccess(`Updated ${filePath} (${type})`);
      return true;
    } else {
      logInfo(`No changes needed for ${filePath}`);
      return false;
    }
    
  } catch (error) {
    logError(`Failed to update ${filePath}: ${error.message}`);
    return false;
  }
}

function createMarketingAssets() {
  logHeader('Creating marketing assets...');
  
  // Create a marketing landing page summary
  const marketingContent = `# 🚀 DirectFanz is Live!

## 🌐 Official Website
**https://directfanz.io**

## ✨ What is DirectFanz?
DirectFanz is the premier platform connecting independent artists with their superfans through subscription-based exclusive content access.

### 🎯 Key Features:
- **Artist Dashboard**: Create subscription tiers, upload exclusive content, track earnings
- **Fan Experience**: Discover artists, flexible subscription pricing, access exclusive content  
- **Secure Payments**: Stripe integration with daily payouts
- **Community Features**: Comments, notifications, and fan interactions

### 🛡️ Enterprise-Grade Security:
- ✅ SSL/TLS encryption
- ✅ PCI DSS compliant payments
- ✅ SOC 2 Type II security standards
- ✅ Advanced fraud protection

### ⚡ Performance Optimized:
- ✅ Global CDN distribution
- ✅ Edge caching
- ✅ Real-time streaming
- ✅ Mobile-first design

## 🎉 Ready for Artists & Fans
DirectFanz.io is now live and ready to serve the creative community!

### For Artists:
- Launch your subscription tiers
- Upload exclusive content
- Build your fanbase
- Monetize your creativity

### For Fans:
- Discover amazing artists
- Get exclusive access
- Support your favorites
- Join the community

---
**Visit https://directfanz.io to get started!**
`;

  fs.writeFileSync('DIRECTFANZ_LIVE.md', marketingContent, 'utf8');
  logSuccess('Created marketing summary: DIRECTFANZ_LIVE.md');

  // Create a social media announcement template
  const socialContent = `# 🎉 DirectFanz Social Media Kit

## 📱 Launch Announcement Templates

### Twitter/X:
\`\`\`
🎉 DirectFanz is LIVE! 🚀

The platform that connects artists with superfans through exclusive content subscriptions.

✨ For Artists: Monetize your creativity
🎯 For Fans: Access exclusive content
🛡️ Secure payments via Stripe

Join the community: https://directfanz.io

#DirectFanz #ArtistsSupport #CreatorEconomy #Launch
\`\`\`

### Instagram Caption:
\`\`\`
🎨 Introducing DirectFanz - Where Artists Meet Their Superfans! 🌟

After months of development, we're thrilled to announce that DirectFanz.io is officially LIVE! 

💫 What makes us special:
• Direct artist-to-fan connections
• Subscription-based exclusive content
• Secure payments with instant payouts
• Mobile-optimized experience

Whether you're an artist looking to monetize your passion or a fan seeking exclusive access to your favorites, DirectFanz is built for you.

🔗 Start your journey: directfanz.io

#DirectFanz #CreatorPlatform #ArtistSupport #Launch #CreatorEconomy
\`\`\`

### LinkedIn Post:
\`\`\`
🚀 Excited to announce the official launch of DirectFanz!

DirectFanz.io is a subscription-based platform connecting independent artists with their most dedicated fans through exclusive content access.

🎯 Key features:
- Artist dashboard with subscription tier management
- Secure payment processing via Stripe
- Real-time fan engagement tools
- Enterprise-grade security and performance

Built with Next.js, powered by cutting-edge technology, and designed with both artists and fans in mind.

Ready to transform how creators monetize their work and connect with their audience.

Visit: https://directfanz.io

#CreatorEconomy #TechLaunch #ArtistPlatform #Entrepreneurship
\`\`\`

## 🎨 Brand Guidelines

### Primary Domain: https://directfanz.io
### Primary Colors: (Add your brand colors here)
### Logo: (Add logo file references here)
### Tagline: "Where Artists Meet Their Superfans"

## 📊 Launch Metrics to Track:
- [ ] Website visits
- [ ] Artist sign-ups
- [ ] Fan registrations  
- [ ] Subscription conversions
- [ ] Social media engagement

---
**#DirectFanzLive #CreatorPlatform #Launch2025**
`;

  fs.writeFileSync('SOCIAL_MEDIA_KIT.md', socialContent, 'utf8');
  logSuccess('Created social media kit: SOCIAL_MEDIA_KIT.md');
}

function updateConfigFiles() {
  logHeader('Updating configuration files...');
  
  // Update vercel.json if it exists
  const vercelConfigPath = 'vercel.json';
  if (fs.existsSync(vercelConfigPath)) {
    try {
      const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));
      
      // Update domains in vercel config
      if (vercelConfig.domains) {
        vercelConfig.domains = vercelConfig.domains.map(domain => {
          if (domain.includes('vercel.app') || domain.includes('localhost')) {
            return 'directfanz.io';
          }
          return domain;
        });
      } else {
        vercelConfig.domains = ['directfanz.io', 'www.directfanz.io'];
      }
      
      // Update redirects
      if (!vercelConfig.redirects) {
        vercelConfig.redirects = [];
      }
      
      // Add www redirect if not exists
      const hasWwwRedirect = vercelConfig.redirects.some(r => r.source === '/');
      if (!hasWwwRedirect) {
        vercelConfig.redirects.unshift({
          "source": "/(.*)",
          "has": [{ "type": "host", "value": "directfanz.io" }],
          "destination": "https://www.directfanz.io/$1",
          "permanent": true
        });
      }
      
      fs.writeFileSync(vercelConfigPath, JSON.stringify(vercelConfig, null, 2), 'utf8');
      logSuccess('Updated vercel.json with new domain configuration');
    } catch (error) {
      logError(`Failed to update vercel.json: ${error.message}`);
    }
  }
}

// Main execution
async function main() {
  console.log('\n🚀 DirectFanz Domain Update Script');
  console.log('=====================================\n');
  
  logHeader('Starting domain update process...');
  logInfo(`New domain: ${NEW_DOMAIN}`);
  logInfo(`New WWW domain: ${NEW_WWW_DOMAIN}\n`);
  
  let updatedCount = 0;
  let totalFiles = 0;
  
  // Update all specified files
  for (const { file, type } of filesToUpdate) {
    totalFiles++;
    if (updateFile(file, type)) {
      updatedCount++;
    }
  }
  
  // Update configuration files
  updateConfigFiles();
  
  // Create marketing assets
  createMarketingAssets();
  
  // Summary
  console.log('\n' + '='.repeat(50));
  logHeader('Domain update completed!');
  logSuccess(`Updated ${updatedCount} out of ${totalFiles} files`);
  
  if (updatedCount > 0) {
    console.log('\n📝 Files updated with new domain:');
    console.log(`   • Domain: ${NEW_DOMAIN}`);
    console.log(`   • WWW: ${NEW_WWW_DOMAIN}`);
    console.log(`   • Email: noreply@directfanz.io`);
    console.log(`   • Support: support@directfanz.io`);
  }
  
  console.log('\n🎉 Marketing materials created:');
  console.log('   • DIRECTFANZ_LIVE.md - Launch announcement');
  console.log('   • SOCIAL_MEDIA_KIT.md - Social media templates');
  
  console.log('\n💡 Next steps:');
  console.log('   • Review updated files for accuracy');
  console.log('   • Update social media profiles');
  console.log('   • Share launch announcements');
  console.log('   • Monitor analytics and engagement');
  console.log('   • Update business cards/marketing materials');
  
  console.log('\n🚀 DirectFanz.io is ready to launch! 🎉\n');
}

// Handle interruption
process.on('SIGINT', () => {
  console.log('\n🛑 Domain update interrupted by user');
  process.exit(130);
});

// Run the update
if (require.main === module) {
  main().catch(error => {
    logError(`Domain update failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { main, updateFile, replacements };