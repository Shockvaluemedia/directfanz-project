#!/usr/bin/env node

/**
 * Deployment Readiness Validation
 * Final check to ensure everything is ready for production deployment
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

const deploymentChecks = [
  {
    category: 'Documentation',
    checks: [
      { file: 'DEPLOYMENT_GUIDE.md', description: 'Production deployment guide' },
      { file: 'ENVIRONMENT_CONFIG.md', description: 'Environment configuration guide' },
      { file: 'README.md', description: 'Project documentation' }
    ]
  },
  {
    category: 'Configuration Files',
    checks: [
      { file: '.env.example', description: 'Environment variables template' },
      { file: 'package.json', description: 'Project dependencies and scripts' },
      { file: 'prisma/schema.prisma', description: 'Database schema' }
    ]
  },
  {
    category: 'AI Features',
    checks: [
      { file: 'src/app/api/ai/route.ts', description: 'Main AI router' },
      { file: 'src/app/api/ai/analytics/route.ts', description: 'Predictive analytics API' },
      { file: 'src/app/api/ai/revenue/route.ts', description: 'Revenue optimization API' },
      { file: 'src/app/api/ai/admin/route.ts', description: 'Admin operations API' },
      { file: 'src/components/admin/AIInsightsDashboard.tsx', description: 'AI dashboard component' }
    ]
  },
  {
    category: 'Validation Scripts',
    checks: [
      { file: 'scripts/validate-environment.cjs', description: 'Environment validation' },
      { file: 'scripts/validate-ai-structure.cjs', description: 'AI structure validation' },
      { file: 'scripts/validate-frontend-integration.cjs', description: 'Frontend integration validation' }
    ]
  }
];

function checkFileExists(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  return fs.existsSync(fullPath);
}

function getFileSize(filePath) {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    const stats = fs.statSync(fullPath);
    return Math.round(stats.size / 1024); // KB
  } catch (error) {
    return 0;
  }
}

function validatePackageJson() {
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    
    const requiredScripts = [
      'build',
      'start', 
      'validate:env',
      'validate:ai-structure',
      'validate:frontend'
    ];
    
    const aiDependencies = [
      'lucide-react',
      'recharts',
      '@radix-ui/react-tabs',
      '@radix-ui/react-progress'
    ];
    
    const missingScripts = requiredScripts.filter(script => !packageJson.scripts[script]);
    const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const missingDeps = aiDependencies.filter(dep => !allDeps[dep]);
    
    return {
      hasRequiredScripts: missingScripts.length === 0,
      missingScripts,
      hasAIDependencies: missingDeps.length === 0,
      missingDeps
    };
  } catch (error) {
    return {
      hasRequiredScripts: false,
      error: error.message
    };
  }
}

function validateDeploymentReadiness() {
  log('🚀 DirectFanZ Deployment Readiness Validation', 'magenta');
  log('=' .repeat(60), 'blue');
  
  let totalScore = 0;
  let maxScore = 0;
  let criticalIssues = [];
  let warnings = [];
  
  // Check all required files
  deploymentChecks.forEach(category => {
    log(`\n📂 ${category.category}:`, 'cyan');
    maxScore += category.checks.length * 5;
    
    category.checks.forEach(check => {
      const exists = checkFileExists(check.file);
      const size = getFileSize(check.file);
      
      if (exists) {
        log(`   ✅ ${check.file} (${size} KB) - ${check.description}`, 'green');
        totalScore += 5;
      } else {
        log(`   ❌ ${check.file} - Missing: ${check.description}`, 'red');
        criticalIssues.push(`Missing ${check.file}`);
      }
    });
  });
  
  // Validate package.json
  log('\n📦 Package Configuration:', 'cyan');
  maxScore += 20;
  
  const packageValidation = validatePackageJson();
  if (packageValidation.hasRequiredScripts) {
    log('   ✅ All required npm scripts present', 'green');
    totalScore += 10;
  } else {
    log(`   ❌ Missing scripts: ${packageValidation.missingScripts?.join(', ')}`, 'red');
    criticalIssues.push('Missing required npm scripts');
    totalScore += 5;
  }
  
  if (packageValidation.hasAIDependencies) {
    log('   ✅ All AI dependencies installed', 'green');
    totalScore += 10;
  } else {
    log(`   ❌ Missing dependencies: ${packageValidation.missingDeps?.join(', ')}`, 'red');
    criticalIssues.push('Missing AI dependencies');
    totalScore += 5;
  }
  
  // Database migration check
  log('\n🗄️  Database:', 'cyan');
  maxScore += 10;
  
  const migrationDir = 'prisma/migrations';
  if (checkFileExists(migrationDir)) {
    log('   ✅ Database migrations directory exists', 'green');
    totalScore += 5;
    
    try {
      const migrations = fs.readdirSync(path.join(process.cwd(), migrationDir));
      const aiMigration = migrations.find(m => m.includes('ai') || m.includes('20250923'));
      
      if (aiMigration) {
        log(`   ✅ AI migration found: ${aiMigration}`, 'green');
        totalScore += 5;
      } else {
        log('   ⚠️  No AI-specific migration found', 'yellow');
        warnings.push('AI migration may be missing');
        totalScore += 3;
      }
    } catch (error) {
      log('   ❌ Cannot read migrations directory', 'red');
      totalScore += 2;
    }
  } else {
    log('   ❌ Database migrations directory missing', 'red');
    criticalIssues.push('Missing database migrations');
  }
  
  // Build readiness check
  log('\n🔨 Build Readiness:', 'cyan');
  maxScore += 15;
  
  const buildFiles = [
    'next.config.js',
    'tsconfig.json'
  ];
  
  // Check for tailwind config (can be .js or .ts)
  const tailwindExists = checkFileExists('tailwind.config.js') || checkFileExists('tailwind.config.ts');
  
  buildFiles.forEach(file => {
    if (checkFileExists(file)) {
      log(`   ✅ ${file} present`, 'green');
      totalScore += 5;
    } else {
      log(`   ❌ ${file} missing`, 'red');
      criticalIssues.push(`Missing ${file}`);
    }
  });
  
  // Check tailwind config separately
  if (tailwindExists) {
    const tailwindFile = checkFileExists('tailwind.config.js') ? 'tailwind.config.js' : 'tailwind.config.ts';
    log(`   ✅ ${tailwindFile} present`, 'green');
    totalScore += 5;
  } else {
    log(`   ❌ tailwind.config.js/ts missing`, 'red');
    criticalIssues.push('Missing tailwind.config.js/ts');
  }
  
  // Security check
  log('\n🔒 Security:', 'cyan');
  maxScore += 10;
  
  if (checkFileExists('.env.example')) {
    try {
      const envExample = fs.readFileSync(path.join(process.cwd(), '.env.example'), 'utf-8');
      const hasSecrets = [
        'JWT_SECRET',
        'NEXTAUTH_SECRET', 
        'STRIPE_SECRET_KEY',
        'OPENAI_API_KEY'
      ].every(secret => envExample.includes(secret));
      
      if (hasSecrets) {
        log('   ✅ All required secrets documented in .env.example', 'green');
        totalScore += 5;
      } else {
        log('   ❌ Some secrets missing from .env.example', 'red');
        warnings.push('Incomplete .env.example');
        totalScore += 3;
      }
      
      // Check if actual .env exists (should not in production)
      if (checkFileExists('.env')) {
        log('   ⚠️  .env file exists (ensure secrets are properly configured)', 'yellow');
        warnings.push('.env file present - verify production secrets');
        totalScore += 3;
      } else {
        log('   ✅ No .env file in repository (good for security)', 'green');
        totalScore += 2;
      }
    } catch (error) {
      log('   ❌ Cannot validate environment configuration', 'red');
      totalScore += 1;
    }
  }
  
  // Final assessment
  const percentage = Math.round((totalScore / maxScore) * 100);
  
  log('\n📊 Deployment Readiness Assessment:', 'magenta');
  log('=' .repeat(60), 'blue');
  log(`Score: ${totalScore}/${maxScore} (${percentage}%)`, 'cyan');
  
  if (percentage >= 95) {
    log('🎉 EXCELLENT! Ready for production deployment', 'green');
    log('✨ All systems are go! You can deploy with confidence', 'cyan');
  } else if (percentage >= 85) {
    log('👍 GOOD! Almost ready for production deployment', 'green');
    log('🔧 Minor issues to address before deployment', 'yellow');
  } else if (percentage >= 70) {
    log('⚠️  FAIR! Some preparation needed before deployment', 'yellow');
    log('🛠️  Address issues before production deployment', 'yellow');
  } else {
    log('❌ NOT READY! Significant work needed before deployment', 'red');
    log('🚧 Complete missing components before deploying', 'red');
  }
  
  // Issues summary
  if (criticalIssues.length > 0) {
    log('\n🔴 Critical Issues to Address:', 'red');
    criticalIssues.forEach(issue => log(`   • ${issue}`, 'red'));
  }
  
  if (warnings.length > 0) {
    log('\n⚠️  Warnings to Consider:', 'yellow');
    warnings.forEach(warning => log(`   • ${warning}`, 'yellow'));
  }
  
  // Recommendations
  log('\n💡 Deployment Recommendations:', 'cyan');
  
  if (percentage >= 85) {
    log('1. ✅ Run final integration tests in staging environment', 'cyan');
    log('2. ✅ Verify all environment variables in production', 'cyan');
    log('3. ✅ Test AI features with real API keys', 'cyan');
    log('4. ✅ Monitor system after deployment', 'cyan');
  } else {
    log('1. 🔧 Address critical issues listed above', 'yellow');
    log('2. 🔧 Run all validation scripts successfully', 'yellow');
    log('3. 🔧 Complete missing documentation', 'yellow');
    log('4. 🔧 Re-run this validation after fixes', 'yellow');
  }
  
  log('\n📚 Next Steps:', 'blue');
  log('1. Review deployment guides in DEPLOYMENT_GUIDE.md', 'blue');
  log('2. Configure environment variables per ENVIRONMENT_CONFIG.md', 'blue');
  log('3. Run: npm run validate:env', 'blue');
  log('4. Run: npm run validate:ai-structure', 'blue');
  log('5. Run: npm run validate:frontend', 'blue');
  log('6. Deploy to staging environment first', 'blue');
  log('7. Deploy to production when all validations pass', 'blue');
  
  return percentage >= 85 ? 0 : 1;
}

// Run validation if script is executed directly
if (require.main === module) {
  const exitCode = validateDeploymentReadiness();
  process.exit(exitCode);
}

module.exports = { validateDeploymentReadiness };