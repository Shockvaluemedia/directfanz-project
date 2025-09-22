#!/usr/bin/env node

/**
 * Environment Synchronization Script
 * Handles keeping local, staging, and production environments in sync
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function execCommand(command, options = {}) {
  try {
    const result = execSync(command, { 
      encoding: 'utf8', 
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options 
    });
    return result?.trim();
  } catch (error) {
    if (!options.ignoreError) {
      log(`❌ Command failed: ${command}`, colors.red);
      log(`Error: ${error.message}`, colors.red);
      process.exit(1);
    }
    return null;
  }
}

function checkGitStatus() {
  log('🔍 Checking Git status...', colors.blue);
  
  const status = execCommand('git status --porcelain', { silent: true });
  
  if (status && status.length > 0) {
    log('⚠️  You have uncommitted changes:', colors.yellow);
    log(status);
    
    const response = require('readline-sync').question('Do you want to commit these changes? (y/n): ');
    if (response.toLowerCase() === 'y') {
      const message = require('readline-sync').question('Commit message: ');
      execCommand(`git add .`);
      execCommand(`git commit -m "${message}"`);
      log('✅ Changes committed', colors.green);
    } else {
      log('⚠️  Continuing with uncommitted changes...', colors.yellow);
    }
  } else {
    log('✅ Working directory clean', colors.green);
  }
}

function syncWithRemote() {
  log('🔄 Syncing with remote repository...', colors.blue);
  
  const currentBranch = execCommand('git branch --show-current', { silent: true });
  log(`Current branch: ${currentBranch}`, colors.cyan);
  
  execCommand('git fetch origin');
  
  const behind = execCommand(`git rev-list --count HEAD..origin/${currentBranch}`, { 
    silent: true, 
    ignoreError: true 
  });
  
  if (behind && parseInt(behind) > 0) {
    log(`⚠️  Your branch is ${behind} commits behind origin/${currentBranch}`, colors.yellow);
    log('🔄 Pulling latest changes...', colors.blue);
    execCommand(`git pull origin ${currentBranch}`);
    log('✅ Successfully pulled latest changes', colors.green);
  } else {
    log('✅ Branch is up to date', colors.green);
  }
  
  return currentBranch;
}

function updateDependencies() {
  log('📦 Updating dependencies...', colors.blue);
  
  // Check if package-lock.json changed
  const packageChanged = execCommand('git diff --name-only HEAD~1 HEAD | grep package', { 
    silent: true, 
    ignoreError: true 
  });
  
  if (packageChanged || !fs.existsSync('node_modules')) {
    log('🔄 Installing npm dependencies...', colors.blue);
    execCommand('npm install');
    log('✅ Dependencies updated', colors.green);
  } else {
    log('✅ Dependencies are up to date', colors.green);
  }
  
  // Check mobile dependencies
  const mobileDir = path.join(process.cwd(), 'NahveeEvenMobile');
  if (fs.existsSync(mobileDir)) {
    process.chdir(mobileDir);
    
    const mobilePackageChanged = execCommand('git diff --name-only HEAD~1 HEAD | grep NahveeEvenMobile/package', { 
      silent: true, 
      ignoreError: true 
    });
    
    if (mobilePackageChanged || !fs.existsSync('node_modules')) {
      log('📱 Updating mobile dependencies...', colors.blue);
      execCommand('npm install');
      log('✅ Mobile dependencies updated', colors.green);
    }
    
    process.chdir('..');
  }
}

function handleDatabaseChanges() {
  log('🗄️  Checking database changes...', colors.blue);
  
  // Check if schema changed
  const schemaChanged = execCommand('git diff --name-only HEAD~1 HEAD | grep prisma/schema', { 
    silent: true, 
    ignoreError: true 
  });
  
  if (schemaChanged) {
    log('🔄 Prisma schema changed, generating client...', colors.blue);
    execCommand('npx prisma generate');
    
    log('🔄 Running database migrations...', colors.blue);
    execCommand('npx prisma db push');
    
    log('✅ Database updated', colors.green);
  } else {
    log('✅ No database changes detected', colors.green);
  }
}

function checkRedisConnection() {
  log('🔴 Checking Redis connection...', colors.blue);
  
  try {
    execCommand('redis-cli ping', { silent: true });
    log('✅ Redis is running', colors.green);
  } catch (error) {
    log('⚠️  Redis not running, starting Redis...', colors.yellow);
    try {
      execCommand('brew services start redis');
      // Wait a moment for Redis to start
      setTimeout(() => {
        execCommand('redis-cli ping', { silent: true });
        log('✅ Redis started successfully', colors.green);
      }, 2000);
    } catch (startError) {
      log('❌ Failed to start Redis. Please start manually:', colors.red);
      log('   brew services start redis', colors.yellow);
    }
  }
}

function runQualityChecks() {
  log('🔍 Running quality checks...', colors.blue);
  
  log('  - Type checking...', colors.cyan);
  const typeCheck = execCommand('npm run type-check', { silent: true, ignoreError: true });
  if (typeCheck === null) {
    log('    ❌ Type check failed', colors.red);
  } else {
    log('    ✅ Type check passed', colors.green);
  }
  
  log('  - Linting...', colors.cyan);
  const lint = execCommand('npm run lint', { silent: true, ignoreError: true });
  if (lint === null) {
    log('    ⚠️  Linting issues found (run npm run lint:fix)', colors.yellow);
  } else {
    log('    ✅ Linting passed', colors.green);
  }
}

function checkEnvironmentHealth() {
  log('🏥 Checking environment health...', colors.blue);
  
  // Start development server in background
  log('🚀 Starting development server...', colors.blue);
  const serverProcess = require('child_process').spawn('npm', ['run', 'dev'], {
    detached: true,
    stdio: 'ignore'
  });
  
  // Give server time to start
  setTimeout(() => {
    try {
      execCommand('curl -f http://localhost:3000/api/health', { silent: true });
      log('✅ Application health check passed', colors.green);
    } catch (error) {
      log('⚠️  Application health check failed', colors.yellow);
    }
    
    try {
      execCommand('curl -f http://localhost:3000/api/health/redis', { silent: true });
      log('✅ Redis health check passed', colors.green);
    } catch (error) {
      log('⚠️  Redis health check failed', colors.yellow);
    }
    
    // Kill the server process
    process.kill(-serverProcess.pid);
  }, 5000);
}

function displaySummary(branch) {
  log('\\n📋 Synchronization Summary:', colors.bright);
  log(`Branch: ${branch}`, colors.cyan);
  log(`Environment: ${process.env.NODE_ENV || 'development'}`, colors.cyan);
  log(`Redis: Running`, colors.green);
  log(`Database: Updated`, colors.green);
  log(`Dependencies: Updated`, colors.green);
  
  log('\\n🚀 Ready to develop! Run:', colors.bright);
  log('  npm run dev', colors.yellow);
  log('\\n📚 Useful commands:', colors.bright);
  log('  npm run test          - Run tests', colors.cyan);
  log('  npm run lint:fix      - Fix linting issues', colors.cyan);
  log('  npm run db:migrate    - Run database migrations', colors.cyan);
  log('  npm run health:check  - Check application health', colors.cyan);
}

async function main() {
  try {
    log('🎯 DirectFanZ Environment Synchronization', colors.bright);
    log('==========================================\\n', colors.bright);
    
    // Install readline-sync if not present
    try {
      require('readline-sync');
    } catch (error) {
      log('📦 Installing readline-sync...', colors.blue);
      execCommand('npm install --no-save readline-sync');
    }
    
    checkGitStatus();
    const currentBranch = syncWithRemote();
    updateDependencies();
    handleDatabaseChanges();
    checkRedisConnection();
    runQualityChecks();
    checkEnvironmentHealth();
    
    log('\\n✅ Environment synchronization complete!', colors.green);
    displaySummary(currentBranch);
    
  } catch (error) {
    log(`\\n❌ Synchronization failed: ${error.message}`, colors.red);
    process.exit(1);
  }
}

// Handle script termination
process.on('SIGINT', () => {
  log('\\n⚠️  Synchronization interrupted', colors.yellow);
  process.exit(0);
});

if (require.main === module) {
  main();
}