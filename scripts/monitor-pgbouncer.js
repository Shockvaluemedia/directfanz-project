#!/usr/bin/env node

/**
 * PgBouncer Connection Pool Monitoring Script
 * Monitors PgBouncer connection pool metrics and health
 */

const { Client } = require('pg');
const AWS = require('aws-sdk');

// Configuration
const config = {
  pgbouncer: {
    host: process.env.PGBOUNCER_HOST || 'pgbouncer.direct-fan-platform.local',
    port: process.env.PGBOUNCER_PORT || 5432,
    database: 'pgbouncer',
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD
  },
  cloudwatch: {
    region: process.env.AWS_REGION || 'us-east-1',
    namespace: 'DirectFanPlatform/PgBouncer'
  }
};

// Initialize CloudWatch client
const cloudwatch = new AWS.CloudWatch({ region: config.cloudwatch.region });

/**
 * Get PgBouncer statistics
 */
async function getPgBouncerStats() {
  const client = new Client(config.pgbouncer);
  
  try {
    await client.connect();
    
    // Get pool statistics
    const poolStats = await client.query('SHOW POOLS');
    const dbStats = await client.query('SHOW DATABASES');
    const clientStats = await client.query('SHOW CLIENTS');
    const serverStats = await client.query('SHOW SERVERS');
    
    return {
      pools: poolStats.rows,
      databases: dbStats.rows,
      clients: clientStats.rows,
      servers: serverStats.rows
    };
  } finally {
    await client.end();
  }
}

/**
 * Send metrics to CloudWatch
 */
async function sendMetricsToCloudWatch(stats) {
  const timestamp = new Date();
  const metricData = [];

  // Pool metrics
  stats.pools.forEach(pool => {
    metricData.push(
      {
        MetricName: 'ActiveConnections',
        Dimensions: [
          { Name: 'Database', Value: pool.database },
          { Name: 'User', Value: pool.user }
        ],
        Value: parseInt(pool.cl_active),
        Unit: 'Count',
        Timestamp: timestamp
      },
      {
        MetricName: 'WaitingConnections',
        Dimensions: [
          { Name: 'Database', Value: pool.database },
          { Name: 'User', Value: pool.user }
        ],
        Value: parseInt(pool.cl_waiting),
        Unit: 'Count',
        Timestamp: timestamp
      },
      {
        MetricName: 'ServerConnections',
        Dimensions: [
          { Name: 'Database', Value: pool.database },
          { Name: 'User', Value: pool.user }
        ],
        Value: parseInt(pool.sv_active),
        Unit: 'Count',
        Timestamp: timestamp
      },
      {
        MetricName: 'IdleServerConnections',
        Dimensions: [
          { Name: 'Database', Value: pool.database },
          { Name: 'User', Value: pool.user }
        ],
        Value: parseInt(pool.sv_idle),
        Unit: 'Count',
        Timestamp: timestamp
      },
      {
        MetricName: 'PoolMode',
        Dimensions: [
          { Name: 'Database', Value: pool.database },
          { Name: 'User', Value: pool.user }
        ],
        Value: pool.pool_mode === 'transaction' ? 1 : 0,
        Unit: 'None',
        Timestamp: timestamp
      }
    );
  });

  // Database metrics
  stats.databases.forEach(db => {
    metricData.push(
      {
        MetricName: 'DatabaseConnections',
        Dimensions: [
          { Name: 'Database', Value: db.name }
        ],
        Value: parseInt(db.pool_size),
        Unit: 'Count',
        Timestamp: timestamp
      },
      {
        MetricName: 'DatabaseMaxConnections',
        Dimensions: [
          { Name: 'Database', Value: db.name }
        ],
        Value: parseInt(db.max_connections || 0),
        Unit: 'Count',
        Timestamp: timestamp
      }
    );
  });

  // Overall client and server counts
  metricData.push(
    {
      MetricName: 'TotalClients',
      Value: stats.clients.length,
      Unit: 'Count',
      Timestamp: timestamp
    },
    {
      MetricName: 'TotalServers',
      Value: stats.servers.length,
      Unit: 'Count',
      Timestamp: timestamp
    }
  );

  // Send metrics in batches (CloudWatch limit is 20 metrics per request)
  const batchSize = 20;
  for (let i = 0; i < metricData.length; i += batchSize) {
    const batch = metricData.slice(i, i + batchSize);
    
    await cloudwatch.putMetricData({
      Namespace: config.cloudwatch.namespace,
      MetricData: batch
    }).promise();
  }

  console.log(`Sent ${metricData.length} metrics to CloudWatch`);
}

/**
 * Check PgBouncer health
 */
async function checkPgBouncerHealth() {
  const client = new Client(config.pgbouncer);
  
  try {
    await client.connect();
    
    // Simple health check query
    const result = await client.query('SHOW VERSION');
    
    return {
      healthy: true,
      version: result.rows[0]?.version || 'unknown',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  } finally {
    await client.end();
  }
}

/**
 * Generate connection pool efficiency report
 */
function generateEfficiencyReport(stats) {
  const report = {
    timestamp: new Date().toISOString(),
    pools: [],
    summary: {
      totalActiveConnections: 0,
      totalWaitingConnections: 0,
      totalServerConnections: 0,
      totalIdleServerConnections: 0,
      efficiency: 0
    }
  };

  stats.pools.forEach(pool => {
    const activeClients = parseInt(pool.cl_active);
    const waitingClients = parseInt(pool.cl_waiting);
    const activeServers = parseInt(pool.sv_active);
    const idleServers = parseInt(pool.sv_idle);
    const totalServers = activeServers + idleServers;
    
    const poolEfficiency = totalServers > 0 ? (activeServers / totalServers) * 100 : 0;
    
    report.pools.push({
      database: pool.database,
      user: pool.user,
      activeClients,
      waitingClients,
      activeServers,
      idleServers,
      totalServers,
      efficiency: Math.round(poolEfficiency * 100) / 100,
      poolMode: pool.pool_mode
    });

    report.summary.totalActiveConnections += activeClients;
    report.summary.totalWaitingConnections += waitingClients;
    report.summary.totalServerConnections += activeServers;
    report.summary.totalIdleServerConnections += idleServers;
  });

  const totalServers = report.summary.totalServerConnections + report.summary.totalIdleServerConnections;
  report.summary.efficiency = totalServers > 0 ? 
    Math.round((report.summary.totalServerConnections / totalServers) * 10000) / 100 : 0;

  return report;
}

/**
 * Main monitoring function
 */
async function main() {
  try {
    console.log('Starting PgBouncer monitoring...');
    
    // Check health
    const health = await checkPgBouncerHealth();
    console.log('Health check:', health);
    
    if (!health.healthy) {
      console.error('PgBouncer is not healthy:', health.error);
      process.exit(1);
    }

    // Get statistics
    const stats = await getPgBouncerStats();
    console.log('Retrieved PgBouncer statistics');

    // Generate efficiency report
    const report = generateEfficiencyReport(stats);
    console.log('Connection Pool Efficiency Report:');
    console.log(JSON.stringify(report, null, 2));

    // Send metrics to CloudWatch
    if (process.env.SEND_METRICS !== 'false') {
      await sendMetricsToCloudWatch(stats);
    }

    // Check for potential issues
    const issues = [];
    
    report.pools.forEach(pool => {
      if (pool.waitingClients > 0) {
        issues.push(`Pool ${pool.database}/${pool.user} has ${pool.waitingClients} waiting clients`);
      }
      
      if (pool.efficiency < 50) {
        issues.push(`Pool ${pool.database}/${pool.user} has low efficiency: ${pool.efficiency}%`);
      }
    });

    if (issues.length > 0) {
      console.warn('Potential issues detected:');
      issues.forEach(issue => console.warn(`- ${issue}`));
    } else {
      console.log('No issues detected');
    }

  } catch (error) {
    console.error('Monitoring failed:', error);
    process.exit(1);
  }
}

// Run monitoring
if (require.main === module) {
  main();
}

module.exports = {
  getPgBouncerStats,
  checkPgBouncerHealth,
  generateEfficiencyReport,
  sendMetricsToCloudWatch
};