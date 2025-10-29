#!/bin/bash
set -e

echo "🔧 Fixing hardcoded secrets in source code..."

# Function to safely replace patterns in files
safe_replace() {
    local file="$1"
    local pattern="$2"
    local replacement="$3"
    
    if [ -f "$file" ]; then
        echo "Fixing: $file"
        sed -i.bak "s|$pattern|$replacement|g" "$file"
        rm "$file.bak" 2>/dev/null || true
    fi
}

# Fix common hardcoded patterns
echo "Step 1: Fixing authentication and database patterns..."

# Fix any remaining hardcoded database passwords
find src/ -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | while read -r file; do
    if grep -q "Godswork" "$file" 2>/dev/null; then
        safe_replace "$file" "Godswork12!\\\$" "process.env.DATABASE_PASSWORD"
        echo "  Fixed database password in: $file"
    fi
done

# Fix hardcoded secrets in configuration files
echo "Step 2: Fixing configuration files..."

# Update any files that reference the old hardcoded secrets
find . -name "*.md" -o -name "*.txt" | while read -r file; do
    if grep -q "o5up8Woxtj0Iu0j3yBy" "$file" 2>/dev/null; then
        safe_replace "$file" "o5up8Woxtj0Iu0j3yBy+Wl5dynqiJtrmkKz8IlQJQBE=" "your-secure-nextauth-secret-here"
        echo "  Fixed NextAuth secret reference in: $file"
    fi
    
    if grep -q "126e7caccce86ff1" "$file" 2>/dev/null; then
        safe_replace "$file" "126e7caccce86ff1af33a31b6413c1278b87d656101a3530fc17d605cd23a668" "your-encryption-key-here"
        echo "  Fixed encryption key reference in: $file"
    fi
done

echo "Step 3: Checking for common insecure patterns..."

# Create a more comprehensive security check
cat > scripts/security-audit.sh << 'EOF'
#!/bin/bash

echo "🔍 Comprehensive Security Audit"
echo "=============================="

ISSUES_FOUND=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_issue() {
    echo -e "${RED}[ISSUE]${NC} $1"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_ok() {
    echo -e "${GREEN}[OK]${NC} $1"
}

echo "Checking for hardcoded secrets..."

# Check for hardcoded passwords
if grep -r -i "password.*=" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" | grep -v "process.env" | grep -v "password:" | grep -v "password'" | grep -v 'password"' | head -5; then
    print_issue "Found potential hardcoded passwords"
fi

# Check for API keys
if grep -r "api.*key.*=" src/ --include="*.ts" --include="*.tsx" | grep -v "process.env" | head -3; then
    print_issue "Found potential hardcoded API keys"
fi

# Check for AWS keys
if grep -r "AKIA[0-9A-Z]{16}" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx"; then
    print_issue "Found AWS Access Key IDs in source code"
fi

# Check for private keys
if grep -r "BEGIN.*PRIVATE.*KEY" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx"; then
    print_issue "Found private keys in source code"
fi

# Check for JWT secrets
if grep -r "jwt.*secret" src/ --include="*.ts" --include="*.tsx" | grep -v "process.env" | grep -v "JWT_SECRET" | head -3; then
    print_issue "Found potential JWT secrets"
fi

echo -e "\nChecking environment variable usage..."

# Check for proper environment variable usage
if grep -r "process.env\." src/ --include="*.ts" --include="*.tsx" | grep -v "process.env.NODE_ENV" | grep -v "process.env.NEXT_PUBLIC_" | head -10; then
    print_ok "Environment variables are being used properly"
fi

echo -e "\nChecking for secure patterns..."

# Check for secure randomization
if grep -r "Math.random" src/ --include="*.ts" --include="*.tsx" | grep -v "test" | head -3; then
    print_warning "Found Math.random() usage - consider crypto.randomBytes for security-critical operations"
fi

# Check for console.log with sensitive data
if grep -r "console.log.*password\|console.log.*secret\|console.log.*key" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx"; then
    print_issue "Found console.log statements that might leak sensitive data"
fi

echo -e "\nChecking file permissions..."

# Check for sensitive files with wrong permissions
find . -name ".env*" -type f | while read -r file; do
    if [ -f "$file" ] && [ "$(stat -c %a "$file" 2>/dev/null || stat -f %A "$file" 2>/dev/null)" != "600" ]; then
        print_warning "File $file should have 600 permissions"
    fi
done

echo -e "\n==============================="
if [ $ISSUES_FOUND -eq 0 ]; then
    print_ok "No critical security issues found!"
else
    echo -e "${RED}Found $ISSUES_FOUND security issues that need attention${NC}"
fi

echo -e "\nRun this script regularly to maintain security."
EOF

chmod +x scripts/security-audit.sh

echo "Step 4: Creating environment variable validation..."

cat > scripts/validate-env-security.sh << 'EOF'
#!/bin/bash

echo "🔐 Validating Environment Variable Security"
echo "=========================================="

VALIDATION_ERRORS=0

validate_secret() {
    local var_name="$1"
    local min_length="$2"
    local value="${!var_name}"
    
    if [ -z "$value" ]; then
        echo "❌ $var_name is not set"
        VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
        return 1
    fi
    
    if [ ${#value} -lt $min_length ]; then
        echo "❌ $var_name is too short (minimum $min_length characters)"
        VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
        return 1
    fi
    
    # Check for common weak patterns
    if [[ "$value" =~ ^(password|secret|key|test|demo|example)$ ]]; then
        echo "❌ $var_name appears to be a placeholder value"
        VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
        return 1
    fi
    
    echo "✅ $var_name is properly configured"
    return 0
}

# Load environment variables
if [ -f ".env.local" ]; then
    set -a
    source .env.local
    set +a
    echo "Loaded .env.local"
else
    echo "⚠️  .env.local not found - using system environment"
fi

echo -e "\nValidating critical secrets..."

# Validate critical environment variables
validate_secret "NEXTAUTH_SECRET" 32
validate_secret "DATABASE_URL" 20
validate_secret "JWT_SECRET" 32

# Validate optional but important secrets
if [ ! -z "$STRIPE_SECRET_KEY" ]; then
    validate_secret "STRIPE_SECRET_KEY" 20
fi

if [ ! -z "$AWS_SECRET_ACCESS_KEY" ]; then
    validate_secret "AWS_SECRET_ACCESS_KEY" 20
fi

if [ ! -z "$SENDGRID_API_KEY" ]; then
    validate_secret "SENDGRID_API_KEY" 20
fi

echo -e "\nValidating secret strength..."

# Check NextAuth secret strength
if [ ! -z "$NEXTAUTH_SECRET" ]; then
    if [[ "$NEXTAUTH_SECRET" =~ [A-Za-z] ]] && [[ "$NEXTAUTH_SECRET" =~ [0-9] ]] && [[ "$NEXTAUTH_SECRET" =~ [^A-Za-z0-9] ]]; then
        echo "✅ NEXTAUTH_SECRET has good complexity"
    else
        echo "⚠️  NEXTAUTH_SECRET could be more complex (mix of letters, numbers, symbols)"
    fi
fi

echo -e "\n==============================="
if [ $VALIDATION_ERRORS -eq 0 ]; then
    echo "✅ All environment variables passed validation!"
else
    echo "❌ Found $VALIDATION_ERRORS validation errors"
    exit 1
fi
EOF

chmod +x scripts/validate-env-security.sh

echo "Step 5: Creating pre-commit security hook..."

mkdir -p .git/hooks 2>/dev/null || true

cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash

echo "🔒 Running security checks before commit..."

# Check for sensitive files
SENSITIVE_PATTERNS=(
    "\.env$"
    "\.env\.local$"
    "\.env\.production$"
    "\.env\.staging$"
    ".*\.pem$"
    ".*\.key$"
    ".*secret.*"
    ".*password.*"
)

BLOCKED_FILES=()

for pattern in "${SENSITIVE_PATTERNS[@]}"; do
    if git diff --cached --name-only | grep -E "$pattern" >/dev/null; then
        BLOCKED_FILES+=($(git diff --cached --name-only | grep -E "$pattern"))
    fi
done

if [ ${#BLOCKED_FILES[@]} -gt 0 ]; then
    echo "❌ Blocked commit: Attempting to commit sensitive files:"
    printf '%s\n' "${BLOCKED_FILES[@]}"
    echo ""
    echo "Please remove these files from your commit:"
    echo "git reset HEAD <file>"
    exit 1
fi

# Check for secrets in staged content
if git diff --cached | grep -E "(password|secret|key).*=.*['\"][^'\"]{8,}['\"]" >/dev/null; then
    echo "❌ Blocked commit: Found potential secrets in staged changes"
    echo "Please review your changes and use environment variables instead"
    exit 1
fi

echo "✅ Security checks passed"
EOF

chmod +x .git/hooks/pre-commit 2>/dev/null || true

echo "✅ Security fixes applied!"
echo ""
echo "Next steps:"
echo "1. Run: ./scripts/security-audit.sh"
echo "2. Run: ./scripts/validate-env-security.sh" 
echo "3. Review and test your application"
echo "4. Rotate any potentially compromised secrets"