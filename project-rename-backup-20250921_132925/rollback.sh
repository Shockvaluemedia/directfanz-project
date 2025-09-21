#!/bin/bash
# Rollback script generated on Sun Sep 21 13:29:25 CDT 2025
# This script will restore the original project name

set -euo pipefail

echo "🔄 Rolling back project rename..."

# Restore backed up files
cp '/Users/demetriusbrooks/Nahvee Even/project-rename-backup-20250921_132925/package.json' 'package.json'
cp '/Users/demetriusbrooks/Nahvee Even/project-rename-backup-20250921_132925/README.md' 'README.md'
cp '/Users/demetriusbrooks/Nahvee Even/project-rename-backup-20250921_132925/PROJECT_PROTECTION_SUMMARY.md' 'PROJECT_PROTECTION_SUMMARY.md'
cp '/Users/demetriusbrooks/Nahvee Even/project-rename-backup-20250921_132925/INCIDENT_RESPONSE_PLAN.md' 'INCIDENT_RESPONSE_PLAN.md'
cp '/Users/demetriusbrooks/Nahvee Even/project-rename-backup-20250921_132925/setup-branch-protection.sh' 'scripts/setup-branch-protection.sh'
cp '/Users/demetriusbrooks/Nahvee Even/project-rename-backup-20250921_132925/setup-secrets-management.sh' 'scripts/setup-secrets-management.sh'
cp '/Users/demetriusbrooks/Nahvee Even/project-rename-backup-20250921_132925/backup-system.sh' 'scripts/backup-system.sh'
cp '/Users/demetriusbrooks/Nahvee Even/project-rename-backup-20250921_132925/security-monitoring.js' 'scripts/security-monitoring.js'
cp '/Users/demetriusbrooks/Nahvee Even/project-rename-backup-20250921_132925/security.yml' '.github/workflows/security.yml'
cp '/Users/demetriusbrooks/Nahvee Even/project-rename-backup-20250921_132925/production-deploy.yml' '.github/workflows/production-deploy.yml'
cp '/Users/demetriusbrooks/Nahvee Even/project-rename-backup-20250921_132925/docker-compose.production.yml' 'docker-compose.production.yml'
cp '/Users/demetriusbrooks/Nahvee Even/project-rename-backup-20250921_132925/vercel.json' 'vercel.json'

echo "✅ Rollback completed. You may need to manually rename the folder back to 'Nahvee Even'"
echo "   Run: cd .. && mv '$NEW_FOLDER_NAME' 'Nahvee Even'"
