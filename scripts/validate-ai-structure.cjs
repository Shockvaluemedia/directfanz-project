#!/usr/bin/env node

/**
 * AI API Structure Validation
 * Validates that all AI endpoints are properly structured and can be imported
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

// Expected AI endpoints
const expectedEndpoints = [
  {
    path: 'src/app/api/ai/route.ts',
    description: 'Main AI Agent Router',
    methods: ['GET', 'POST', 'PUT']
  },
  {
    path: 'src/app/api/ai/analytics/route.ts',
    description: 'Predictive Analytics Agent',
    methods: ['GET', 'POST']
  },
  {
    path: 'src/app/api/ai/revenue/route.ts',
    description: 'Revenue Optimization Agent',
    methods: ['GET', 'POST']
  },
  {
    path: 'src/app/api/ai/admin/route.ts',
    description: 'Admin Operations Agent',
    methods: ['GET', 'POST']
  },
  {
    path: 'src/app/api/ai/revenue-stripe/route.ts',
    description: 'Stripe Revenue Integration',
    methods: ['GET', 'POST']
  }
];

// Expected supporting files
const supportingFiles = [
  {
    path: 'src/lib/ai-content-moderation.ts',
    description: 'AI Content Moderation Service'
  },
  {
    path: 'src/lib/stripe-revenue-optimizer.ts',
    description: 'Stripe Revenue Optimizer'
  },
  {
    path: 'src/components/admin/AIInsightsDashboard.tsx',
    description: 'AI Insights Dashboard Component'
  },
  {
    path: 'src/components/analytics/SearchAnalytics.tsx',
    description: 'Enhanced Search Analytics with AI'
  }
];

function checkFileExists(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  return fs.existsSync(fullPath);
}

function analyzeRouteFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  
  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    
    const foundMethods = [];
    if (content.includes('export async function GET')) foundMethods.push('GET');
    if (content.includes('export async function POST')) foundMethods.push('POST');
    if (content.includes('export async function PUT')) foundMethods.push('PUT');
    if (content.includes('export async function DELETE')) foundMethods.push('DELETE');
    
    const hasAuth = content.includes('getServerSession') || content.includes('auth');
    const hasErrorHandling = content.includes('try') && content.includes('catch');
    const hasValidation = content.includes('NextResponse.json') && content.includes('status:');
    
    return {
      exists: true,
      methods: foundMethods,
      hasAuth,
      hasErrorHandling,
      hasValidation,
      lineCount: content.split('\n').length
    };
  } catch (error) {
    return {
      exists: false,
      error: error.message
    };
  }
}

function validateAIStructure() {
  log('🔍 DirectFanZ AI Structure Validation', 'magenta');
  log('=' .repeat(50), 'blue');
  
  const results = [];
  let totalScore = 0;
  let maxScore = 0;
  
  // Check API endpoints
  log('\n📡 Validating AI API Endpoints:', 'cyan');
  
  expectedEndpoints.forEach(endpoint => {
    log(`\n🔹 ${endpoint.description}`, 'blue');
    log(`   Path: ${endpoint.path}`, 'cyan');
    
    const analysis = analyzeRouteFile(endpoint.path);
    maxScore += 10;
    
    if (analysis.exists) {
      log('   ✅ File exists', 'green');
      totalScore += 2;
      
      // Check methods
      const foundMethods = analysis.methods;
      const expectedMethods = endpoint.methods;
      const methodsMatch = expectedMethods.every(method => foundMethods.includes(method));
      
      if (methodsMatch) {
        log(`   ✅ HTTP Methods: ${foundMethods.join(', ')}`, 'green');
        totalScore += 2;
      } else {
        log(`   ⚠️  HTTP Methods: ${foundMethods.join(', ')} (expected: ${expectedMethods.join(', ')})`, 'yellow');
        totalScore += 1;
      }
      
      // Check security
      if (analysis.hasAuth) {
        log('   ✅ Authentication implemented', 'green');
        totalScore += 2;
      } else {
        log('   ❌ Authentication missing', 'red');
      }
      
      // Check error handling
      if (analysis.hasErrorHandling) {
        log('   ✅ Error handling implemented', 'green');
        totalScore += 2;
      } else {
        log('   ❌ Error handling missing', 'red');
      }
      
      // Check validation
      if (analysis.hasValidation) {
        log('   ✅ Response validation implemented', 'green');
        totalScore += 2;
      } else {
        log('   ❌ Response validation missing', 'red');
      }
      
      log(`   📏 Lines of code: ${analysis.lineCount}`, 'cyan');
      
    } else {
      log('   ❌ File does not exist', 'red');
      if (analysis.error) {
        log(`   💥 Error: ${analysis.error}`, 'red');
      }
    }
  });
  
  // Check supporting files
  log('\n🔧 Validating Supporting Files:', 'cyan');
  
  supportingFiles.forEach(file => {
    log(`\n🔹 ${file.description}`, 'blue');
    log(`   Path: ${file.path}`, 'cyan');
    maxScore += 5;
    
    if (checkFileExists(file.path)) {
      log('   ✅ File exists', 'green');
      totalScore += 5;
      
      // Check file size
      const fullPath = path.join(process.cwd(), file.path);
      const stats = fs.statSync(fullPath);
      const sizeKB = Math.round(stats.size / 1024);
      log(`   📏 File size: ${sizeKB} KB`, 'cyan');
      
    } else {
      log('   ❌ File does not exist', 'red');
    }
  });
  
  // Check database schema updates
  log('\n🗄️  Validating Database Schema:', 'cyan');
  maxScore += 10;
  
  const schemaPath = 'prisma/schema.prisma';
  if (checkFileExists(schemaPath)) {
    const schemaContent = fs.readFileSync(path.join(process.cwd(), schemaPath), 'utf-8');
    
    const hasAIModels = [
      'moderation_logs',
      'price_optimizations', 
      'ai_agent_logs'
    ].every(model => schemaContent.includes(model));
    
    if (hasAIModels) {
      log('   ✅ AI-related database models present', 'green');
      totalScore += 10;
    } else {
      log('   ❌ Some AI database models missing', 'red');
      totalScore += 5;
    }
    
    // Check for AI-related fields in content model
    const hasAIFields = ['status', 'metadata', 'reviewedAt'].every(field => 
      schemaContent.includes(field)
    );
    
    if (hasAIFields) {
      log('   ✅ Content model has AI-related fields', 'green');
    } else {
      log('   ⚠️  Some AI-related fields may be missing from content model', 'yellow');
    }
    
  } else {
    log('   ❌ Prisma schema not found', 'red');
  }
  
  // Check environment configuration
  log('\n⚙️  Validating Environment Configuration:', 'cyan');
  maxScore += 5;
  
  const envExamplePath = '.env.example';
  if (checkFileExists(envExamplePath)) {
    const envContent = fs.readFileSync(path.join(process.cwd(), envExamplePath), 'utf-8');
    
    const hasAIVars = ['OPENAI_API_KEY', 'OPENAI_MODEL'].every(varName => 
      envContent.includes(varName)
    );
    
    if (hasAIVars) {
      log('   ✅ AI environment variables documented', 'green');
      totalScore += 5;
    } else {
      log('   ❌ AI environment variables missing from .env.example', 'red');
    }
  } else {
    log('   ❌ .env.example file not found', 'red');
  }
  
  // Final score
  log('\n📊 Validation Results:', 'magenta');
  log('=' .repeat(50), 'blue');
  
  const percentage = Math.round((totalScore / maxScore) * 100);
  log(`Score: ${totalScore}/${maxScore} (${percentage}%)`, 'cyan');
  
  if (percentage >= 90) {
    log('🎉 Excellent! AI structure is well implemented', 'green');
    log('✨ Ready for integration testing and deployment', 'cyan');
  } else if (percentage >= 75) {
    log('👍 Good! AI structure is mostly complete', 'green');
    log('🔧 Minor improvements recommended before deployment', 'yellow');
  } else if (percentage >= 50) {
    log('⚠️  Fair. AI structure needs some work', 'yellow');
    log('🛠️  Several components need attention before deployment', 'yellow');
  } else {
    log('❌ Poor. AI structure is incomplete', 'red');
    log('🚧 Significant work needed before deployment', 'red');
  }
  
  // Recommendations
  log('\n💡 Recommendations:', 'cyan');
  
  if (percentage < 100) {
    log('1. Ensure all AI endpoints are properly implemented', 'yellow');
    log('2. Add missing authentication and error handling', 'yellow');
    log('3. Complete database schema updates', 'yellow');
    log('4. Update environment configuration', 'yellow');
  }
  
  log('5. Run integration tests with a live server', 'cyan');
  log('6. Test with real OpenAI API keys', 'cyan');
  log('7. Validate with actual user authentication', 'cyan');
  
  return percentage >= 75 ? 0 : 1;
}

// Run validation if script is executed directly
if (require.main === module) {
  const exitCode = validateAIStructure();
  process.exit(exitCode);
}

module.exports = { validateAIStructure };