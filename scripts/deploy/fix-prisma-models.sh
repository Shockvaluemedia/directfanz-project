#!/bin/bash

# Script to fix common Prisma model naming issues from singular to plural

echo "Fixing Prisma model references from singular to plural..."

# Navigate to the project directory
cd "/Users/demetriusbrooks/Nahvee Even"

# Fix common model name patterns
find src -name "*.ts" -type f -exec sed -i '' 's/prisma\.user\./prisma.users./g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/prisma\.artist\./prisma.artists./g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/prisma\.tier\./prisma.tiers./g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/prisma\.subscription\./prisma.subscriptions./g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/prisma\.message\./prisma.messages./g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/prisma\.comment\./prisma.comments./g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/prisma\.campaign\./prisma.campaigns./g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/prisma\.challenge\./prisma.challenges./g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/prisma\.challengeParticipation\./prisma.challenge_participations./g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/prisma\.challengeSubmission\./prisma.challenge_submissions./g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/prisma\.challengeLeaderboard\./prisma.challenge_leaderboards./g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/prisma\.campaignReward\./prisma.campaign_rewards./g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/prisma\.oAuthToken\./prisma.oauth_tokens./g' {} \;

echo "Fixed singular to plural model references"

# Also fix common relationship field names that might be incorrect
echo "Fixing relationship field names..."

# Note: These are more complex and might need manual review
# Uncomment and adjust as needed after reviewing the schema
# find src -name "*.ts" -type f -exec sed -i '' 's/artistProfile:/artists:/g' {} \;
# find src -name "*.ts" -type f -exec sed -i '' 's/\.artistProfile/.artists/g' {} \;

echo "Model reference fixes completed!"
echo "Please run 'npx tsc --noEmit' to check for remaining type errors."