#!/bin/bash

# Secrets Management Setup Script for DirectFanz
# This script sets up proper environment variable and secrets management

echo "🔐 Setting up secrets management for DirectFanz..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create secure permissions for environment files
echo "🛡️ Securing environment files..."

# Set restrictive permissions on sensitive files
chmod 600 .env* 2>/dev/null
chmod 600 .env.local.save 2>/dev/null
chmod 600 .env.production.secrets 2>/dev/null

# Check for potential secrets in committed files
echo "🔍 Scanning for potential secrets in repository..."
SECRETS_FOUND=false

# List of patterns that might indicate secrets
SECRET_PATTERNS=(
    "password="
    "secret="
    "key="
    "token="
    "api_key="
    "private_key"
    "aws_access_key"
    "stripe_secret"
    "jwt_secret"
    "database_url.*://"
)

for pattern in "${SECRET_PATTERNS[@]}"; do
    if git log --all --full-history --grep="$pattern" -i | grep -q "$pattern"; then
        echo -e "${RED}⚠️  Found potential secret in git history: $pattern${NC}"
        SECRETS_FOUND=true
    fi
done

# Check current files for hardcoded secrets
echo "🔎 Checking current files for hardcoded secrets..."
find . -type f \( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" -o -name "*.json" \) \
    -not -path "./node_modules/*" \
    -not -path "./.next/*" \
    -not -path "./.git/*" \
    -exec grep -l "password\|secret\|key.*=" {} \; 2>/dev/null | while read file; do
    echo -e "${YELLOW}⚠️  Check file for hardcoded secrets: $file${NC}"
done

# Validate .env files structure
echo "📋 Validating environment files..."

ENV_FILES=(.env .env.local .env.production)
for env_file in "${ENV_FILES[@]}"; do
    if [[ -f "$env_file" ]]; then
        echo "✅ Found: $env_file"
        # Check if file contains actual values (not just examples)
        if grep -q "=.*[^=]$" "$env_file"; then
            echo -e "${GREEN}  - Contains configured values${NC}"
        else
            echo -e "${YELLOW}  - Appears to be template/example${NC}"
        fi
    fi
done

# Create secrets validation script
echo "📝 Creating secrets validation script..."
cat > scripts/validate-secrets.js << 'EOF'
#!/usr/bin/env node

// Secrets Validation Script
const fs = require('fs');
const path = require('path');

const requiredSecrets = {
  production: [
    'NEXTAUTH_SECRET',
    'JWT_SECRET',
    'DATABASE_URL',
    'REDIS_URL',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'STRIPE_SECRET_KEY',
    'SENDGRID_API_KEY'
  ],
  development: [
    'NEXTAUTH_SECRET',
    'DATABASE_URL'
  ]
};

function validateEnvFile(filePath, environment) {
  console.log(`🔍 Validating ${filePath} for ${environment}...`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ ${filePath} not found`);
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const envVars = {};
  
  content.split('\n').forEach(line => {
    const [key, value] = line.split('=', 2);
    if (key && value && !key.startsWith('#')) {
      envVars[key.trim()] = value.trim();
    }
  });

  const required = requiredSecrets[environment] || [];
  const missing = required.filter(key => !envVars[key] || envVars[key] === '');
  
  if (missing.length > 0) {
    console.log(`❌ Missing required secrets: ${missing.join(', ')}`);
    return false;
  }

  // Check for weak secrets
  const weakSecrets = [];
  Object.entries(envVars).forEach(([key, value]) => {
    if (key.toLowerCase().includes('secret') || key.toLowerCase().includes('key')) {
      if (value.length < 32) {
        weakSecrets.push(key);
      }
    }
  });

  if (weakSecrets.length > 0) {
    console.log(`⚠️  Potentially weak secrets (< 32 chars): ${weakSecrets.join(', ')}`);
  }

  console.log(`✅ ${filePath} validation complete`);
  return missing.length === 0;
}

// Validate environment files
const isProduction = process.env.NODE_ENV === 'production';
const environment = isProduction ? 'production' : 'development';

if (isProduction) {
  validateEnvFile('.env.production', 'production');
} else {
  validateEnvFile('.env', 'development');
  validateEnvFile('.env.local', 'development');
}

EOF

chmod +x scripts/validate-secrets.js

# Create environment file backup script
echo "💾 Creating environment backup script..."
cat > scripts/backup-env-files.sh << 'EOF'
#!/bin/bash

# Environment Files Backup Script
BACKUP_DIR="backups/env-files"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

mkdir -p "$BACKUP_DIR"

echo "📦 Backing up environment files..."

# Backup all .env files (excluding examples)
for file in .env*; do
    if [[ -f "$file" && ! "$file" =~ \.example$ ]]; then
        cp "$file" "$BACKUP_DIR/${file}.${TIMESTAMP}"
        echo "✅ Backed up: $file"
    fi
done

# Encrypt sensitive backups
if command -v gpg &> /dev/null; then
    echo "🔐 Encrypting sensitive backups..."
    for file in "$BACKUP_DIR"/*.production.*; do
        if [[ -f "$file" ]]; then
            gpg --symmetric --cipher-algo AES256 "$file"
            rm "$file"  # Remove unencrypted version
            echo "🔒 Encrypted: $(basename "$file")"
        fi
    done
fi

echo "✅ Environment files backed up to $BACKUP_DIR"
EOF

chmod +x scripts/backup-env-files.sh

# Create .env.vault template for production secrets
echo "🏛️ Creating .env.vault template..."
cat > .env.vault.template << 'EOF'
# Environment Variables Vault Template
# This file should be encrypted and stored securely
# Use this template to manage production secrets

# Core Application Secrets
NEXTAUTH_SECRET=
JWT_SECRET=
ENCRYPTION_KEY=

# Database Configuration
DATABASE_URL=
REDIS_URL=
REDIS_PASSWORD=

# AWS Configuration
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET_NAME=
AWS_REGION=

# Payment Processing
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Email Service
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=

# Monitoring & Logging
SENTRY_DSN=
SENTRY_AUTH_TOKEN=

# Third-party APIs
OPENAI_API_KEY=
CLOUDFLARE_API_TOKEN=

EOF

# Create secrets rotation reminder
echo "🔄 Creating secrets rotation schedule..."
cat > SECRETS_ROTATION_SCHEDULE.md << 'EOF'
# Secrets Rotation Schedule

## Critical Secrets (Rotate every 90 days)
- [ ] `NEXTAUTH_SECRET` - Last rotated: ___
- [ ] `JWT_SECRET` - Last rotated: ___
- [ ] `STRIPE_SECRET_KEY` - Last rotated: ___
- [ ] `AWS_SECRET_ACCESS_KEY` - Last rotated: ___

## Important Secrets (Rotate every 180 days)  
- [ ] `REDIS_PASSWORD` - Last rotated: ___
- [ ] `SENDGRID_API_KEY` - Last rotated: ___
- [ ] `SENTRY_AUTH_TOKEN` - Last rotated: ___

## API Keys (Rotate every 365 days)
- [ ] `OPENAI_API_KEY` - Last rotated: ___
- [ ] `CLOUDFLARE_API_TOKEN` - Last rotated: ___

## Rotation Procedures
1. Generate new secret/key in the service
2. Update environment variables in all environments
3. Test application functionality
4. Revoke old secret/key
5. Update rotation date above

## Emergency Rotation
If a secret is compromised:
1. Immediately rotate the secret
2. Check access logs for unauthorized usage
3. Update all environments within 1 hour
4. Document the incident

EOF

echo -e "${GREEN}✅ Secrets management setup complete!${NC}"
echo ""
echo "📋 Next steps:"
echo "1. Run: npm run validate:secrets"
echo "2. Set up proper production secrets management (AWS Secrets Manager/HashiCorp Vault)"
echo "3. Configure environment variable injection in CI/CD"
echo "4. Set up secrets rotation calendar reminders"
echo "5. Review and clean up any hardcoded secrets found above"

if [[ "$SECRETS_FOUND" == true ]]; then
    echo ""
    echo -e "${RED}⚠️  IMPORTANT: Potential secrets found in git history!${NC}"
    echo "Consider using BFG Repo-Cleaner or git-filter-repo to clean history:"
    echo "  git filter-repo --path-glob '**/.env*' --invert-paths"
fi