#!/bin/bash

# Safe Project Renaming Script
# This script safely renames the project folder and updates all references

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS: $1${NC}"
}

# Configuration
CURRENT_NAME="Nahvee Even"
CURRENT_SLUG="nahvee-even"
CURRENT_CAMEL="NahveeEven"
CURRENT_SNAKE="nahvee_even"
CURRENT_UPPER="NAHVEE_EVEN"

NEW_NAME=""
NEW_SLUG=""
NEW_CAMEL=""
NEW_SNAKE=""
NEW_UPPER=""

BACKUP_DIR="$(pwd)/project-rename-backup-$(date +%Y%m%d_%H%M%S)"
ROLLBACK_SCRIPT="${BACKUP_DIR}/rollback.sh"

# Function to convert names to different formats
convert_name_formats() {
    local input_name="$1"
    
    # Create slug version (lowercase with hyphens)
    NEW_SLUG=$(echo "$input_name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-\|-$//g')
    
    # Create camelCase version
    NEW_CAMEL=$(echo "$input_name" | sed 's/[^a-zA-Z0-9]/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) substr($i,2)} 1' | tr -d ' ')
    
    # Create snake_case version
    NEW_SNAKE=$(echo "$input_name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/_/g' | sed 's/__*/_/g' | sed 's/^_\|_$//g')
    
    # Create UPPER_CASE version
    NEW_UPPER=$(echo "$NEW_SNAKE" | tr '[:lower:]' '[:upper:]')
    
    NEW_NAME="$input_name"
}

# Create backup of current state
create_backup() {
    log "Creating backup before renaming..."
    
    mkdir -p "$BACKUP_DIR"
    
    # Backup important files that will be modified
    local files_to_backup=(
        "package.json"
        "README.md"
        "PROJECT_PROTECTION_SUMMARY.md" 
        "INCIDENT_RESPONSE_PLAN.md"
        "SECRETS_ROTATION_SCHEDULE.md"
        ".env.vault.template"
        "scripts/setup-branch-protection.sh"
        "scripts/setup-secrets-management.sh"
        "scripts/backup-system.sh"
        "scripts/security-monitoring.js"
        ".github/workflows/security.yml"
        ".github/workflows/production-deploy.yml"
        "docker-compose.production.yml"
        "vercel.json"
    )
    
    for file in "${files_to_backup[@]}"; do
        if [[ -f "$file" ]]; then
            cp "$file" "$BACKUP_DIR/" 2>/dev/null || warn "Could not backup $file"
        fi
    done
    
    # Create rollback script
    cat > "$ROLLBACK_SCRIPT" << EOF
#!/bin/bash
# Rollback script generated on $(date)
# This script will restore the original project name

set -euo pipefail

echo "🔄 Rolling back project rename..."

# Restore backed up files
EOF

    for file in "${files_to_backup[@]}"; do
        if [[ -f "$BACKUP_DIR/$(basename "$file")" ]]; then
            echo "cp '$BACKUP_DIR/$(basename "$file")' '$file'" >> "$ROLLBACK_SCRIPT"
        fi
    done
    
    cat >> "$ROLLBACK_SCRIPT" << EOF

echo "✅ Rollback completed. You may need to manually rename the folder back to '$CURRENT_NAME'"
echo "   Run: cd .. && mv '\$NEW_FOLDER_NAME' '$CURRENT_NAME'"
EOF
    
    chmod +x "$ROLLBACK_SCRIPT"
    
    success "Backup created at: $BACKUP_DIR"
    log "Rollback script available at: $ROLLBACK_SCRIPT"
}

# Function to safely replace text in files
safe_replace_in_file() {
    local file="$1"
    local search="$2"
    local replace="$3"
    
    if [[ ! -f "$file" ]]; then
        return 0
    fi
    
    # Create temporary file
    local temp_file=$(mktemp)
    
    # Perform replacement
    sed "s|$search|$replace|g" "$file" > "$temp_file"
    
    # Check if file was actually changed
    if ! cmp -s "$file" "$temp_file"; then
        mv "$temp_file" "$file"
        log "Updated: $file (replaced '$search' with '$replace')"
    else
        rm "$temp_file"
    fi
}

# Update file contents
update_file_contents() {
    log "Updating file contents..."
    
    # Files to update with project name references
    local files_to_update=(
        "package.json"
        "README.md"
        "PROJECT_PROTECTION_SUMMARY.md"
        "INCIDENT_RESPONSE_PLAN.md" 
        "SECRETS_ROTATION_SCHEDULE.md"
        ".env.vault.template"
        "scripts/setup-branch-protection.sh"
        "scripts/setup-secrets-management.sh"
        "scripts/backup-system.sh"
        "scripts/security-monitoring.js"
        ".github/workflows/security.yml"
        ".github/workflows/production-deploy.yml"
        "docker-compose.production.yml"
        "vercel.json"
    )
    
    for file in "${files_to_update[@]}"; do
        if [[ -f "$file" ]]; then
            log "Processing: $file"
            
            # Replace different variations of the project name
            safe_replace_in_file "$file" "$CURRENT_NAME" "$NEW_NAME"
            safe_replace_in_file "$file" "$CURRENT_SLUG" "$NEW_SLUG"
            safe_replace_in_file "$file" "$CURRENT_CAMEL" "$NEW_CAMEL"
            safe_replace_in_file "$file" "$CURRENT_SNAKE" "$NEW_SNAKE"
            safe_replace_in_file "$file" "$CURRENT_UPPER" "$NEW_UPPER"
            
            # Handle specific patterns
            safe_replace_in_file "$file" "directfanz" "$NEW_SLUG"
            safe_replace_in_file "$file" "DirectFanz" "$NEW_CAMEL"
            safe_replace_in_file "$file" "DIRECTFANZ" "$NEW_UPPER"
        fi
    done
    
    # Update any markdown files that might reference the project
    find . -name "*.md" -not -path "./node_modules/*" -not -path "./.next/*" -not -path "./backup*" | while read -r file; do
        safe_replace_in_file "$file" "$CURRENT_NAME" "$NEW_NAME"
        safe_replace_in_file "$file" "DirectFanz" "$NEW_CAMEL"
        safe_replace_in_file "$file" "directfanz" "$NEW_SLUG"
    done
    
    success "File contents updated"
}

# Update folder references
update_folder_references() {
    log "Checking for folder references..."
    
    # Look for any references to the project folder path
    local current_path="/Users/demetriusbrooks/Nahvee Even"
    local new_path="/Users/demetriusbrooks/$NEW_NAME"
    
    # Files that might contain absolute paths
    local path_files=(
        ".env*"
        "scripts/*.sh"
        "scripts/*.js"
        ".github/workflows/*.yml"
    )
    
    for pattern in "${path_files[@]}"; do
        find . -path "./node_modules" -prune -o -path "./.next" -prune -o -name "$pattern" -type f -print0 2>/dev/null | while IFS= read -r -d '' file; do
            if [[ -f "$file" ]]; then
                safe_replace_in_file "$file" "$current_path" "$new_path"
            fi
        done
    done
    
    success "Folder references updated"
}

# Verify changes
verify_changes() {
    log "Verifying changes..."
    
    # Check if critical files exist and seem valid
    local critical_files=(
        "package.json"
        "scripts/backup-system.sh"
        ".github/workflows/security.yml"
    )
    
    for file in "${critical_files[@]}"; do
        if [[ -f "$file" ]]; then
            # Basic syntax check for JSON files
            if [[ "$file" == *.json ]]; then
                if ! jq empty "$file" 2>/dev/null; then
                    error "Invalid JSON syntax in $file after renaming"
                fi
            fi
            
            # Check if the new name appears in the file
            if grep -q "$NEW_NAME\|$NEW_SLUG\|$NEW_CAMEL" "$file" 2>/dev/null; then
                success "✅ $file contains new project name"
            else
                warn "⚠️  $file may not have been updated correctly"
            fi
        fi
    done
    
    success "Changes verified"
}

# Display summary of changes
show_summary() {
    log "Rename Summary:"
    echo
    echo "Original Name Formats:"
    echo "  Display Name: $CURRENT_NAME"
    echo "  Slug:         $CURRENT_SLUG"
    echo "  CamelCase:    $CURRENT_CAMEL"
    echo "  snake_case:   $CURRENT_SNAKE"
    echo "  UPPER_CASE:   $CURRENT_UPPER"
    echo
    echo "New Name Formats:"
    echo "  Display Name: $NEW_NAME"
    echo "  Slug:         $NEW_SLUG" 
    echo "  CamelCase:    $NEW_CAMEL"
    echo "  snake_case:   $NEW_SNAKE"
    echo "  UPPER_CASE:   $NEW_UPPER"
    echo
}

# Instructions for manual folder rename
show_folder_instructions() {
    echo
    success "✅ Project content successfully renamed!"
    echo
    warn "IMPORTANT: You still need to manually rename the project folder:"
    echo
    echo "1. Exit this directory:"
    echo "   cd .."
    echo
    echo "2. Rename the folder:"
    echo "   mv \"$CURRENT_NAME\" \"$NEW_NAME\""
    echo
    echo "3. Enter the renamed directory:"
    echo "   cd \"$NEW_NAME\""
    echo
    echo "4. Update your git remote if needed:"
    echo "   git remote set-url origin https://github.com/Shockvaluemedia/$NEW_SLUG.git"
    echo
    warn "Backup available at: $BACKUP_DIR"
    warn "Rollback script available at: $ROLLBACK_SCRIPT"
}

# Main function
main() {
    echo "🔄 Safe Project Renaming Tool"
    echo "Current project: $CURRENT_NAME"
    echo
    
    # Get new project name
    if [[ -z "${1:-}" ]]; then
        echo "Please enter the new project name:"
        read -r NEW_NAME
    else
        NEW_NAME="$1"
    fi
    
    if [[ -z "$NEW_NAME" ]]; then
        error "Project name cannot be empty"
    fi
    
    if [[ "$NEW_NAME" == "$CURRENT_NAME" ]]; then
        error "New name is the same as current name"
    fi
    
    # Convert name to different formats
    convert_name_formats "$NEW_NAME"
    
    # Show summary and confirm
    show_summary
    
    echo "Do you want to proceed with this renaming? (y/N)"
    read -r confirm
    
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        log "Renaming cancelled"
        exit 0
    fi
    
    # Perform the renaming
    create_backup
    update_file_contents
    update_folder_references
    verify_changes
    
    show_folder_instructions
    
    success "Project renaming completed successfully!"
}

# Run main function
main "$@"