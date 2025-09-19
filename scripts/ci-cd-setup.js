#!/usr/bin/env node

/**
 * CI/CD Pipeline Setup Script
 * Automates the creation and configuration of CI/CD pipelines
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function question(query) {
  return new Promise(resolve => {
    rl.question(query, resolve);
  });
}

// GitHub Actions workflow templates
const githubActionsWorkflows = {
  'ci.yml': `name: CI Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

env:
  NODE_VERSION: '18'
  REGISTRY: ghcr.io
  IMAGE_NAME: \${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: testdb
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: \${{ env.NODE_VERSION }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linting
      run: npm run lint
    
    - name: Generate Prisma client
      run: npx prisma generate
    
    - name: Run database migrations
      run: npx prisma migrate deploy
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/testdb
    
    - name: Run unit tests
      run: npm run test:coverage
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/testdb
        REDIS_URL: redis://localhost:6379
        NEXTAUTH_SECRET: test-secret
        NEXTAUTH_URL: http://localhost:3000
    
    - name: Run security checks
      run: npm run security:check
    
    - name: Build application
      run: npm run build
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/testdb
        REDIS_URL: redis://localhost:6379
        NEXTAUTH_SECRET: test-secret
        NEXTAUTH_URL: http://localhost:3000
    
    - name: Run E2E tests
      run: npm run test:e2e
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/testdb
        REDIS_URL: redis://localhost:6379
        NEXTAUTH_SECRET: test-secret
        NEXTAUTH_URL: http://localhost:3000
    
    - name: Upload coverage reports
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
        fail_ci_if_error: true

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    permissions:
      contents: read
      packages: write
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Log in to Container Registry
      uses: docker/login-action@v3
      with:
        registry: \${{ env.REGISTRY }}
        username: \${{ github.actor }}
        password: \${{ secrets.GITHUB_TOKEN }}
    
    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=sha,prefix={{branch}}-
          type=raw,value=latest,enable={{is_default_branch}}
    
    - name: Build and push Docker image
      uses: docker/build-push-action@v5
      with:
        context: .
        file: ./Dockerfile.production
        push: true
        tags: \${{ steps.meta.outputs.tags }}
        labels: \${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max
`,

  'deploy-production.yml': `name: Deploy to Production

on:
  push:
    branches: [ main ]
    tags: [ 'v*' ]

env:
  NODE_VERSION: '18'
  REGISTRY: ghcr.io
  IMAGE_NAME: \${{ github.repository }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: \${{ env.NODE_VERSION }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run pre-deployment checks
      run: |
        npm run security:check
        npm run test:smoke
    
    - name: Deploy to Vercel
      uses: amondnet/vercel-action@v25
      if: github.ref == 'refs/heads/main'
      with:
        vercel-token: \${{ secrets.VERCEL_TOKEN }}
        vercel-org-id: \${{ secrets.VERCEL_ORG_ID }}
        vercel-project-id: \${{ secrets.VERCEL_PROJECT_ID }}
        vercel-args: '--prod'
        working-directory: ./
    
    - name: Deploy to AWS (Alternative)
      if: false # Enable if using AWS instead of Vercel
      run: |
        npm run deploy:aws
      env:
        AWS_ACCESS_KEY_ID: \${{ secrets.AWS_ACCESS_KEY_ID }}
        AWS_SECRET_ACCESS_KEY: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
        AWS_REGION: \${{ secrets.AWS_REGION }}
    
    - name: Run post-deployment tests
      run: |
        sleep 30 # Wait for deployment to stabilize
        npm run test:integration
      env:
        APP_URL: \${{ secrets.PRODUCTION_URL }}
    
    - name: Notify deployment status
      if: always()
      uses: 8398a7/action-slack@v3
      with:
        status: \${{ job.status }}
        webhook_url: \${{ secrets.SLACK_WEBHOOK_URL }}
        fields: repo,message,commit,author,action,eventName,ref,workflow
`,

  'security-scan.yml': `name: Security Scan

on:
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  security:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run npm audit
      run: npm audit --audit-level=high
    
    - name: Run security scan
      run: npm run security:check
    
    - name: Run Snyk security scan
      uses: snyk/actions/node@master
      env:
        SNYK_TOKEN: \${{ secrets.SNYK_TOKEN }}
      with:
        args: --severity-threshold=high
    
    - name: Run CodeQL analysis
      uses: github/codeql-action/analyze@v2
      with:
        languages: javascript
    
    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        scan-type: 'fs'
        scan-ref: '.'
        format: 'sarif'
        output: 'trivy-results.sarif'
    
    - name: Upload Trivy scan results
      uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: 'trivy-results.sarif'
`,
};

// Docker deployment scripts
const dockerScripts = {
  'docker-deploy.sh': `#!/bin/bash

# Docker Production Deployment Script
set -e

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m' # No Color

# Configuration
IMAGE_NAME="direct-fan-platform"
REGISTRY="ghcr.io/yourusername"
VERSION="\${1:-latest}"
ENVIRONMENT="\${2:-production}"

echo -e "\${BLUE}🚀 Starting Docker deployment for \${IMAGE_NAME}:\${VERSION}\${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "\${RED}❌ Docker is not running. Please start Docker and try again.\${NC}"
    exit 1
fi

# Load environment variables
if [ -f ".env.production" ]; then
    echo -e "\${YELLOW}📝 Loading production environment variables...\${NC}"
    set -a
    source .env.production
    set +a
else
    echo -e "\${RED}❌ .env.production file not found. Please create it from .env.production.example\${NC}"
    exit 1
fi

# Build production image
echo -e "\${BLUE}🏗️ Building production Docker image...\${NC}"
docker build -f Dockerfile.production -t \${IMAGE_NAME}:\${VERSION} .

# Tag for registry
docker tag \${IMAGE_NAME}:\${VERSION} \${REGISTRY}/\${IMAGE_NAME}:\${VERSION}
docker tag \${IMAGE_NAME}:\${VERSION} \${REGISTRY}/\${IMAGE_NAME}:latest

# Push to registry (optional)
read -p "Push to registry? (y/n): " -n 1 -r
echo
if [[ \$REPLY =~ ^[Yy]$ ]]; then
    echo -e "\${BLUE}📤 Pushing to registry...\${NC}"
    docker push \${REGISTRY}/\${IMAGE_NAME}:\${VERSION}
    docker push \${REGISTRY}/\${IMAGE_NAME}:latest
fi

# Stop existing containers
echo -e "\${YELLOW}🛑 Stopping existing containers...\${NC}"
docker-compose -f docker-compose.production.yml down || true

# Start new deployment
echo -e "\${GREEN}🚀 Starting new deployment...\${NC}"
docker-compose -f docker-compose.production.yml up -d

# Wait for services to be ready
echo -e "\${BLUE}⏳ Waiting for services to be ready...\${NC}"
sleep 30

# Health check
echo -e "\${BLUE}🩺 Running health checks...\${NC}"
if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    echo -e "\${GREEN}✅ Application is healthy!\${NC}"
else
    echo -e "\${RED}❌ Health check failed. Check logs:\${NC}"
    docker-compose -f docker-compose.production.yml logs app
    exit 1
fi

echo -e "\${GREEN}🎉 Deployment completed successfully!\${NC}"
`,

  'docker-rollback.sh': `#!/bin/bash

# Docker Rollback Script
set -e

RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m'

VERSION="\${1}"

if [ -z "\$VERSION" ]; then
    echo -e "\${RED}❌ Please specify a version to rollback to\${NC}"
    echo "Usage: ./docker-rollback.sh <version>"
    echo "Available versions:"
    docker images direct-fan-platform --format "table {{.Tag}}\\t{{.CreatedAt}}"
    exit 1
fi

echo -e "\${YELLOW}⚠️ Rolling back to version \${VERSION}\${NC}"
read -p "Are you sure? This will stop the current deployment (y/n): " -n 1 -r
echo

if [[ \$REPLY =~ ^[Yy]$ ]]; then
    # Stop current deployment
    docker-compose -f docker-compose.production.yml down
    
    # Update image version in compose file
    sed -i.bak "s/image: direct-fan-platform:.*/image: direct-fan-platform:\${VERSION}/" docker-compose.production.yml
    
    # Start rollback deployment
    docker-compose -f docker-compose.production.yml up -d
    
    # Wait and health check
    sleep 30
    if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
        echo -e "\${GREEN}✅ Rollback completed successfully!\${NC}"
        rm docker-compose.production.yml.bak
    else
        echo -e "\${RED}❌ Rollback failed. Restoring previous version...\${NC}"
        mv docker-compose.production.yml.bak docker-compose.production.yml
        docker-compose -f docker-compose.production.yml up -d
    fi
else
    echo -e "\${BLUE}Rollback cancelled.\${NC}"
fi
`,
};

async function setupCICD() {
  log('🔧 CI/CD Pipeline Setup', colors.cyan);
  log('========================', colors.cyan);

  const platform = await question(
    'Which CI/CD platform do you want to set up? (github/gitlab/jenkins): '
  );

  if (platform.toLowerCase() === 'github') {
    // Create .github/workflows directory
    const workflowsDir = '.github/workflows';
    if (!fs.existsSync(workflowsDir)) {
      fs.mkdirSync(workflowsDir, { recursive: true });
    }

    log('Creating GitHub Actions workflows...', colors.blue);

    for (const [filename, content] of Object.entries(githubActionsWorkflows)) {
      const filePath = path.join(workflowsDir, filename);
      fs.writeFileSync(filePath, content);
      log(`✅ Created ${filename}`, colors.green);
    }

    log('\\n📝 Next steps for GitHub Actions:', colors.yellow);
    log('1. Add the following secrets to your GitHub repository:', colors.yellow);
    log('   - VERCEL_TOKEN', colors.yellow);
    log('   - VERCEL_ORG_ID', colors.yellow);
    log('   - VERCEL_PROJECT_ID', colors.yellow);
    log('   - PRODUCTION_URL', colors.yellow);
    log('   - SLACK_WEBHOOK_URL (optional)', colors.yellow);
    log('   - SNYK_TOKEN (optional)', colors.yellow);
  }

  // Create Docker deployment scripts
  const scriptsDir = 'scripts';
  log('\\nCreating Docker deployment scripts...', colors.blue);

  for (const [filename, content] of Object.entries(dockerScripts)) {
    const filePath = path.join(scriptsDir, filename);
    fs.writeFileSync(filePath, content);
    fs.chmodSync(filePath, '755'); // Make executable
    log(`✅ Created ${filename}`, colors.green);
  }
}

// Main execution
async function main() {
  try {
    await setupCICD();
    log('\\n🎉 CI/CD setup completed!', colors.green);
  } catch (error) {
    log(`❌ Setup failed: ${error.message}`, colors.red);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
