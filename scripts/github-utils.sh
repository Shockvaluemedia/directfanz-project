#!/bin/bash

# ==============================================
# DIRECTFANZ GITHUB CLI UTILITIES
# ==============================================

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }
log_action() { echo -e "${CYAN}🔧 $1${NC}"; }

# Function to show usage
show_usage() {
    log_info "DirectFanz GitHub CLI Utilities"
    echo "================================="
    echo ""
    echo "Usage: ./scripts/github-utils.sh [command]"
    echo ""
    echo "Available commands:"
    echo "  status      - Show repository and workflow status"
    echo "  workflows   - List all GitHub Actions workflows"
    echo "  runs        - Show recent workflow runs"
    echo "  deploy      - Trigger production deployment"
    echo "  release     - Create a new release"
    echo "  issues      - Manage issues"
    echo "  secrets     - Manage repository secrets"
    echo "  setup       - Initial setup and configuration"
    echo "  sync        - Sync local changes with remote"
    echo ""
}

# Repository status
show_status() {
    log_action "📊 Repository Status"
    echo "===================="
    
    # Basic repo info
    gh repo view --json name,description,visibility,pushedAt,defaultBranchRef | jq -r '
        "Repository: " + .name,
        "Description: " + (.description // "No description"),
        "Visibility: " + .visibility,
        "Default Branch: " + .defaultBranchRef.name,
        "Last Push: " + .pushedAt
    '
    
    echo ""
    log_info "🌿 Branch Information"
    git branch -v
    
    echo ""
    log_info "📝 Recent Commits"
    git log --oneline -5
    
    echo ""
    log_info "🔄 Git Status"
    git status --short
}

# Workflow management
show_workflows() {
    log_action "⚙️  GitHub Actions Workflows"
    echo "============================"
    
    gh workflow list
    
    echo ""
    log_info "📋 Workflow Details:"
    echo "• ci-cd.yml - Continuous Integration and Testing"
    echo "• deploy.yml - Production Deployment Pipeline" 
    echo "• rollback.yml - Emergency Rollback Procedures"
}

# Recent workflow runs
show_runs() {
    log_action "🏃 Recent Workflow Runs"
    echo "======================="
    
    gh run list --limit 10
    
    echo ""
    log_info "💡 Pro tip: Use 'gh run view <run-id>' to see detailed logs"
}

# Trigger deployment
trigger_deploy() {
    log_action "🚀 Triggering Production Deployment"
    echo "==================================="
    
    echo ""
    log_warning "⚠️  This will trigger a production deployment to https://www.directfanz.io"
    read -p "Are you sure you want to continue? (y/N): " confirm
    
    if [[ $confirm =~ ^[Yy]$ ]]; then
        log_info "🔄 Pushing to main branch to trigger deployment..."
        git push origin main
        
        echo ""
        log_success "✅ Deployment triggered!"
        log_info "📊 Monitor progress:"
        echo "gh run list"
        echo "gh run view --log <run-id>"
        
        echo ""
        log_info "🌐 Your site will be available at:"
        echo "https://www.directfanz.io"
    else
        log_warning "❌ Deployment cancelled"
    fi
}

# Create release
create_release() {
    log_action "🏷️  Creating New Release"
    echo "========================"
    
    # Get current version from package.json
    current_version=$(node -p "require('./package.json').version")
    log_info "Current version: v$current_version"
    
    echo ""
    read -p "Enter new version (e.g., 1.0.1): " new_version
    read -p "Enter release title: " release_title
    read -p "Enter release notes (optional): " release_notes
    
    if [[ -n "$new_version" && -n "$release_title" ]]; then
        # Update package.json version
        npm version $new_version --no-git-tag-version
        
        # Commit version bump
        git add package.json
        git commit -m "chore: bump version to v$new_version"
        git push origin main
        
        # Create GitHub release
        gh release create "v$new_version" \
            --title "$release_title" \
            --notes "${release_notes:-Release v$new_version}" \
            --latest
        
        log_success "✅ Release v$new_version created successfully!"
        log_info "🔗 View at: https://github.com/Shockvaluemedia/directfanz/releases"
    else
        log_warning "❌ Release creation cancelled - missing required fields"
    fi
}

# Issue management
manage_issues() {
    log_action "🐛 Issue Management"
    echo "==================="
    
    echo ""
    echo "1. List open issues"
    echo "2. Create new issue"
    echo "3. View issue details"
    echo "4. Close issue"
    echo ""
    
    read -p "Select option (1-4): " choice
    
    case $choice in
        1)
            log_info "📋 Open Issues:"
            gh issue list --state open
            ;;
        2)
            echo ""
            read -p "Issue title: " title
            read -p "Issue body: " body
            read -p "Labels (comma-separated): " labels
            
            gh issue create \
                --title "$title" \
                --body "${body:-No description provided}" \
                --label "${labels:-bug}"
            
            log_success "✅ Issue created successfully!"
            ;;
        3)
            gh issue list --state open
            echo ""
            read -p "Enter issue number: " issue_num
            gh issue view $issue_num
            ;;
        4)
            gh issue list --state open
            echo ""
            read -p "Enter issue number to close: " issue_num
            read -p "Closing comment: " comment
            gh issue close $issue_num --comment "${comment:-Issue resolved}"
            log_success "✅ Issue #$issue_num closed!"
            ;;
        *)
            log_warning "Invalid option"
            ;;
    esac
}

# Secret management
manage_secrets() {
    log_action "🔐 Repository Secrets"
    echo "====================="
    
    echo ""
    log_info "Current secrets:"
    gh secret list
    
    echo ""
    echo "Required secrets for DirectFanz:"
    echo "• DATABASE_URL - Supabase connection string"
    echo "• NEXTAUTH_SECRET - Authentication secret"
    echo "• NEXTAUTH_URL - Production URL (https://www.directfanz.io)"
    echo "• STRIPE_SECRET_KEY - Stripe live secret key"
    echo "• STRIPE_PUBLISHABLE_KEY - Stripe live publishable key"
    echo "• AWS_ACCESS_KEY_ID - AWS access key"
    echo "• AWS_SECRET_ACCESS_KEY - AWS secret key"
    echo "• SENDGRID_API_KEY - Email service API key"
    
    echo ""
    echo "1. Set new secret"
    echo "2. Update existing secret"
    echo "3. Delete secret"
    echo ""
    
    read -p "Select option (1-3): " choice
    
    case $choice in
        1|2)
            read -p "Secret name: " secret_name
            read -s -p "Secret value: " secret_value
            echo ""
            
            echo "$secret_value" | gh secret set "$secret_name"
            log_success "✅ Secret '$secret_name' set successfully!"
            ;;
        3)
            read -p "Secret name to delete: " secret_name
            gh secret delete "$secret_name"
            log_success "✅ Secret '$secret_name' deleted!"
            ;;
        *)
            log_warning "Invalid option"
            ;;
    esac
}

# Initial setup
setup_github() {
    log_action "⚙️  GitHub Setup & Configuration"
    echo "==============================="
    
    log_info "📋 Current repository setup:"
    gh repo view --json name,visibility,hasIssuesEnabled,hasWikiEnabled | jq -r '
        "Repository: " + .name,
        "Visibility: " + .visibility,
        "Issues: " + (.hasIssuesEnabled | if . then "Enabled" else "Disabled" end),
        "Wiki: " + (.hasWikiEnabled | if . then "Enabled" else "Disabled" end)
    '
    
    echo ""
    log_info "🔧 Enabling repository features..."
    
    # Enable issues and discussions
    gh repo edit --enable-issues --enable-discussions
    
    log_success "✅ Repository features enabled!"
    
    echo ""
    log_info "📋 Setting up issue templates..."
    
    # Check if issue templates exist
    if [[ ! -d ".github/ISSUE_TEMPLATE" ]]; then
        mkdir -p .github/ISSUE_TEMPLATE
        
        # Bug report template
        cat > .github/ISSUE_TEMPLATE/bug_report.md << 'EOF'
---
name: Bug report
about: Create a report to help us improve DirectFanz
title: '[BUG] '
labels: ['bug']
assignees: ''
---

## Bug Description
A clear and concise description of what the bug is.

## Steps to Reproduce
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

## Expected Behavior
A clear and concise description of what you expected to happen.

## Screenshots
If applicable, add screenshots to help explain your problem.

## Environment
- Browser: [e.g. Chrome, Safari]
- Device: [e.g. Desktop, iPhone]
- OS: [e.g. macOS, Windows]

## Additional Context
Add any other context about the problem here.
EOF

        # Feature request template
        cat > .github/ISSUE_TEMPLATE/feature_request.md << 'EOF'
---
name: Feature request
about: Suggest an idea for DirectFanz
title: '[FEATURE] '
labels: ['enhancement']
assignees: ''
---

## Feature Description
A clear and concise description of what you want to happen.

## Problem Statement
A clear and concise description of what the problem is. Ex. I'm always frustrated when [...]

## Proposed Solution
A clear and concise description of what you want to happen.

## Alternatives Considered
A clear and concise description of any alternative solutions or features you've considered.

## Additional Context
Add any other context or screenshots about the feature request here.
EOF
        
        log_success "✅ Issue templates created!"
    fi
    
    echo ""
    log_info "🔐 Required secrets status:"
    required_secrets=("DATABASE_URL" "NEXTAUTH_SECRET" "NEXTAUTH_URL" "STRIPE_SECRET_KEY")
    
    for secret in "${required_secrets[@]}"; do
        if gh secret list | grep -q "$secret"; then
            log_success "✅ $secret - Set"
        else
            log_warning "⚠️  $secret - Missing"
        fi
    done
    
    echo ""
    log_info "📚 Next steps:"
    echo "1. Set missing repository secrets: ./scripts/github-utils.sh secrets"
    echo "2. Configure branch protection: gh api repos/Shockvaluemedia/directfanz/branches/main/protection"
    echo "3. Set up automated deployments: Push to main branch"
}

# Sync changes
sync_changes() {
    log_action "🔄 Syncing Local Changes"
    echo "========================"
    
    # Check for uncommitted changes
    if [[ -n $(git status --porcelain) ]]; then
        log_info "📝 Found uncommitted changes:"
        git status --short
        
        echo ""
        read -p "Commit message: " commit_msg
        
        if [[ -n "$commit_msg" ]]; then
            git add .
            git commit -m "$commit_msg"
            log_success "✅ Changes committed!"
        else
            log_warning "⚠️  No commit message provided"
            return 1
        fi
    fi
    
    # Push changes
    log_info "🚀 Pushing to remote..."
    git push origin $(git branch --show-current)
    
    log_success "✅ Local changes synced with remote!"
    
    # Show latest workflow run if triggered
    echo ""
    log_info "🏃 Latest workflow run:"
    gh run list --limit 1
}

# Main command dispatcher
case "${1:-}" in
    "status")
        show_status
        ;;
    "workflows")
        show_workflows
        ;;
    "runs")
        show_runs
        ;;
    "deploy")
        trigger_deploy
        ;;
    "release")
        create_release
        ;;
    "issues")
        manage_issues
        ;;
    "secrets")
        manage_secrets
        ;;
    "setup")
        setup_github
        ;;
    "sync")
        sync_changes
        ;;
    *)
        show_usage
        ;;
esac