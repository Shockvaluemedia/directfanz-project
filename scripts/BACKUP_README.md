# Backup and Deployment Scripts

This directory contains scripts to help you maintain your backups and ensure your deployments are working correctly.

## Scripts

### 1. `backup-check.sh` - Comprehensive Verification
A detailed script that checks:
- Git status and uncommitted changes
- GitHub connection and sync status
- Vercel deployment status
- Environment configuration

**Usage:**
```bash
./scripts/backup-check.sh
```

**When to use:** Weekly or when you want a thorough check of your entire backup and deployment pipeline.

### 2. `daily-backup.sh` - Quick Daily Backup
A simple script that:
- Commits any uncommitted changes
- Pushes to GitHub
- Checks basic Vercel status
- Logs backup completion

**Usage:**
```bash
./scripts/daily-backup.sh
```

**When to use:** Daily or whenever you want to quickly ensure your work is backed up.

## Setting up Automated Backups

### Option 1: Cron Job (macOS/Linux)
Set up a daily backup at 6 PM:

```bash
# Edit your crontab
crontab -e

# Add this line (replace with your actual path):
0 18 * * * cd "/Users/demetriusbrooks/DirectFanZ Project" && ./scripts/daily-backup.sh >> scripts/backup.log 2>&1
```

### Option 2: Git Hooks
Set up a pre-push hook to run checks:

```bash
# Create pre-push hook
echo '#!/bin/bash\necho "Running backup check..."\n./scripts/backup-check.sh' > .git/hooks/pre-push
chmod +x .git/hooks/pre-push
```

### Option 3: Manual Reminder
Set a daily reminder on your phone/calendar to run the backup script.

## Backup Verification Checklist

✅ **Git Status**
- [ ] No uncommitted changes
- [ ] Local branch is up to date with remote
- [ ] All changes pushed to GitHub

✅ **GitHub Backup**
- [ ] Repository is accessible
- [ ] Latest commit is visible on GitHub
- [ ] All important files are included

✅ **Vercel Deployment**
- [ ] Latest deployment is successful
- [ ] Website is live and accessible
- [ ] No build errors

✅ **Environment**
- [ ] Environment variables are set correctly
- [ ] Configuration files are present
- [ ] Dependencies are up to date

## Troubleshooting

### Common Issues

**"Cannot connect to GitHub remote"**
- Check your internet connection
- Verify GitHub credentials: `git config --list | grep user`
- Test SSH key or personal access token

**"Vercel CLI not found"**
```bash
npm install -g vercel
```

**"Not logged into Vercel"**
```bash
vercel login
```

**"Deployment failed"**
- Check build logs: `vercel logs <deployment-url>`
- Verify environment variables in Vercel dashboard
- Check for syntax errors in your code

### Manual Backup Commands

If scripts fail, use these manual commands:

```bash
# Commit and push changes
git add .
git commit -m "backup: $(date)"
git push origin main

# Check Vercel status
vercel ls
vercel inspect <latest-deployment-url>

# Force redeploy
vercel --prod
```

## Best Practices

1. **Run backups regularly** - At least daily, ideally after each coding session
2. **Test your backups** - Occasionally clone your repo to a new location to verify everything is there
3. **Monitor deployments** - Check your live site regularly to ensure it's working
4. **Keep logs** - The scripts create logs to help you track backup history
5. **Update dependencies** - Regularly update your packages and deployment settings

## Emergency Recovery

If you lose your local files:

1. Clone from GitHub: `git clone <your-repo-url>`
2. Install dependencies: `npm install`
3. Set up environment variables
4. Redeploy to Vercel: `vercel --prod`

Your GitHub repository and Vercel deployment serve as your primary backups!