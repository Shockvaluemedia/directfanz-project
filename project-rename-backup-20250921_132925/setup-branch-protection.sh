#!/bin/bash

# Branch Protection Setup Script for DirectFanz
# This script configures GitHub branch protection rules for the main branch

echo "🔒 Setting up branch protection for DirectFanz repository..."

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed. Please install it first:"
    echo "   brew install gh"
    echo "   Then run: gh auth login"
    exit 1
fi

# Check authentication
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub. Please run: gh auth login"
    exit 1
fi

REPO="Shockvaluemedia/directfanz"
BRANCH="main"

echo "📋 Configuring branch protection for $REPO:$BRANCH..."

# Enable branch protection with comprehensive rules
gh api \
  --method PUT \
  --header "Accept: application/vnd.github.v3+json" \
  "/repos/$REPO/branches/$BRANCH/protection" \
  --input - <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "build",
      "test",
      "security-scan",
      "type-check"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 2,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "require_last_push_approval": true
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": true
}
EOF

if [ $? -eq 0 ]; then
    echo "✅ Branch protection configured successfully!"
else
    echo "❌ Failed to configure branch protection. Check permissions and try again."
fi

echo "🔐 Additional security recommendations:"
echo "   1. Enable 'Require signed commits' in GitHub repository settings"
echo "   2. Set up CODEOWNERS file for code review requirements"
echo "   3. Configure dependabot for automatic security updates"
echo "   4. Enable private vulnerability reporting"

EOF