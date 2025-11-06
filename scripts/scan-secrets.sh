#!/bin/bash

echo "🔍 Scanning for potential secrets in source code..."

# Common secret patterns
PATTERNS=(
    "password\s*=\s*['\"][^'\"]{8,}"
    "secret\s*=\s*['\"][^'\"]{16,}"
    "key\s*=\s*['\"][^'\"]{16,}"
    "token\s*=\s*['\"][^'\"]{16,}"
    "api[_-]?key\s*=\s*['\"][^'\"]{16,}"
    "access[_-]?key\s*=\s*['\"][^'\"]{16,}"
    "['\"][A-Za-z0-9+/]{32,}={0,2}['\"]"
    "sk_live_[A-Za-z0-9]{24,}"
    "pk_live_[A-Za-z0-9]{24,}"
    "AKIA[0-9A-Z]{16}"
)

FOUND_SECRETS=false

for pattern in "${PATTERNS[@]}"; do
    if grep -r -E "$pattern" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null; then
        FOUND_SECRETS=true
        echo "❌ Found potential secret: $pattern"
    fi
done

if [ "$FOUND_SECRETS" = false ]; then
    echo "✅ No obvious secrets found in source code"
else
    echo "⚠️  Please review and remove any hardcoded secrets"
fi
