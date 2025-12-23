/**
 * PgBouncer configuration utilities for RDS connection pooling
 * Handles connection pooling configuration for AWS RDS deployment
 */

import { getParameter, isRunningInECS } from './aws-config';
import { logger } from './logger';

export interface PgBouncerConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  poolMode: 'session' | 'transaction' | 'statement';
  maxClientConnections: number;
  defaultPoolSize: number;
  reservePoolSize: number;
  reservePoolTimeout: number;
  maxDbConnections: number;
  maxUserConnections: number;
  serverRoundRobin: boolean;
  ignoreStartupParameters: string[];
  applicationNameAddHost: boolean;
  statsUsers: string[];
  adminUsers: string[];
}

/**
 * Generate PgBouncer configuration for RDS
 */
export const generatePgBouncerConfig = async (): Promise<PgBouncerConfig> => {
  // Get RDS connection details from Parameter Store or environment
  const databaseUrl = await getParameter('/directfanz/database/url', 'DATABASE_URL');
  
  if (!databaseUrl) {
    throw new Error('Database URL not found in Parameter Store or environment variables');
  }

  const url = new URL(databaseUrl);
  
  // Extract connection details
  const host = url.hostname;
  const port = parseInt(url.port) || 5432;
  const database = url.pathname.slice(1); // Remove leading slash
  const username = url.username;
  const password = url.password;

  // ECS-optimized configuration
  const config: PgBouncerConfig = {
    host,
    port,
    database,
    username,
    password,
    
    // Connection pooling settings optimized for ECS + RDS
    poolMode: 'transaction', // Most efficient for web applications
    maxClientConnections: isRunningInECS() ? 200 : 50,
    defaultPoolSize: isRunningInECS() ? 20 : 10,
    reservePoolSize: isRunningInECS() ? 5 : 2,
    reservePoolTimeout: 5, // seconds
    maxDbConnections: isRunningInECS() ? 100 : 25,
    maxUserConnections: isRunningInECS() ? 100 : 25,
    
    // Performance optimizations
    serverRoundRobin: true,
    ignoreStartupParameters: [
      'extra_float_digits',
      'search_path',
      'application_name',
    ],
    applicationNameAddHost: true,
    
    // Admin configuration
    statsUsers: ['pgbouncer_stats'],
    adminUsers: ['pgbouncer_admin'],
  };

  return config;
};

/**
 * Generate PgBouncer INI configuration file content
 */
export const generatePgBouncerIni = async (): Promise<string> => {
  const config = await generatePgBouncerConfig();
  
  const iniContent = `
# PgBouncer configuration for DirectFanz RDS deployment
# Generated automatically - do not edit manually

[databases]
${config.database} = host=${config.host} port=${config.port} dbname=${config.database}

[pgbouncer]
# Connection settings
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

# Pool settings
pool_mode = ${config.poolMode}
max_client_conn = ${config.maxClientConnections}
default_pool_size = ${config.defaultPoolSize}
reserve_pool_size = ${config.reservePoolSize}
reserve_pool_timeout = ${config.reservePoolTimeout}
max_db_connections = ${config.maxDbConnections}
max_user_connections = ${config.maxUserConnections}

# Performance settings
server_round_robin = ${config.serverRoundRobin ? '1' : '0'}
ignore_startup_parameters = ${config.ignoreStartupParameters.join(',')}
application_name_add_host = ${config.applicationNameAddHost ? '1' : '0'}

# Timeouts (in seconds)
server_connect_timeout = 15
server_login_retry = 15
query_timeout = 0
query_wait_timeout = 120
client_idle_timeout = 0
client_login_timeout = 60
autodb_idle_timeout = 3600
dns_max_ttl = 15
dns_nxdomain_ttl = 15

# Logging
log_connections = 1
log_disconnections = 1
log_pooler_errors = 1
log_stats = 1

# Admin settings
stats_users = ${config.statsUsers.join(',')}
admin_users = ${config.adminUsers.join(',')}

# Security
server_tls_sslmode = prefer
server_tls_protocols = secure
server_tls_ciphers = ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20:!aNULL:!MD5:!DSS
server_tls_ca_file = /etc/ssl/certs/ca-certificates.crt

# Health check
server_check_query = SELECT 1
server_check_delay = 30

# Memory settings
pkt_buf = 4096
listen_backlog = 128
sbuf_loopcnt = 5

# Dangerous settings (use with caution)
server_fast_close = 0
server_reset_query = DISCARD ALL
server_reset_query_always = 0
`;

  return iniContent.trim();
};

/**
 * Generate PgBouncer userlist.txt content
 */
export const generatePgBouncerUserlist = async (): Promise<string> => {
  const config = await generatePgBouncerConfig();
  
  // In production, passwords should be hashed
  // For now, using plaintext (should be replaced with proper hashing)
  const userlist = `
# PgBouncer userlist for DirectFanz
# Format: "username" "password"

"${config.username}" "${config.password}"
"pgbouncer_stats" "stats_password"
"pgbouncer_admin" "admin_password"
`;

  return userlist.trim();
};

/**
 * Get PgBouncer connection URL
 */
export const getPgBouncerUrl = async (): Promise<string> => {
  const config = await generatePgBouncerConfig();
  
  // PgBouncer typically runs on port 6432
  const pgbouncerPort = process.env.PGBOUNCER_PORT || '6432';
  const pgbouncerHost = process.env.PGBOUNCER_HOST || 'localhost';
  
  return `postgresql://${config.username}:${config.password}@${pgbouncerHost}:${pgbouncerPort}/${config.database}`;
};

/**
 * Check if PgBouncer should be used
 */
export const shouldUsePgBouncer = (): boolean => {
  return isRunningInECS() && process.env.USE_PGBOUNCER === 'true';
};

/**
 * Get the appropriate database URL (direct RDS or via PgBouncer)
 */
export const getDatabaseUrl = async (): Promise<string> => {
  if (shouldUsePgBouncer()) {
    logger.info('Using PgBouncer for database connections');
    return await getPgBouncerUrl();
  } else {
    logger.info('Using direct RDS connection');
    return await getParameter('/directfanz/database/url', 'DATABASE_URL') || '';
  }
};

/**
 * Health check for PgBouncer
 */
export const checkPgBouncerHealth = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  stats?: any;
  error?: string;
}> => {
  if (!shouldUsePgBouncer()) {
    return { status: 'healthy' }; // Not using PgBouncer
  }

  try {
    // This would typically connect to PgBouncer admin interface
    // For now, just return healthy if configuration is valid
    const config = await generatePgBouncerConfig();
    
    return {
      status: 'healthy',
      stats: {
        poolMode: config.poolMode,
        maxConnections: config.maxClientConnections,
        defaultPoolSize: config.defaultPoolSize,
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};