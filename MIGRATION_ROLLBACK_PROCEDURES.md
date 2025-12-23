# Migration Rollback Procedures

This document provides comprehensive rollback procedures for each phase of the AWS migration process. These procedures ensure that the DirectFanz platform can be safely reverted to its original state at any point during the migration.

## Overview

The AWS migration consists of multiple phases, each with specific rollback procedures:

1. **Database Migration** - AWS DMS with dual-write strategy
2. **S3 Content Migration** - Bucket-to-bucket content transfer
3. **Cache Rebuild** - Redis to ElastiCache migration
4. **Application Configuration** - Service endpoint updates
5. **DNS Cutover** - Route 53 traffic routing

## Rollback Principles

### 1. Safety First
- Always verify rollback procedures in staging environment
- Maintain data integrity throughout rollback process
- Document all rollback actions for audit trail

### 2. Minimal Downtime
- Execute rollbacks during maintenance windows when possible
- Use automated scripts to minimize manual intervention
- Prepare rollback scripts in advance

### 3. Data Preservation
- Never delete source data until migration is fully verified
- Maintain backups of all configuration changes
- Verify data integrity after rollback completion

## Phase-by-Phase Rollback Procedures

### Phase 1: Database Migration Rollback

#### Rollback Triggers
- DMS replication task failure
- Data integrity validation failure
- Application connectivity issues
- Performance degradation

#### Rollback Steps

##### 1.1 Stop Replication (If Active)
```bash
# Stop DMS replication task
tsx scripts/execute-database-migration.ts --rollback

# Or manually via AWS CLI
aws dms stop-replication-task \
  --replication-task-arn arn:aws:dms:region:account:task:task-id
```

##### 1.2 Disable Dual-Write Mode
```bash
# Update application configuration
export DUAL_WRITE_ENABLED=false
export DATABASE_URL=$SOURCE_DATABASE_URL

# Restart application services
kubectl rollout restart deployment/directfanz-web
kubectl rollout restart deployment/directfanz-websocket
```

##### 1.3 Verify Source Database
```bash
# Test source database connectivity
tsx scripts/test-db-connection.cjs --source

# Verify data integrity
tsx scripts/execute-database-migration.ts --monitor-only
```

##### 1.4 Clean Up DMS Resources
```bash
# Delete replication task
aws dms delete-replication-task \
  --replication-task-arn arn:aws:dms:region:account:task:task-id

# Delete replication instance
aws dms delete-replication-instance \
  --replication-instance-identifier directfanz-replication

# Delete endpoints
aws dms delete-endpoint --endpoint-arn arn:aws:dms:region:account:endpoint:source-endpoint
aws dms delete-endpoint --endpoint-arn arn:aws:dms:region:account:endpoint:target-endpoint
```

##### 1.5 Verification
- [ ] Application connects to source database
- [ ] All CRUD operations work correctly
- [ ] No data loss occurred
- [ ] Performance is acceptable
- [ ] DMS resources are cleaned up

#### Rollback Time Estimate
- **Simple rollback**: 5-10 minutes
- **With data verification**: 15-30 minutes
- **Full cleanup**: 30-45 minutes

---

### Phase 2: S3 Content Migration Rollback

#### Rollback Triggers
- Content integrity verification failure
- Application unable to access migrated content
- Performance issues with new bucket
- Incomplete migration

#### Rollback Steps

##### 2.1 Stop Migration Process
```bash
# If migration is in progress, stop it
pkill -f "execute-s3-migration"

# Or use process management
tsx scripts/execute-s3-migration.ts --stop
```

##### 2.2 Revert Application Configuration
```bash
# Update S3 bucket references
export AWS_S3_BUCKET_NAME=$SOURCE_S3_BUCKET
export CLOUDFRONT_DISTRIBUTION_ID=$SOURCE_CLOUDFRONT_ID

# Update Parameter Store
aws ssm put-parameter \
  --name "/directfanz/s3/content-bucket" \
  --value "$SOURCE_S3_BUCKET" \
  --overwrite

# Restart application
kubectl rollout restart deployment/directfanz-web
```

##### 2.3 Restore Deleted Source Objects (If Applicable)
```bash
# If source objects were deleted during migration
tsx scripts/restore-s3-objects.ts \
  --source-bucket $TARGET_S3_BUCKET \
  --target-bucket $SOURCE_S3_BUCKET \
  --restore-deleted-only
```

##### 2.4 Update CloudFront Origins
```bash
# Revert CloudFront distribution to original bucket
aws cloudfront update-distribution \
  --id $CLOUDFRONT_DISTRIBUTION_ID \
  --distribution-config file://original-cloudfront-config.json

# Invalidate cache
aws cloudfront create-invalidation \
  --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
  --paths "/*"
```

##### 2.5 Verification
- [ ] Application can access all content
- [ ] Upload functionality works
- [ ] CDN serves content correctly
- [ ] No broken links or missing files
- [ ] Performance is acceptable

#### Rollback Time Estimate
- **Configuration rollback**: 5-10 minutes
- **With object restoration**: 30 minutes - 2 hours (depending on data size)
- **CDN propagation**: 15-30 minutes

---

### Phase 3: Cache Rebuild Rollback

#### Rollback Triggers
- Cache rebuild failure
- Application session issues
- Performance degradation
- Data inconsistency

#### Rollback Steps

##### 3.1 Stop Cache Rebuild
```bash
# Stop rebuild process
pkill -f "execute-cache-rebuild"

# Or use graceful stop
tsx scripts/execute-cache-rebuild.ts --stop
```

##### 3.2 Clear Target Cache
```bash
# Clear ElastiCache (if partially rebuilt)
tsx scripts/execute-cache-rebuild.ts --clear-target

# Or manually
redis-cli -h $ELASTICACHE_ENDPOINT FLUSHDB
```

##### 3.3 Restore Original Cache
```bash
# If source Redis is still available
tsx scripts/execute-cache-rebuild.ts --restore-from-source

# Or rebuild from database
tsx scripts/execute-cache-rebuild.ts --rebuild-critical-only
```

##### 3.4 Update Application Configuration
```bash
# Revert to original Redis endpoint
export REDIS_URL=$SOURCE_REDIS_URL

# Update Parameter Store
aws ssm put-parameter \
  --name "/directfanz/redis/url" \
  --value "$SOURCE_REDIS_URL" \
  --overwrite

# Restart application
kubectl rollout restart deployment/directfanz-web
kubectl rollout restart deployment/directfanz-websocket
```

##### 3.5 Verification
- [ ] User sessions work correctly
- [ ] Cache hit rates are normal
- [ ] Real-time features function
- [ ] No authentication issues
- [ ] Performance is acceptable

#### Rollback Time Estimate
- **Configuration rollback**: 5-10 minutes
- **Cache restoration**: 10-30 minutes
- **Full rebuild**: 30-60 minutes

---

### Phase 4: Application Configuration Rollback

#### Rollback Triggers
- Service connectivity issues
- Configuration errors
- Performance problems
- Feature failures

#### Rollback Steps

##### 4.1 Revert Environment Variables
```bash
# Restore original configuration
export DATABASE_URL=$SOURCE_DATABASE_URL
export REDIS_URL=$SOURCE_REDIS_URL
export AWS_S3_BUCKET_NAME=$SOURCE_S3_BUCKET

# Update Kubernetes secrets
kubectl create secret generic directfanz-config \
  --from-env-file=.env.original \
  --dry-run=client -o yaml | kubectl apply -f -
```

##### 4.2 Revert Parameter Store Values
```bash
# Restore original parameters
aws ssm put-parameter --name "/directfanz/database/url" --value "$SOURCE_DATABASE_URL" --overwrite
aws ssm put-parameter --name "/directfanz/redis/url" --value "$SOURCE_REDIS_URL" --overwrite
aws ssm put-parameter --name "/directfanz/s3/content-bucket" --value "$SOURCE_S3_BUCKET" --overwrite
```

##### 4.3 Rollback Application Deployment
```bash
# Rollback to previous deployment
kubectl rollout undo deployment/directfanz-web
kubectl rollout undo deployment/directfanz-websocket

# Or deploy specific version
kubectl set image deployment/directfanz-web \
  app=directfanz:$PREVIOUS_VERSION
```

##### 4.4 Verification
- [ ] All services start successfully
- [ ] Health checks pass
- [ ] API endpoints respond correctly
- [ ] WebSocket connections work
- [ ] No configuration errors in logs

#### Rollback Time Estimate
- **Configuration rollback**: 2-5 minutes
- **Application restart**: 3-10 minutes
- **Total**: 5-15 minutes

---

### Phase 5: DNS Cutover Rollback

#### Rollback Triggers
- DNS resolution issues
- Traffic routing problems
- Service unavailability
- Performance degradation

#### Rollback Steps

##### 5.1 Revert DNS Records
```bash
# Update Route 53 records to point to original infrastructure
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch file://original-dns-records.json
```

##### 5.2 Update Health Checks
```bash
# Revert health check endpoints
aws route53 update-health-check \
  --health-check-id $HEALTH_CHECK_ID \
  --resource-path "/health" \
  --fully-qualified-domain-name "$ORIGINAL_ENDPOINT"
```

##### 5.3 Monitor DNS Propagation
```bash
# Monitor DNS propagation
dig directfanz.io @8.8.8.8
dig directfanz.io @1.1.1.1

# Check from multiple locations
tsx scripts/check-dns-propagation.ts --domain directfanz.io
```

##### 5.4 Verification
- [ ] DNS resolves to original infrastructure
- [ ] All subdomains work correctly
- [ ] SSL certificates are valid
- [ ] Health checks pass
- [ ] Global DNS propagation complete

#### Rollback Time Estimate
- **DNS record update**: 1-2 minutes
- **Propagation**: 5-15 minutes
- **Total**: 10-20 minutes

---

## Cross-Phase Rollback Coordination

### Scenario 1: Full Migration Rollback
When rolling back the entire migration:

1. **Stop all migration processes**
2. **Revert DNS** (Phase 5)
3. **Rollback application config** (Phase 4)
4. **Restore cache** (Phase 3)
5. **Revert S3 references** (Phase 2)
6. **Stop database replication** (Phase 1)
7. **Verify system integrity**

### Scenario 2: Partial Rollback
When rolling back specific components:

1. **Identify affected components**
2. **Determine rollback order**
3. **Execute component-specific rollback**
4. **Update dependent configurations**
5. **Verify system consistency**

## Rollback Testing Procedures

### Pre-Migration Testing
```bash
# Test rollback procedures in staging
tsx scripts/test-rollback-procedures.ts --environment staging

# Verify rollback scripts
tsx scripts/validate-rollback-scripts.ts

# Test cross-service coordination
tsx scripts/test-cross-service-rollback.ts
```

### During Migration Testing
```bash
# Test rollback at each phase
tsx scripts/execute-phase-rollback-test.ts --phase database
tsx scripts/execute-phase-rollback-test.ts --phase s3
tsx scripts/execute-phase-rollback-test.ts --phase cache
```

### Post-Rollback Verification
```bash
# Comprehensive system test
tsx scripts/test-system-integrity.ts --post-rollback

# Performance verification
tsx scripts/performance-test.js --baseline-comparison

# Data integrity check
tsx scripts/verify-data-integrity.ts --full-scan
```

## Rollback Automation Scripts

### Master Rollback Script
```bash
#!/bin/bash
# scripts/execute-master-rollback.sh

set -e

ROLLBACK_PHASE=${1:-"full"}
ENVIRONMENT=${2:-"production"}

echo "🔄 Starting rollback for phase: $ROLLBACK_PHASE"

case $ROLLBACK_PHASE in
  "database")
    tsx scripts/execute-database-migration.ts --rollback
    ;;
  "s3")
    tsx scripts/execute-s3-migration.ts --rollback
    ;;
  "cache")
    tsx scripts/execute-cache-rebuild.ts --rollback
    ;;
  "application")
    tsx scripts/rollback-application-config.ts
    ;;
  "dns")
    tsx scripts/rollback-dns-changes.ts
    ;;
  "full")
    tsx scripts/execute-full-rollback.ts --environment $ENVIRONMENT
    ;;
  *)
    echo "❌ Unknown rollback phase: $ROLLBACK_PHASE"
    exit 1
    ;;
esac

echo "✅ Rollback completed for phase: $ROLLBACK_PHASE"
```

### Rollback Verification Script
```bash
#!/bin/bash
# scripts/verify-rollback-success.sh

set -e

echo "🔍 Verifying rollback success..."

# Test database connectivity
tsx scripts/test-db-connection.cjs

# Test S3 access
tsx scripts/test-s3-access.ts

# Test cache functionality
tsx scripts/test-cache-connectivity.ts

# Test application health
curl -f http://localhost:3000/health

# Test API endpoints
tsx scripts/test-api-endpoints.cjs

echo "✅ Rollback verification completed"
```

## Emergency Rollback Procedures

### Critical System Failure
1. **Immediate Actions**
   - Stop all migration processes
   - Revert DNS to original infrastructure
   - Notify stakeholders

2. **System Recovery**
   - Execute full rollback procedure
   - Verify system functionality
   - Monitor for issues

3. **Post-Incident**
   - Document incident details
   - Analyze root cause
   - Update rollback procedures

### Data Integrity Issues
1. **Stop Data Modifications**
   - Enable read-only mode
   - Stop all write operations
   - Preserve current state

2. **Assess Damage**
   - Compare source and target data
   - Identify inconsistencies
   - Determine recovery approach

3. **Execute Recovery**
   - Restore from backups if needed
   - Re-sync data if possible
   - Verify integrity

## Rollback Checklist

### Pre-Rollback
- [ ] Identify rollback trigger and scope
- [ ] Notify stakeholders of rollback
- [ ] Backup current state
- [ ] Prepare rollback scripts
- [ ] Set maintenance mode if needed

### During Rollback
- [ ] Execute rollback steps in order
- [ ] Monitor system status
- [ ] Document all actions taken
- [ ] Verify each step completion
- [ ] Handle any errors gracefully

### Post-Rollback
- [ ] Verify system functionality
- [ ] Run integrity checks
- [ ] Monitor performance
- [ ] Update documentation
- [ ] Conduct post-mortem if needed

## Monitoring and Alerting

### Rollback Metrics
- Rollback execution time
- System availability during rollback
- Data integrity status
- Performance impact
- Error rates

### Alert Conditions
- Rollback process failure
- Extended rollback duration
- Data integrity issues
- System unavailability
- Performance degradation

## Documentation and Communication

### Rollback Documentation
- Detailed step-by-step procedures
- Script usage instructions
- Troubleshooting guides
- Contact information
- Escalation procedures

### Communication Plan
- Stakeholder notification
- Status updates during rollback
- Completion confirmation
- Post-rollback summary
- Lessons learned

## Conclusion

These rollback procedures provide comprehensive coverage for all migration phases. Regular testing and updates ensure that rollback capabilities remain effective and reliable. The procedures prioritize data integrity, minimize downtime, and provide clear guidance for various rollback scenarios.

For questions or issues with rollback procedures, contact the DevOps team or refer to the troubleshooting guides in the appendix.