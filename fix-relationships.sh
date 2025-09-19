#!/bin/bash

# Script to fix remaining relationship and enum import issues

echo "Fixing relationship include/select issues and enum imports..."

# Navigate to the project directory
cd "/Users/demetriusbrooks/Nahvee Even"

# Fix common relationship field names in include/select
find src -name "*.ts" -type f -exec sed -i '' 's/{ fan:/{users:/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/{ tier:/{tiers:/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/{ campaign:/{campaigns:/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/{ sender:/{users_messages_senderIdTousers:/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/{ viewer:/{users:/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/{ artist:/{users:/g' {} \;

# Fix _count select issues
find src -name "*.ts" -type f -exec sed -i '' 's/participations:/challenge_participations:/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/submissions:/challenge_submissions:/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/rewards:/campaign_rewards:/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/distributions:/reward_distributions:/g' {} \;

# Fix response object access
find src -name "*.ts" -type f -exec sed -i '' 's/\.fan\./.users./g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/\.tier\./.tiers./g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/\.campaign\./.campaigns./g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/\.sender\./.users_messages_senderIdTousers./g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/\.viewer\./.users./g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/\.artist\./.users./g' {} \;

# Remove problematic enum imports and replace with string literals
find src -name "*.ts" -type f -exec sed -i '' 's/import.*RewardType.*from.*@prisma\/client.*;//g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/import.*CampaignStatus.*from.*@prisma\/client.*;//g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/import.*CampaignType.*from.*@prisma\/client.*;//g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/import.*CampaignMetric.*from.*@prisma\/client.*;//g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/import.*SubmissionStatus.*from.*@prisma\/client.*;//g' {} \;

# Fix remaining camelCase model references in transaction contexts
find src -name "*.ts" -type f -exec sed -i '' 's/tx\.campaignReward\./tx.campaign_rewards./g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/tx\.challengeParticipation\./tx.challenge_participations./g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/tx\.challengeSubmission\./tx.challenge_submissions./g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/tx\.challengeLeaderboard\./tx.challenge_leaderboards./g' {} \;

echo "Fixed relationship and enum issues"
echo "Please run 'npx tsc --noEmit' to check for remaining type errors."