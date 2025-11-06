#!/usr/bin/env node

/**
 * Frontend Component Integration Validation
 * Validates that all new AI components can be imported and integrated properly
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

// New AI-related components
const aiComponents = [
  {
    path: 'src/components/admin/AIInsightsDashboard.tsx',
    name: 'AIInsightsDashboard',
    description: 'AI Insights Dashboard',
    expectedProps: ['className'],
    dependencies: ['react', 'lucide-react']
  },
  {
    path: 'src/components/analytics/SearchAnalytics.tsx',
    name: 'SearchAnalytics',  
    description: 'Enhanced Search Analytics',
    expectedProps: ['analyticsData'],
    dependencies: ['react', 'recharts']
  }
];

// Pages that should integrate with AI components
const integrationTargets = [
  {
    path: 'src/app/admin/dashboard/page.tsx',
    description: 'Admin Dashboard Page',
    shouldInclude: ['AIInsightsDashboard']
  },
  {
    path: 'src/app/analytics/page.tsx', 
    description: 'Analytics Page',
    shouldInclude: ['SearchAnalytics']
  },
  {
    path: 'src/app/dashboard/page.tsx',
    description: 'Main Dashboard Page',
    shouldInclude: ['SearchAnalytics'] 
  }
];

function checkFileExists(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  return fs.existsSync(fullPath);
}

function analyzeComponent(componentInfo) {
  const fullPath = path.join(process.cwd(), componentInfo.path);
  
  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    
    // Check for React component structure
    const isReactComponent = content.includes('React') && 
                            (content.includes('function') || content.includes('const')) &&
                            content.includes('export');
    
    // Check for TypeScript
    const isTypeScript = componentInfo.path.endsWith('.tsx') || componentInfo.path.endsWith('.ts');
    
    // Check for proper exports
    const hasDefaultExport = content.includes('export default');
    const hasNamedExport = content.includes(`export`) && content.includes(componentInfo.name);
    
    // Check for props interface/type
    const hasPropsInterface = content.includes('interface') || content.includes('type') || content.includes('Props');
    
    // Check dependencies
    const foundDependencies = [];
    componentInfo.dependencies.forEach(dep => {
      if (content.includes(`from '${dep}'`) || content.includes(`from "${dep}"`)) {
        foundDependencies.push(dep);
      }
    });
    
    // Check for common hooks
    const usesHooks = ['useState', 'useEffect', 'useCallback', 'useMemo'].filter(hook => 
      content.includes(hook)
    );
    
    // Check for error boundaries/handling
    const hasErrorHandling = content.includes('try') && content.includes('catch');
    
    return {
      exists: true,
      isReactComponent,
      isTypeScript,
      hasDefaultExport,
      hasNamedExport,
      hasPropsInterface,
      foundDependencies,
      missingDependencies: componentInfo.dependencies.filter(dep => !foundDependencies.includes(dep)),
      usesHooks,
      hasErrorHandling,
      lineCount: content.split('\n').length,
      size: Math.round(fs.statSync(fullPath).size / 1024)
    };
    
  } catch (error) {
    return {
      exists: false,
      error: error.message
    };
  }
}

function analyzeIntegration(targetInfo) {
  const fullPath = path.join(process.cwd(), targetInfo.path);
  
  try {
    if (!fs.existsSync(fullPath)) {
      return {
        exists: false,
        reason: 'File does not exist'
      };
    }
    
    const content = fs.readFileSync(fullPath, 'utf-8');
    
    const integrations = [];
    const missing = [];
    
    targetInfo.shouldInclude.forEach(componentName => {
      // Check if component is imported
      const hasImport = content.includes(`import`) && content.includes(componentName);
      
      // Check if component is used in JSX
      const hasUsage = content.includes(`<${componentName}`) || content.includes(`{${componentName}}`);
      
      if (hasImport && hasUsage) {
        integrations.push({
          component: componentName,
          imported: true,
          used: true,
          status: 'integrated'
        });
      } else if (hasImport) {
        integrations.push({
          component: componentName, 
          imported: true,
          used: false,
          status: 'imported_only'
        });
      } else {
        missing.push(componentName);
      }
    });
    
    return {
      exists: true,
      integrations,
      missing,
      lineCount: content.split('\n').length,
      isTypeScript: fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')
    };
    
  } catch (error) {
    return {
      exists: false,
      error: error.message
    };
  }
}

function validateFrontendIntegration() {
  log('🎨 DirectFanZ Frontend Integration Validation', 'magenta');
  log('=' .repeat(50), 'blue');
  
  let totalScore = 0;
  let maxScore = 0;
  
  // Validate AI Components
  log('\n🧩 Validating AI Components:', 'cyan');
  
  aiComponents.forEach(component => {
    log(`\n🔹 ${component.description}`, 'blue');
    log(`   Path: ${component.path}`, 'cyan');
    log(`   Component: ${component.name}`, 'cyan');
    
    const analysis = analyzeComponent(component);
    maxScore += 15;
    
    if (analysis.exists) {
      log('   ✅ File exists', 'green');
      totalScore += 2;
      
      if (analysis.isReactComponent) {
        log('   ✅ Valid React component structure', 'green');
        totalScore += 3;
      } else {
        log('   ❌ Invalid React component structure', 'red');
      }
      
      if (analysis.isTypeScript) {
        log('   ✅ TypeScript component', 'green');
        totalScore += 2;
      } else {
        log('   ⚠️  JavaScript component (TypeScript recommended)', 'yellow');
        totalScore += 1;
      }
      
      if (analysis.hasDefaultExport) {
        log('   ✅ Has default export', 'green');
        totalScore += 2;
      } else {
        log('   ❌ Missing default export', 'red');
      }
      
      if (analysis.hasPropsInterface) {
        log('   ✅ Has props interface/type definition', 'green');
        totalScore += 2;
      } else {
        log('   ⚠️  No props interface found (recommended)', 'yellow');
        totalScore += 1;
      }
      
      // Dependencies check
      if (analysis.missingDependencies.length === 0) {
        log(`   ✅ All dependencies found: ${analysis.foundDependencies.join(', ')}`, 'green');
        totalScore += 2;
      } else {
        log(`   ❌ Missing dependencies: ${analysis.missingDependencies.join(', ')}`, 'red');
        log(`   ✅ Found dependencies: ${analysis.foundDependencies.join(', ')}`, 'green');
        totalScore += 1;
      }
      
      if (analysis.usesHooks.length > 0) {
        log(`   ✅ Uses React hooks: ${analysis.usesHooks.join(', ')}`, 'green');
        totalScore += 1;
      }
      
      if (analysis.hasErrorHandling) {
        log('   ✅ Has error handling', 'green');
        totalScore += 1;
      } else {
        log('   ⚠️  No error handling found', 'yellow');
      }
      
      log(`   📏 Component size: ${analysis.size} KB, ${analysis.lineCount} lines`, 'cyan');
      
    } else {
      log('   ❌ File does not exist', 'red');
      if (analysis.error) {
        log(`   💥 Error: ${analysis.error}`, 'red');
      }
    }
  });
  
  // Validate Integration with existing pages
  log('\n🔌 Validating Component Integration:', 'cyan');
  
  integrationTargets.forEach(target => {
    log(`\n🔹 ${target.description}`, 'blue');
    log(`   Path: ${target.path}`, 'cyan');
    
    const analysis = analyzeIntegration(target);
    maxScore += 10;
    
    if (analysis.exists) {
      log('   ✅ Target file exists', 'green');
      totalScore += 2;
      
      if (analysis.isTypeScript) {
        log('   ✅ TypeScript file', 'green');
        totalScore += 1;
      }
      
      // Check integration status
      const fullyIntegrated = analysis.integrations.filter(i => i.status === 'integrated');
      const partiallyIntegrated = analysis.integrations.filter(i => i.status === 'imported_only');
      
      if (fullyIntegrated.length > 0) {
        log(`   ✅ Integrated components: ${fullyIntegrated.map(i => i.component).join(', ')}`, 'green');
        totalScore += 4;
      }
      
      if (partiallyIntegrated.length > 0) {
        log(`   ⚠️  Imported but not used: ${partiallyIntegrated.map(i => i.component).join(', ')}`, 'yellow');
        totalScore += 2;
      }
      
      if (analysis.missing.length > 0) {
        log(`   ❌ Missing components: ${analysis.missing.join(', ')}`, 'red');
        totalScore += 1;
      } else {
        log('   ✅ All expected components integrated', 'green');
        totalScore += 3;
      }
      
      log(`   📏 File size: ${analysis.lineCount} lines`, 'cyan');
      
    } else {
      log('   ❌ Target file does not exist', 'red');
      if (analysis.error) {
        log(`   💥 Error: ${analysis.error}`, 'red');
      }
    }
  });
  
  // Check for UI component dependencies
  log('\n📚 Validating UI Dependencies:', 'cyan');
  maxScore += 10;
  
  const uiDependencies = [
    '@radix-ui/react-tabs',
    '@radix-ui/react-progress',
    'lucide-react',
    'recharts'
  ];
  
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    const foundDeps = [];
    const missingDeps = [];
    
    uiDependencies.forEach(dep => {
      if (allDeps[dep]) {
        foundDeps.push(`${dep}@${allDeps[dep]}`);
      } else {
        missingDeps.push(dep);
      }
    });
    
    if (missingDeps.length === 0) {
      log('   ✅ All UI dependencies available', 'green');
      log(`   📦 Found: ${foundDeps.join(', ')}`, 'cyan');
      totalScore += 10;
    } else {
      log(`   ❌ Missing UI dependencies: ${missingDeps.join(', ')}`, 'red');
      log(`   📦 Found: ${foundDeps.join(', ')}`, 'cyan');
      totalScore += 5;
    }
  } else {
    log('   ❌ package.json not found', 'red');
  }
  
  // Final score and recommendations
  log('\n📊 Integration Results:', 'magenta');
  log('=' .repeat(50), 'blue');
  
  const percentage = Math.round((totalScore / maxScore) * 100);
  log(`Score: ${totalScore}/${maxScore} (${percentage}%)`, 'cyan');
  
  if (percentage >= 90) {
    log('🎉 Excellent! Frontend integration is complete', 'green');
    log('✨ Components are ready for production use', 'cyan');
  } else if (percentage >= 75) {
    log('👍 Good! Frontend integration is mostly complete', 'green');
    log('🔧 Minor improvements needed', 'yellow');
  } else if (percentage >= 50) {
    log('⚠️  Fair. Frontend integration needs work', 'yellow');
    log('🛠️  Several components need attention', 'yellow');
  } else {
    log('❌ Poor. Frontend integration is incomplete', 'red');
    log('🚧 Significant work needed', 'red');
  }
  
  // Specific recommendations
  log('\n💡 Next Steps:', 'cyan');
  
  if (percentage < 100) {
    log('1. Complete component integration in target pages', 'yellow');
    log('2. Add missing TypeScript interfaces', 'yellow');
    log('3. Install missing UI dependencies', 'yellow');
    log('4. Add error handling to components', 'yellow');
  }
  
  log('5. Test components in development environment', 'cyan');
  log('6. Verify responsive design on different screen sizes', 'cyan');
  log('7. Test component performance with real data', 'cyan');
  log('8. Add unit tests for components', 'cyan');
  
  return percentage >= 75 ? 0 : 1;
}

// Run validation if script is executed directly
if (require.main === module) {
  const exitCode = validateFrontendIntegration();
  process.exit(exitCode);
}

module.exports = { validateFrontendIntegration };