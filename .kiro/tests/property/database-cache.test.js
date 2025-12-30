/**
 * Property Test: Database and Cache Configuration
 * Validates: Requirements 3.3, 3.4
 * 
 * Property 9: Database and cache configuration
 * - RDS PostgreSQL with PgBouncer connection pooling
 * - ElastiCache Redis cluster with failover
 * - Automated backups and monitoring
 */

const fs = require('fs');
const path = require('path');

describe('Property Test: Database and Cache Configuration', () => {
  const terraformDir = path.join(__dirname, '../../infrastructure/terraform');
  const pgbouncerDir = path.join(__dirname, '../../infrastructure/pgbouncer');

  test('Property 9.1: RDS PostgreSQL configuration is production-ready', () => {
    const rdsConfigPath = path.join(terraformDir, 'rds-enhanced.tf');
    expect(fs.existsSync(rdsConfigPath)).toBe(true);
    
    const rdsConfig = fs.readFileSync(rdsConfigPath, 'utf8');
    
    // Verify RDS instance configuration
    expect(rdsConfig).toContain('aws_db_instance');
    expect(rdsConfig).toContain('aws_db_subnet_group');
    expect(rdsConfig).toContain('aws_db_parameter_group');
    
    // Verify backup configuration
    expect(rdsConfig).toMatch(/backup_retention_period\s*=\s*\d+/);
    expect(rdsConfig).toMatch(/backup_window\s*=\s*"[^"]+"/);
    expect(rdsConfig).toMatch(/maintenance_window\s*=\s*"[^"]+"/);
    
    // Verify security configuration
    expect(rdsConfig).toContain('vpc_security_group_ids');
    expect(rdsConfig).toMatch(/encrypted\s*=\s*true/);
    expect(rdsConfig).toMatch(/storage_encrypted\s*=\s*true/);
    
    // Verify monitoring
    expect(rdsConfig).toMatch(/monitoring_interval\s*=\s*\d+/);
    expect(rdsConfig).toContain('monitoring_role_arn');
    expect(rdsConfig).toMatch(/performance_insights_enabled\s*=\s*true/);
  });

  test('Property 9.2: Database instance sizing is appropriate for production', () => {
    const tfvarsPath = path.join(terraformDir, 'terraform.tfvars');
    const tfvarsContent = fs.readFileSync(tfvarsPath, 'utf8');
    
    // Extract database configuration
    const dbInstanceMatch = tfvarsContent.match(/db_instance_class\s*=\s*"([^"]+)"/);
    const dbStorageMatch = tfvarsContent.match(/db_allocated_storage\s*=\s*(\d+)/);
    const dbMaxStorageMatch = tfvarsContent.match(/db_max_allocated_storage\s*=\s*(\d+)/);
    const backupRetentionMatch = tfvarsContent.match(/db_backup_retention_days\s*=\s*(\d+)/);
    
    expect(dbInstanceMatch).toBeTruthy();
    expect(dbStorageMatch).toBeTruthy();
    expect(dbMaxStorageMatch).toBeTruthy();
    expect(backupRetentionMatch).toBeTruthy();
    
    const instanceClass = dbInstanceMatch[1];
    const allocatedStorage = parseInt(dbStorageMatch[1]);
    const maxStorage = parseInt(dbMaxStorageMatch[1]);
    const backupRetention = parseInt(backupRetentionMatch[1]);
    
    // Verify production-appropriate sizing
    expect(instanceClass).toMatch(/^db\.(r6g|r5|m5|t3)\.(large|xlarge|2xlarge)$/); // Production instance types
    expect(allocatedStorage).toBeGreaterThanOrEqual(100); // Minimum 100GB
    expect(maxStorage).toBeGreaterThan(allocatedStorage); // Auto-scaling enabled
    expect(backupRetention).toBeGreaterThanOrEqual(7); // At least 7 days backup
  });

  test('Property 9.3: PgBouncer connection pooling is configured', () => {
    const pgbouncerTfPath = path.join(terraformDir, 'pgbouncer.tf');
    const pgbouncerConfigPath = path.join(pgbouncerDir, 'pgbouncer.ini');
    const pgbouncerDockerPath = path.join(pgbouncerDir, 'Dockerfile');
    
    // Verify PgBouncer Terraform configuration exists
    expect(fs.existsSync(pgbouncerTfPath)).toBe(true);
    
    if (fs.existsSync(pgbouncerTfPath)) {
      const pgbouncerTf = fs.readFileSync(pgbouncerTfPath, 'utf8');
      expect(pgbouncerTf).toContain('aws_ecs_task_definition');
      expect(pgbouncerTf).toContain('pgbouncer');
    }
    
    // Verify PgBouncer configuration file
    if (fs.existsSync(pgbouncerConfigPath)) {
      const pgbouncerConfig = fs.readFileSync(pgbouncerConfigPath, 'utf8');
      expect(pgbouncerConfig).toContain('[databases]');
      expect(pgbouncerConfig).toContain('[pgbouncer]');
      expect(pgbouncerConfig).toMatch(/pool_mode\s*=\s*(transaction|session)/);
      expect(pgbouncerConfig).toMatch(/max_client_conn\s*=\s*\d+/);
      expect(pgbouncerConfig).toMatch(/default_pool_size\s*=\s*\d+/);
    }
    
    // Verify PgBouncer Docker configuration
    if (fs.existsSync(pgbouncerDockerPath)) {
      const dockerfile = fs.readFileSync(pgbouncerDockerPath, 'utf8');
      expect(dockerfile).toContain('pgbouncer');
      expect(dockerfile).toContain('EXPOSE');
    }
  });

  test('Property 9.4: ElastiCache Redis cluster is production-configured', () => {
    const redisConfigPath = path.join(terraformDir, 'elasticache-enhanced.tf');
    expect(fs.existsSync(redisConfigPath)).toBe(true);
    
    const redisConfig = fs.readFileSync(redisConfigPath, 'utf8');
    
    // Verify Redis cluster configuration
    expect(redisConfig).toContain('aws_elasticache_replication_group');
    expect(redisConfig).toContain('aws_elasticache_subnet_group');
    expect(redisConfig).toContain('aws_elasticache_parameter_group');
    
    // Verify high availability configuration
    expect(redisConfig).toMatch(/num_cache_clusters\s*=\s*\d+/);
    expect(redisConfig).toMatch(/automatic_failover_enabled\s*=\s*true/);
    expect(redisConfig).toMatch(/multi_az_enabled\s*=\s*true/);
    
    // Verify security configuration
    expect(redisConfig).toContain('security_group_ids');
    expect(redisConfig).toMatch(/at_rest_encryption_enabled\s*=\s*true/);
    expect(redisConfig).toMatch(/transit_encryption_enabled\s*=\s*true/);
    
    // Verify backup configuration
    expect(redisConfig).toMatch(/snapshot_retention_limit\s*=\s*\d+/);
    expect(redisConfig).toMatch(/snapshot_window\s*=\s*"[^"]+"/);
  });

  test('Property 9.5: Redis cluster sizing is appropriate for production', () => {
    const tfvarsPath = path.join(terraformDir, 'terraform.tfvars');
    const tfvarsContent = fs.readFileSync(tfvarsPath, 'utf8');
    
    // Extract Redis configuration
    const nodeTypeMatch = tfvarsContent.match(/redis_enhanced_node_type\s*=\s*"([^"]+)"/);
    const numShardsMatch = tfvarsContent.match(/redis_num_shards\s*=\s*(\d+)/);
    const replicasMatch = tfvarsContent.match(/redis_replicas_per_shard\s*=\s*(\d+)/);
    const snapshotRetentionMatch = tfvarsContent.match(/redis_snapshot_retention_days\s*=\s*(\d+)/);
    
    expect(nodeTypeMatch).toBeTruthy();
    expect(numShardsMatch).toBeTruthy();
    expect(replicasMatch).toBeTruthy();
    expect(snapshotRetentionMatch).toBeTruthy();
    
    const nodeType = nodeTypeMatch[1];
    const numShards = parseInt(numShardsMatch[1]);
    const replicas = parseInt(replicasMatch[1]);
    const snapshotRetention = parseInt(snapshotRetentionMatch[1]);
    
    // Verify production-appropriate sizing
    expect(nodeType).toMatch(/^cache\.(r6g|r5|m5)\.(large|xlarge|2xlarge)$/); // Production node types
    expect(numShards).toBeGreaterThanOrEqual(1); // At least 1 shard
    expect(replicas).toBeGreaterThanOrEqual(1); // At least 1 replica for HA
    expect(snapshotRetention).toBeGreaterThanOrEqual(1); // At least 1 day retention
  });

  test('Property 9.6: Database security groups are properly configured', () => {
    const securityGroupsPath = path.join(terraformDir, 'security-groups.tf');
    expect(fs.existsSync(securityGroupsPath)).toBe(true);
    
    const securityGroups = fs.readFileSync(securityGroupsPath, 'utf8');
    
    // Verify database security group
    expect(securityGroups).toMatch(/aws_security_group.*database/);
    expect(securityGroups).toMatch(/from_port\s*=\s*5432/); // PostgreSQL port
    expect(securityGroups).toMatch(/to_port\s*=\s*5432/);
    expect(securityGroups).toMatch(/protocol\s*=\s*"tcp"/);
    
    // Verify Redis security group
    expect(securityGroups).toMatch(/aws_security_group.*redis/);
    expect(securityGroups).toMatch(/from_port\s*=\s*6379/); // Redis port
    expect(securityGroups).toMatch(/to_port\s*=\s*6379/);
  });

  test('Property 9.7: Database monitoring and alerting is configured', () => {
    const monitoringPath = path.join(terraformDir, 'cloudwatch-monitoring.tf');
    expect(fs.existsSync(monitoringPath)).toBe(true);
    
    const monitoringConfig = fs.readFileSync(monitoringPath, 'utf8');
    
    // Verify RDS monitoring
    expect(monitoringConfig).toMatch(/namespace\s*=\s*"AWS\/RDS"/);
    expect(monitoringConfig).toMatch(/metric_name\s*=\s*"CPUUtilization"/);
    expect(monitoringConfig).toMatch(/metric_name\s*=\s*"DatabaseConnections"/);
    expect(monitoringConfig).toMatch(/metric_name\s*=\s*"FreeableMemory"/);
    
    // Verify ElastiCache monitoring
    expect(monitoringConfig).toMatch(/namespace\s*=\s*"AWS\/ElastiCache"/);
    expect(monitoringConfig).toMatch(/metric_name\s*=\s*"CPUUtilization"/);
    expect(monitoringConfig).toMatch(/metric_name\s*=\s*"CurrConnections"/);
  });

  test('Property 9.8: Database parameter groups are optimized', () => {
    const rdsConfigPath = path.join(terraformDir, 'rds-enhanced.tf');
    const rdsConfig = fs.readFileSync(rdsConfigPath, 'utf8');
    
    // Verify parameter group configuration
    expect(rdsConfig).toContain('aws_db_parameter_group');
    expect(rdsConfig).toMatch(/family\s*=\s*"postgres\d+"/);
    
    // Check for performance optimization parameters
    if (rdsConfig.includes('parameter')) {
      expect(rdsConfig).toMatch(/parameter\s*{[\s\S]*name\s*=\s*"[^"]+"/);
      expect(rdsConfig).toMatch(/parameter\s*{[\s\S]*value\s*=\s*"[^"]+"/);
    }
  });

  test('Property 9.9: Read replica configuration is present', () => {
    const tfvarsPath = path.join(terraformDir, 'terraform.tfvars');
    const tfvarsContent = fs.readFileSync(tfvarsPath, 'utf8');
    
    const readReplicaMatch = tfvarsContent.match(/enable_read_replica\s*=\s*(true|false)/);
    expect(readReplicaMatch).toBeTruthy();
    
    if (readReplicaMatch[1] === 'true') {
      const rdsConfigPath = path.join(terraformDir, 'rds-enhanced.tf');
      const rdsConfig = fs.readFileSync(rdsConfigPath, 'utf8');
      
      // Verify read replica configuration
      expect(rdsConfig).toMatch(/aws_db_instance.*read_replica/);
      expect(rdsConfig).toMatch(/replicate_source_db\s*=/);
    }
  });

  test('Property 9.10: Database and cache backup strategies are comprehensive', () => {
    const rdsConfigPath = path.join(terraformDir, 'rds-enhanced.tf');
    const rdsConfig = fs.readFileSync(rdsConfigPath, 'utf8');
    
    // Verify RDS backup configuration
    expect(rdsConfig).toMatch(/backup_retention_period\s*=\s*var\.db_backup_retention_days/);
    expect(rdsConfig).toMatch(/backup_window\s*=\s*"[^"]+"/);
    expect(rdsConfig).toMatch(/copy_tags_to_snapshot\s*=\s*true/);
    expect(rdsConfig).toMatch(/delete_automated_backups\s*=\s*false/);
    
    const redisConfigPath = path.join(terraformDir, 'elasticache-enhanced.tf');
    const redisConfig = fs.readFileSync(redisConfigPath, 'utf8');
    
    // Verify Redis backup configuration
    expect(redisConfig).toMatch(/snapshot_retention_limit\s*=\s*var\.redis_snapshot_retention_days/);
    expect(redisConfig).toMatch(/snapshot_window\s*=\s*"[^"]+"/);
    expect(redisConfig).toMatch(/final_snapshot_identifier\s*=/);
  });
});